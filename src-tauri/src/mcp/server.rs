//! Serves MCP on the local socket: one blocking thread per connection, each with its own runner.

use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde_json::json;

use super::endpoint::{self, Closer, Connection, Listener};
use super::protocol::{handle_line, ToolRunner};

pub const MAX_LINE_BYTES: usize = 4 * 1024 * 1024;

const ACCEPT_RETRY: Duration = Duration::from_millis(100);
const WAKE_TRIES: usize = 50;
const WAKE_PAUSE: Duration = Duration::from_millis(10);

type Connections = Arc<Mutex<HashMap<u64, LiveConnection>>>;

struct LiveConnection {
    thread: JoinHandle<()>,
    closer: Closer,
}

pub struct ServerHandle {
    endpoint: PathBuf,
    stop: Arc<AtomicBool>,
    accept_thread: JoinHandle<()>,
    connections: Connections,
}

impl ServerHandle {
    /// Nobody new gets in, the socket goes and every client is cut off: off means off now. A call already running ends on its
    /// own thread, within the runner's own time limit, so this can run on the app's main thread.
    pub fn stop(self) {
        self.stop.store(true, Ordering::SeqCst);
        if wake_accept(&self.endpoint, &self.accept_thread) {
            let _ = self.accept_thread.join();
        } else {
            log(format_args!("the MCP listener didn't stop"));
        }
        endpoint::remove(&self.endpoint);
        // Out of the lock: a connection thread takes it to leave, and closing may wait for that thread.
        let connections = std::mem::take(&mut *self.connections.lock().unwrap());
        for connection in connections.values() {
            connection.closer.close(&connection.thread);
        }
    }
}

/// `accept` wakes only for a client, so be that client. On Windows nobody listens for a moment between two pipe instances,
/// hence a few tries. Returns whether the listener will end.
fn wake_accept(endpoint: &Path, accept_thread: &JoinHandle<()>) -> bool {
    for _ in 0..WAKE_TRIES {
        if accept_thread.is_finished() || endpoint::connect(endpoint).is_ok() {
            return true;
        }
        thread::sleep(WAKE_PAUSE);
    }
    false
}

pub fn serve(
    endpoint: &Path,
    make_runner: impl Fn() -> Box<dyn ToolRunner + Send> + Send + 'static,
    version: String,
) -> io::Result<ServerHandle> {
    let listener = Listener::bind(endpoint)?;
    let stop = Arc::new(AtomicBool::new(false));
    let connections = Connections::default();
    let accept_thread = thread::Builder::new()
        .name("mcp-accept".to_string())
        .spawn({
            let stop = stop.clone();
            let connections = connections.clone();
            move || accept_clients(listener, make_runner, &version, &stop, &connections)
        })?;
    Ok(ServerHandle {
        endpoint: endpoint.to_path_buf(),
        stop,
        accept_thread,
        connections,
    })
}

fn accept_clients(
    mut listener: Listener,
    make_runner: impl Fn() -> Box<dyn ToolRunner + Send>,
    version: &str,
    stop: &Arc<AtomicBool>,
    connections: &Connections,
) {
    let mut next_id = 0u64;
    loop {
        let accepted = listener.accept();
        if stop.load(Ordering::SeqCst) {
            return;
        }
        let (stream, closer) = match accepted {
            Ok(accepted) => accepted,
            Err(err) => {
                log(format_args!("an MCP client couldn't connect: {err}"));
                thread::sleep(ACCEPT_RETRY);
                continue;
            }
        };
        let id = next_id;
        next_id += 1;
        let runner = make_runner();
        let version = version.to_string();
        let stop = stop.clone();
        let leaving = connections.clone();
        // Held across the spawn, so a thread that ends at once can't leave before it's been recorded.
        let mut live = connections.lock().unwrap();
        let spawned = thread::Builder::new()
            .name("mcp-connection".to_string())
            .spawn(move || {
                serve_connection(stream, runner, &version, &stop);
                leaving.lock().unwrap().remove(&id);
            });
        match spawned {
            Ok(thread) => {
                live.insert(id, LiveConnection { thread, closer });
            }
            // The client's connection closes with the closure that held it.
            Err(err) => log(format_args!("no thread for an MCP client: {err}")),
        }
    }
}

