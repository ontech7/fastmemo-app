//! What an AI client starts (`--mcp`): relays JSON-RPC lines between stdio and the app's socket. stdout carries JSON-RPC only.
//! With the app away, the definitions compiled in here still answer, so the client doesn't mark the server as failed.

use std::io::{self, BufRead, BufReader, Write};

use serde_json::Value;

use super::endpoint::Connection;
use super::protocol::{handle_line, ToolOutcome, ToolRunner};
use super::server::{line_text, log, read_line, too_long_reply, write_line, Line, MAX_LINE_BYTES};
use super::tools::Tool;

const NOT_REACHABLE: &str =
    "Fast Memo isn't reachable: check it's open and that MCP is on in its settings.";
const LOST: &str =
    "The connection to Fast Memo was lost after this call was sent, so it may have run: check before retrying.";

/// One connection for the session, since the session's rights are tied to it. Returns the process's exit code.
pub fn relay(
    mut input: impl BufRead,
    mut output: impl Write,
    mut connect: impl FnMut() -> io::Result<Connection>,
    version: &str,
) -> i32 {
    let mut link = None;
    loop {
        let reply = match read_line(&mut input, MAX_LINE_BYTES) {
            Ok(Line::Complete(line)) => exchange(&line, &mut link, &mut connect, version),
            // Refused here: the app would close the connection, and the session's rights with it.
            Ok(Line::TooLong) => {
                while let Ok(Line::TooLong) = read_line(&mut input, MAX_LINE_BYTES) {}
                Some(too_long_reply())
            }
            Ok(Line::End) => return 0,
            Err(err) => {
                log(format_args!("can't read from the client: {err}"));
                return 1;
            }
        };
        if let Some(reply) = reply {
            if let Err(err) = write_line(&mut output, reply.as_bytes()) {
                log(format_args!("can't write to the client: {err}"));
                return 1;
            }
        }
    }
}

/// Forwards a line and returns what the client should get back, if anything.
fn exchange(
    line: &[u8],
    link: &mut Option<BufReader<Connection>>,
    connect: &mut impl FnMut() -> io::Result<Connection>,
    version: &str,
) -> Option<String> {
    let Some(stream) = send(line, link, connect) else {
        return answer_here(line, NOT_REACHABLE, version);
    };
    if !expects_reply(line) {
        return None;
    }
    if let Ok(Line::Complete(reply)) = read_line(stream, MAX_LINE_BYTES) {
        if let Ok(reply) = String::from_utf8(reply) {
            return Some(reply);
        }
    }
    // Sent, and the app may have acted on it: this line must not go out again.
    *link = None;
    answer_here(line, LOST, version)
}

/// Puts the line on the connection, opening one if there's none. A failed write didn't deliver the line, since its newline is
/// the last byte and the server runs only whole lines. So a connection that died while idle (the app was restarted) is
/// replaced at once, and the call isn't lost.
fn send<'a>(
    line: &[u8],
    link: &'a mut Option<BufReader<Connection>>,
    connect: &mut impl FnMut() -> io::Result<Connection>,
) -> Option<&'a mut BufReader<Connection>> {
    for _ in 0..2 {
        if link.is_none() {
            match connect() {
                Ok(connection) => *link = Some(BufReader::new(connection)),
                Err(err) => {
                    log(format_args!("Fast Memo isn't reachable: {err}"));
                    return None;
                }
            }
        }
        if write_line(link.as_mut()?.get_mut(), line).is_ok() {
            return link.as_mut();
        }
        *link = None;
    }
    None
}

/// Whether the app answers this line: everything but a notification (an object with no id), even what it refuses.
fn expects_reply(line: &[u8]) -> bool {
    match serde_json::from_slice::<Value>(line) {
        Ok(Value::Object(fields)) => fields.contains_key("id"),
        _ => true,
    }
}

fn answer_here(line: &[u8], message: &'static str, version: &str) -> Option<String> {
    handle_line(line_text(line), &mut Away(message), version)
}

