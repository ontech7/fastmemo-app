//! The relay to the app's page, which holds the notes: a request goes out as an event, the answer comes back through a command.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::session::EditScope;
use super::tools::Tool;

pub const PAGE_TIMEOUT: Duration = Duration::from_secs(10);

/// The page may still act on a call it never answered in time, so the agent is told to look before trying again.
const NOT_RESPONDING: &str =
    "Fast Memo isn't responding: open its window, and check before retrying, since this call may still run.";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageReply {
    pub text: String,
    pub is_error: bool,
    pub created_id: Option<String>,
}

impl PageReply {
    fn error(text: String) -> PageReply {
        PageReply {
            text,
            is_error: true,
            created_id: None,
        }
    }
}

/// The calls waiting for the page, by id.
#[derive(Default)]
pub struct PageCalls {
    next_id: AtomicU64,
    waiting: Mutex<HashMap<u64, Sender<PageReply>>>,
}

impl PageCalls {
    /// Sends a request with `emit` and waits for `reply` to bring its answer, for up to `timeout`.
    pub fn call(
        &self,
        emit: impl Fn(Value) -> Result<(), String>,
        tool: Tool,
        args: Value,
        scope: EditScope,
        timeout: Duration,
    ) -> PageReply {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (answer, answered) = mpsc::channel();
        self.waiting.lock().unwrap().insert(id, answer);

        let request = json!({"id": id, "tool": tool.name(), "args": args, "scope": scope});
        let reply = match emit(request) {
            Ok(()) => answered
                .recv_timeout(timeout)
                .unwrap_or_else(|_| PageReply::error(NOT_RESPONDING.to_string())),
            Err(reason) => {
                PageReply::error(format!("Fast Memo's window can't be reached: {reason}"))
            }
        };
        self.waiting.lock().unwrap().remove(&id);
        reply
    }

    /// An answer nobody waits for (it came too late, or its id means nothing) goes nowhere.
    pub fn reply(&self, id: u64, reply: PageReply) {
        if let Some(answer) = self.waiting.lock().unwrap().remove(&id) {
            let _ = answer.send(reply);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    const PATIENCE: Duration = Duration::from_secs(5);
    const NO_PATIENCE: Duration = Duration::from_millis(10);

    fn scope() -> EditScope {
        EditScope {
            edit_all: false,
            owned_ids: vec!["mine".to_string()],
        }
    }

    fn answer(text: &str) -> PageReply {
        PageReply {
            text: text.to_string(),
            is_error: false,
            created_id: None,
        }
    }

    fn id_of(request: &Value) -> u64 {
        request["id"].as_u64().unwrap()
    }

    #[test]
    fn a_reply_in_time_is_returned() {
        let calls = Arc::new(PageCalls::default());
        let replying = calls.clone();
        let reply = calls.call(
            move |request| {
                // From another thread, as the command does.
                let calls = replying.clone();
                thread::spawn(move || calls.reply(id_of(&request), answer("from the page")));
                Ok(())
            },
            Tool::ReadNote,
            json!({"id": "x"}),
            scope(),
            PATIENCE,
        );
        assert_eq!(reply.text, "from the page");
        assert!(!reply.is_error);
    }

    #[test]
    fn the_request_says_what_the_page_needs() {
        let calls = PageCalls::default();
        let sent = std::sync::Mutex::new(None);
        calls.call(
            |request| {
                *sent.lock().unwrap() = Some(request);
                Ok(())
            },
            Tool::ReadNote,
            json!({"id": "x"}),
            scope(),
            NO_PATIENCE,
        );
        let sent = sent.into_inner().unwrap().unwrap();
        assert!(sent["id"].is_u64());
        assert_eq!(sent["tool"], "fastmemo_read_note");
        assert_eq!(sent["args"], json!({"id": "x"}));
        assert_eq!(
            sent["scope"],
            json!({"editAll": false, "ownedIds": ["mine"]})
        );
    }

    #[test]
    fn no_reply_is_an_error_saying_fast_memo_isnt_responding() {
        let calls = PageCalls::default();
        let reply = calls.call(|_| Ok(()), Tool::ReadNote, json!({}), scope(), NO_PATIENCE);
        assert!(reply.is_error);
        assert!(reply.text.contains("isn't responding"), "{}", reply.text);
        assert_eq!(reply.created_id, None);
        assert!(calls.waiting.lock().unwrap().is_empty());
    }

    #[test]
    fn a_reply_with_an_unknown_id_is_ignored() {
        let calls = PageCalls::default();
        let reply = calls.call(
            |request| {
                calls.reply(id_of(&request) + 1, answer("for someone else"));
                Ok(())
            },
            Tool::ReadNote,
            json!({}),
            scope(),
            NO_PATIENCE,
        );
        assert!(reply.is_error);
        assert!(reply.text.contains("isn't responding"), "{}", reply.text);
    }

    #[test]
    fn a_reply_after_the_timeout_goes_nowhere() {
        let calls = PageCalls::default();
        let id = std::cell::Cell::new(0);
        calls.call(
            |request| {
                id.set(id_of(&request));
                Ok(())
            },
            Tool::ReadNote,
            json!({}),
            scope(),
            NO_PATIENCE,
        );
        calls.reply(id.get(), answer("too late"));
        assert!(calls.waiting.lock().unwrap().is_empty());
    }

    #[test]
    fn an_emit_failure_is_an_error() {
        let calls = PageCalls::default();
        let reply = calls.call(
            |_| Err("no window".to_string()),
            Tool::ReadNote,
            json!({}),
            scope(),
            PATIENCE,
        );
        assert!(reply.is_error);
        assert!(reply.text.contains("no window"), "{}", reply.text);
        assert!(calls.waiting.lock().unwrap().is_empty());
    }

    #[test]
    fn calls_at_the_same_time_each_get_their_own_answer() {
        let calls = Arc::new(PageCalls::default());
        let threads: Vec<_> = (0..8)
            .map(|n| {
                let calls = calls.clone();
                thread::spawn(move || {
                    let replying = calls.clone();
                    let reply = calls.call(
                        move |request| {
                            let calls = replying.clone();
                            thread::spawn(move || {
                                let id = id_of(&request);
                                calls.reply(id, answer(&request["args"]["n"].to_string()));
                            });
                            Ok(())
                        },
                        Tool::ReadNote,
                        json!({"n": n}),
                        scope(),
                        PATIENCE,
                    );
                    assert_eq!(reply.text, n.to_string());
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
    }

    #[test]
    fn a_reply_reads_as_the_page_sends_it() {
        let plain: PageReply =
            serde_json::from_value(json!({"text": "ok", "isError": false})).unwrap();
        assert_eq!(plain.text, "ok");
        assert!(!plain.is_error);
        assert_eq!(plain.created_id, None);

        let created: PageReply =
            serde_json::from_value(json!({"text": "ok", "isError": true, "createdId": "abc"}))
                .unwrap();
        assert!(created.is_error);
        assert_eq!(created.created_id.as_deref(), Some("abc"));
    }
}