fn serve_connection(
    stream: Connection,
    mut runner: Box<dyn ToolRunner + Send>,
    version: &str,
    stop: &AtomicBool,
) {
    let mut reader = BufReader::new(stream);
    while !stop.load(Ordering::SeqCst) {
        let line = read_line(&mut reader, MAX_LINE_BYTES);
        if stop.load(Ordering::SeqCst) {
            return;
        }
        let reply = match line {
            Ok(Line::Complete(line)) => handle_line(line_text(&line), runner.as_mut(), version),
            Ok(Line::TooLong) => {
                let _ = write_line(reader.get_mut(), too_long_reply().as_bytes());
                return;
            }
            Ok(Line::End) | Err(_) => return,
        };
        if let Some(reply) = reply {
            if write_line(reader.get_mut(), reply.as_bytes()).is_err() {
                return;
            }
        }
    }
}

pub(super) enum Line {
    /// Without its newline.
    Complete(Vec<u8>),
    TooLong,
    /// The input ended. What came after the last newline, if anything, doesn't count: the sender relies on a line that never
    /// got its newline not having run.
    End,
}

/// Reads one line, holding at most `max` bytes of it. After `TooLong` the rest of that line is still unread.
pub(super) fn read_line(reader: &mut impl BufRead, max: usize) -> io::Result<Line> {
    let mut line = Vec::new();
    reader
        .by_ref()
        .take(max as u64 + 1)
        .read_until(b'\n', &mut line)?;
    if line.last() == Some(&b'\n') {
        line.pop();
        Ok(Line::Complete(line))
    } else if line.len() > max {
        Ok(Line::TooLong)
    } else {
        Ok(Line::End)
    }
}

/// A line and its newline in one write, so a write that fails means the newline was never sent.
pub(super) fn write_line(writer: &mut impl Write, line: &[u8]) -> io::Result<()> {
    let mut message = Vec::with_capacity(line.len() + 1);
    message.extend_from_slice(line);
    message.push(b'\n');
    writer.write_all(&message)?;
    writer.flush()
}

/// What isn't UTF-8 isn't JSON: the empty text gets the same parse error from `handle_line`.
pub(super) fn line_text(line: &[u8]) -> &str {
    std::str::from_utf8(line).unwrap_or("")
}

/// The answer to a line over the limit. Its id was never read, so it's null.
pub(super) fn too_long_reply() -> String {
    json!({"jsonrpc": "2.0", "id": null, "error": {"code": -32600, "message": "Line too long"}})
        .to_string()
}

/// To stderr, never stdout, which is the client's in the bridge. Not `eprintln!`, which panics when stderr is closed.
pub(super) fn log(message: std::fmt::Arguments) {
    let _ = writeln!(io::stderr(), "fastmemo mcp: {message}");
}

/// A socket path short enough for macOS (104 bytes, and its temp dir is already long), removed at the end of a test.
#[cfg(all(test, unix))]
pub(super) mod test_socket {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT: AtomicUsize = AtomicUsize::new(0);

    pub(in crate::mcp) struct TempSocket {
        root: PathBuf,
        pub(in crate::mcp) path: PathBuf,
    }

    impl TempSocket {
        pub(in crate::mcp) fn new() -> TempSocket {
            let n = NEXT.fetch_add(1, Ordering::SeqCst);
            let root = PathBuf::from(format!("/tmp/fm-mcp-{}-{n}", std::process::id()));
            let path = root.join("mcp").join("sock");
            TempSocket { root, path }
        }
    }

    impl Drop for TempSocket {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn line_of(reader: &mut Cursor<Vec<u8>>, max: usize) -> Line {
        read_line(reader, max).unwrap()
    }

    #[test]
    fn a_line_at_the_limit_is_whole_and_one_over_it_stops_reading_there() {
        let mut at_limit = Cursor::new(b"abcd\nnext\n".to_vec());
        assert!(matches!(line_of(&mut at_limit, 4), Line::Complete(line) if line == b"abcd"));
        assert!(matches!(line_of(&mut at_limit, 4), Line::Complete(line) if line == b"next"));
        assert!(matches!(line_of(&mut at_limit, 4), Line::End));

        let mut over = Cursor::new(vec![b'x'; 1000]);
        assert!(matches!(line_of(&mut over, 4), Line::TooLong));
        // Never holds what's past the limit, however long the line.
        assert_eq!(over.position(), 5);
    }

    #[test]
    fn a_line_without_its_newline_doesnt_count() {
        let mut cut = Cursor::new(b"{\"id\":1}".to_vec());
        assert!(matches!(line_of(&mut cut, 100), Line::End));
    }