/// Stands in for the app: the tools compiled in, and the same message for every call.
struct Away(&'static str);

impl ToolRunner for Away {
    fn listed(&self) -> Vec<Tool> {
        Tool::ALL.to_vec()
    }
    fn call(&mut self, _tool: Tool, _args: Value) -> ToolOutcome {
        ToolOutcome {
            text: self.0.to_string(),
            is_error: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::VecDeque;
    use std::io::{Error, ErrorKind, Read};
    use std::sync::{Arc, Mutex};

    /// One side of a fake connection: what was written, what's left to read, and how it fails.
    #[derive(Default)]
    struct Wire {
        written: Vec<Vec<u8>>,
        replies: VecDeque<u8>,
        reads: usize,
        /// Writes after this many fail, as on a connection whose other end has gone.
        writes_allowed: Option<usize>,
    }

    #[derive(Clone, Default)]
    struct Fake(Arc<Mutex<Wire>>);

    impl Fake {
        fn answering(replies: &[Value]) -> Fake {
            let fake = Fake::default();
            for reply in replies {
                fake.0
                    .lock()
                    .unwrap()
                    .replies
                    .extend(format!("{reply}\n").into_bytes());
            }
            fake
        }

        fn connection(&self) -> Connection {
            Box::new(self.clone())
        }

        fn written(&self) -> Vec<Vec<u8>> {
            self.0.lock().unwrap().written.clone()
        }
    }

    impl Read for Fake {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            let mut wire = self.0.lock().unwrap();
            wire.reads += 1;
            let count = buf.len().min(wire.replies.len());
            for slot in &mut buf[..count] {
                *slot = wire.replies.pop_front().unwrap();
            }
            Ok(count)
        }
    }

    impl Write for Fake {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            let mut wire = self.0.lock().unwrap();
            if wire
                .writes_allowed
                .is_some_and(|allowed| wire.written.len() >= allowed)
            {
                return Err(Error::from(ErrorKind::BrokenPipe));
            }
            wire.written.push(buf.to_vec());
            Ok(buf.len())
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    fn app_away() -> io::Result<Connection> {
        Err(Error::from(ErrorKind::ConnectionRefused))
    }

    fn run(input: &[u8], connect: impl FnMut() -> io::Result<Connection>) -> (i32, Vec<Value>) {
        let mut output = Vec::new();
        let code = relay(input, &mut output, connect, "9.9.9");
        let output = String::from_utf8(output).unwrap();
        let replies = output
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        (code, replies)
    }

    fn call(id: u64) -> Value {
        json!({"jsonrpc":"2.0","id":id,"method":"tools/call","params":{"name":"fastmemo_help","arguments":{}}})
    }

    fn answer(id: u64, text: &str) -> Value {
        json!({"jsonrpc":"2.0","id":id,"result":{"content":[{"type":"text","text":text}],"isError":false}})
    }

    fn lines(requests: &[Value]) -> Vec<u8> {
        requests
            .iter()
            .flat_map(|request| format!("{request}\n").into_bytes())
            .collect()
    }

    fn text(reply: &Value) -> &str {
        reply["result"]["content"][0]["text"].as_str().unwrap()
    }

    #[test]
    fn with_the_app_away_tools_list_answers_and_a_call_gets_a_tool_error() {
        let initialize = json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25"}});
        let list = json!({"jsonrpc":"2.0","id":2,"method":"tools/list"});
        let (code, replies) = run(&lines(&[initialize, list, call(3)]), app_away);

        assert_eq!(code, 0);
        assert_eq!(replies[0]["result"]["serverInfo"]["version"], "9.9.9");
        assert_eq!(replies[1]["result"]["tools"].as_array().unwrap().len(), 9);
        assert_eq!(replies[2]["id"], 3);
        assert_eq!(replies[2]["result"]["isError"], true);
        let message = text(&replies[2]);
        assert!(message.contains("isn't reachable"), "{message}");
        assert!(message.contains("open"), "{message}");
        assert!(message.contains("MCP is on"), "{message}");
    }

    #[test]
    fn it_connects_again_on_the_next_call() {
        let fake = Fake::answering(&[answer(2, "ran")]);
        let mut attempts = 0;
        let (_, replies) = run(&lines(&[call(1), call(2)]), || {
            attempts += 1;
            if attempts == 1 {
                app_away()
            } else {
                Ok(fake.connection())
            }
        });

        assert_eq!(replies[0]["result"]["isError"], true);
        assert_eq!(text(&replies[1]), "ran");
        assert_eq!(fake.written(), vec![format!("{}\n", call(2)).into_bytes()]);
    }

    #[test]
    fn one_connection_lasts_the_session() {
        let fake = Fake::answering(&[answer(1, "a"), answer(2, "b")]);
        let mut attempts = 0;
        let (_, replies) = run(&lines(&[call(1), call(2)]), || {
            attempts += 1;
            Ok(fake.connection())
        });

        assert_eq!(attempts, 1);
        assert_eq!(text(&replies[0]), "a");
        assert_eq!(text(&replies[1]), "b");
    }

    #[test]
    fn a_call_lost_after_sending_is_not_resent() {
        let fake = Fake::default();
        let mut attempts = 0;
        let (_, replies) = run(&lines(&[call(1)]), || {
            attempts += 1;
            Ok(fake.connection())
        });

        assert_eq!(attempts, 1);
        assert_eq!(fake.written().len(), 1);
        assert_eq!(replies[0]["id"], 1);
        assert_eq!(replies[0]["result"]["isError"], true);
        let message = text(&replies[0]);
        assert!(message.contains("may have run"), "{message}");
        assert!(message.contains("check before retrying"), "{message}");
    }

    #[test]
    fn a_list_lost_after_sending_is_still_answered_and_the_next_line_connects_again() {
        let lost = Fake::default();
        let next = Fake::answering(&[answer(2, "ran")]);
        let mut connections = vec![next.clone(), lost.clone()];
        let list = json!({"jsonrpc":"2.0","id":1,"method":"tools/list"});
        let (_, replies) = run(&lines(&[list, call(2)]), || {
            Ok(connections.pop().unwrap().connection())
        });

        assert_eq!(replies[0]["result"]["tools"].as_array().unwrap().len(), 9);
        assert_eq!(text(&replies[1]), "ran");
    }

    #[test]
    fn a_connection_that_died_while_idle_is_replaced_and_the_call_goes_through() {
        let stale = Fake::answering(&[answer(1, "first")]);
        stale.0.lock().unwrap().writes_allowed = Some(1);
        let fresh = Fake::answering(&[answer(2, "second")]);
        let mut connections = vec![fresh.clone(), stale.clone()];
        let (_, replies) = run(&lines(&[call(1), call(2)]), || {
            Ok(connections.pop().unwrap().connection())
        });

        assert_eq!(text(&replies[0]), "first");
        assert_eq!(text(&replies[1]), "second");
        assert_eq!(stale.written().len(), 1);
        assert_eq!(fresh.written(), vec![format!("{}\n", call(2)).into_bytes()]);
    }

    #[test]
    fn a_connection_that_refuses_writes_and_no_new_one_means_the_app_is_away() {
        let stale = Fake::answering(&[answer(1, "first")]);
        stale.0.lock().unwrap().writes_allowed = Some(1);
        let mut attempts = 0;
        let (_, replies) = run(&lines(&[call(1), call(2)]), || {
            attempts += 1;
            if attempts == 1 {
                Ok(stale.connection())
            } else {
                app_away()
            }
        });

        assert_eq!(text(&replies[0]), "first");
        assert!(text(&replies[1]).contains("isn't reachable"));
    }

    #[test]
    fn a_notification_is_forwarded_without_waiting_for_a_reply() {
        let fake = Fake::default();
        let notification = json!({"jsonrpc":"2.0","method":"notifications/initialized"});
        let (code, replies) = run(&lines(std::slice::from_ref(&notification)), || {
            Ok(fake.connection())
        });

        assert_eq!(code, 0);
        assert!(replies.is_empty());
        assert_eq!(
            fake.written(),
            vec![format!("{notification}\n").into_bytes()]
        );
        assert_eq!(fake.0.lock().unwrap().reads, 0);
    }

    #[test]
    fn a_notification_with_the_app_away_is_dropped_quietly() {
        let notification = json!({"jsonrpc":"2.0","method":"notifications/initialized"});
        let (code, replies) = run(&lines(&[notification]), app_away);
        assert_eq!(code, 0);
        assert!(replies.is_empty());
    }

    #[test]
    fn a_line_over_the_limit_is_refused_here_and_the_session_survives() {
        let fake = Fake::answering(&[answer(2, "ran")]);
        let mut attempts = 0;
        let mut input = vec![b'x'; MAX_LINE_BYTES + 5_000_000];
        input.push(b'\n');
        input.extend(lines(&[call(2)]));
        let (_, replies) = run(&input, || {
            attempts += 1;
            Ok(fake.connection())
        });

        assert_eq!(replies[0]["error"]["code"], -32600);
        assert_eq!(text(&replies[1]), "ran");
        assert_eq!(attempts, 1);
        assert_eq!(fake.written().len(), 1);
    }

    #[test]
    fn stdout_carries_only_json_rpc() {
        // Connected, then lost, then away, with a malformed line and a notification among them.
        let fake = Fake::answering(&[answer(1, "ran")]);
        let mut connections = vec![fake.clone()];
        let mut input = lines(&[call(1), call(2), call(3)]);
        input.extend_from_slice(b"{not json\n");
        input.extend(lines(&[
            json!({"jsonrpc":"2.0","method":"notifications/cancelled"}),
        ]));

        let mut output = Vec::new();
        let code = relay(
            input.as_slice(),
            &mut output,
            || {
                connections
                    .pop()
                    .map(|c| c.connection())
                    .ok_or(Error::from(ErrorKind::ConnectionRefused))
            },
            "9.9.9",
        );

        assert_eq!(code, 0);
        let output = String::from_utf8(output).unwrap();
        assert!(output.ends_with('\n'));
        let replies: Vec<Value> = output
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        assert_eq!(replies.len(), 4);
        assert!(replies.iter().all(|reply| reply["jsonrpc"] == "2.0"));
        assert_eq!(replies[3]["error"]["code"], -32700);
    }

    #[test]
    fn a_client_gone_from_stdout_ends_the_bridge_with_an_error() {
        struct Gone;
        impl Write for Gone {
            fn write(&mut self, _buf: &[u8]) -> io::Result<usize> {
                Err(Error::from(ErrorKind::BrokenPipe))
            }
            fn flush(&mut self) -> io::Result<()> {
                Ok(())
            }
        }
        assert_eq!(
            relay(lines(&[call(1)]).as_slice(), Gone, app_away, "9.9.9"),
            1
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_real_server_that_opens_late_is_reached_without_a_restart() {
        use crate::mcp::endpoint;
        use crate::mcp::server::{serve, test_socket::TempSocket};

        struct Ran;
        impl ToolRunner for Ran {
            fn listed(&self) -> Vec<Tool> {
                Tool::ALL.to_vec()
            }
            fn call(&mut self, _tool: Tool, _args: Value) -> ToolOutcome {
                ToolOutcome {
                    text: "ran".to_string(),
                    is_error: false,
                }
            }
        }

        let socket = TempSocket::new();
        let mut server = None;
        let (_, replies) = run(&lines(&[call(1), call(2)]), || {
            let connected = endpoint::connect(&socket.path);
            if connected.is_err() {
                // The app opens right after the first call found it away.
                server = Some(serve(&socket.path, || Box::new(Ran), "1.0.0".to_string()).unwrap());
            }
            connected
        });

        assert!(text(&replies[0]).contains("isn't reachable"));
        assert_eq!(text(&replies[1]), "ran");
        server.unwrap().stop();
    }
}