    #[cfg(unix)]
    mod on_a_socket {
        use super::super::test_socket::TempSocket;
        use super::super::*;
        use crate::mcp::protocol::ToolOutcome;
        use crate::mcp::tools::Tool;
        use serde_json::{json, Value};
        use std::fs;
        use std::io::{BufRead, BufReader, ErrorKind, Write};
        use std::os::unix::fs::PermissionsExt;
        use std::os::unix::net::{UnixListener, UnixStream};
        use std::sync::mpsc;
        use std::sync::{Arc, Mutex};
        use std::time::{Duration, Instant};

        const PATIENCE: Duration = Duration::from_secs(5);

        /// Counts its own calls, so a runner shared between connections would show.
        #[derive(Default)]
        struct Counting {
            calls: usize,
        }

        impl ToolRunner for Counting {
            fn listed(&self) -> Vec<Tool> {
                Tool::ALL.to_vec()
            }
            fn call(&mut self, _tool: Tool, _args: Value) -> ToolOutcome {
                self.calls += 1;
                ToolOutcome {
                    text: self.calls.to_string(),
                    is_error: false,
                }
            }
        }

        fn start(path: &Path) -> ServerHandle {
            serve(path, || Box::new(Counting::default()), "1.0.0".to_string()).unwrap()
        }

        struct Client {
            reader: BufReader<UnixStream>,
        }

        impl Client {
            fn connect(path: &Path) -> Client {
                let stream = UnixStream::connect(path).unwrap();
                // A test that goes wrong fails instead of hanging.
                stream.set_read_timeout(Some(PATIENCE)).unwrap();
                Client {
                    reader: BufReader::new(stream),
                }
            }

            fn send(&mut self, bytes: &[u8]) {
                self.reader.get_mut().write_all(bytes).unwrap();
            }

            fn reply(&mut self) -> Value {
                let mut line = String::new();
                self.reader.read_line(&mut line).unwrap();
                assert!(line.ends_with('\n'), "not a whole line: {line:?}");
                serde_json::from_str(&line).unwrap()
            }

            fn ask(&mut self, request: Value) -> Value {
                self.send(format!("{request}\n").as_bytes());
                self.reply()
            }

            fn assert_closed(&mut self) {
                let mut rest = String::new();
                match self.reader.read_line(&mut rest) {
                    Ok(0) => {}
                    Err(err)
                        if !matches!(err.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
                    other => panic!("still open: {other:?}, {rest:?}"),
                }
            }
        }

        fn list() -> Value {
            json!({"jsonrpc":"2.0","id":1,"method":"tools/list"})
        }

        fn call() -> Value {
            json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"fastmemo_help","arguments":{}}})
        }

        fn text(reply: &Value) -> &str {
            reply["result"]["content"][0]["text"].as_str().unwrap()
        }

        #[test]
        fn socket_directory_is_user_only() {
            // Created here, and one that something else left too open.
            for loose in [false, true] {
                let socket = TempSocket::new();
                let dir = socket.path.parent().unwrap();
                if loose {
                    fs::create_dir_all(dir).unwrap();
                    fs::set_permissions(dir, fs::Permissions::from_mode(0o755)).unwrap();
                }
                let server = start(&socket.path);
                assert_eq!(
                    fs::metadata(dir).unwrap().permissions().mode() & 0o777,
                    0o700
                );
                server.stop();
            }
        }

        #[test]
        fn a_stale_socket_file_doesnt_block_start() {
            let socket = TempSocket::new();
            fs::create_dir_all(socket.path.parent().unwrap()).unwrap();
            drop(UnixListener::bind(&socket.path).unwrap());
            assert!(socket.path.exists());

            let server = start(&socket.path);
            let mut client = Client::connect(&socket.path);
            assert_eq!(
                client.ask(list())["result"]["tools"]
                    .as_array()
                    .unwrap()
                    .len(),
                9
            );
            server.stop();
        }

        #[test]
        fn two_clients_get_separate_runners() {
            let socket = TempSocket::new();
            let server = start(&socket.path);
            let mut first = Client::connect(&socket.path);
            let mut second = Client::connect(&socket.path);

            assert_eq!(text(&first.ask(call())), "1");
            assert_eq!(text(&first.ask(call())), "2");
            assert_eq!(text(&second.ask(call())), "1");
            assert_eq!(text(&first.ask(call())), "3");
            server.stop();
        }

        #[test]
        fn a_line_over_the_limit_is_refused_and_the_server_keeps_serving() {
            let socket = TempSocket::new();
            let server = start(&socket.path);
            let mut client = Client::connect(&socket.path);

            let mut writer = client.reader.get_ref().try_clone().unwrap();
            let sending = std::thread::spawn(move || {
                // The server hangs up mid-line, so this write is meant to fail.
                let _ = writer.write_all(&vec![b'x'; MAX_LINE_BYTES + 1024]);
            });
            let reply = client.reply();
            assert_eq!(reply["error"]["code"], -32600);
            assert_eq!(reply["id"], Value::Null);
            client.assert_closed();
            sending.join().unwrap();

            let mut next = Client::connect(&socket.path);
            assert_eq!(text(&next.ask(call())), "1");
            server.stop();
        }

        #[test]
        fn malformed_json_gets_32700_and_the_connection_stays() {
            let socket = TempSocket::new();
            let server = start(&socket.path);
            let mut client = Client::connect(&socket.path);

            client.send(b"{not json\n");
            assert_eq!(client.reply()["error"]["code"], -32700);
            // Not UTF-8 isn't JSON either.
            client.send(b"\xff\xfe\n");
            assert_eq!(client.reply()["error"]["code"], -32700);
            assert_eq!(text(&client.ask(call())), "1");
            server.stop();
        }

        #[test]
        fn a_line_cut_off_by_a_hangup_is_not_run() {
            let socket = TempSocket::new();
            let server = start(&socket.path);
            let mut client = Client::connect(&socket.path);

            client.send(call().to_string().as_bytes());
            client
                .reader
                .get_ref()
                .shutdown(std::net::Shutdown::Write)
                .unwrap();
            client.assert_closed();
            server.stop();
        }

        #[test]
        fn stop_removes_the_socket_and_refuses_clients() {
            let socket = TempSocket::new();
            let server = start(&socket.path);
            let mut live = Client::connect(&socket.path);
            assert_eq!(text(&live.ask(call())), "1");

            server.stop();

            assert!(!socket.path.exists());
            assert!(UnixStream::connect(&socket.path).is_err());
            // MCP off means off now, for a client already connected too.
            live.assert_closed();
            // Writes fail once its thread has let go: how the bridge finds out that a connection has died.
            let deadline = Instant::now() + PATIENCE;
            while live.reader.get_mut().write_all(b"{}\n").is_ok() {
                assert!(Instant::now() < deadline, "writes still accepted");
                std::thread::sleep(Duration::from_millis(1));
            }

            // Switched on again.
            let again = start(&socket.path);
            let mut client = Client::connect(&socket.path);
            assert_eq!(text(&client.ask(call())), "1");
            again.stop();
        }

        /// Stays in its call until told to leave.
        struct Stuck {
            started: mpsc::Sender<()>,
            release: Arc<Mutex<mpsc::Receiver<()>>>,
        }

        impl ToolRunner for Stuck {
            fn listed(&self) -> Vec<Tool> {
                Tool::ALL.to_vec()
            }
            fn call(&mut self, _tool: Tool, _args: Value) -> ToolOutcome {
                self.started.send(()).unwrap();
                let _ = self.release.lock().unwrap().recv();
                ToolOutcome {
                    text: "late".to_string(),
                    is_error: false,
                }
            }
        }

        #[test]
        fn a_running_call_doesnt_hold_up_stop() {
            let socket = TempSocket::new();
            let (started, call_started) = mpsc::channel();
            let (let_go, release) = mpsc::channel();
            let release = Arc::new(Mutex::new(release));
            let server = serve(
                &socket.path,
                move || {
                    Box::new(Stuck {
                        started: started.clone(),
                        release: release.clone(),
                    })
                },
                "1.0.0".to_string(),
            )
            .unwrap();
            let mut client = Client::connect(&socket.path);
            client.send(format!("{}\n", call()).as_bytes());
            call_started.recv_timeout(PATIENCE).unwrap();

            let (stopped, has_stopped) = mpsc::channel();
            std::thread::spawn(move || {
                server.stop();
                stopped.send(()).unwrap();
            });
            let outcome = has_stopped.recv_timeout(PATIENCE);
            let _ = let_go.send(());
            outcome.expect("stop waited for the running call");
            assert!(!socket.path.exists());
        }
    }
}
