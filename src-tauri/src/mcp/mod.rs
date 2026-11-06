//! Local MCP server: the JSON-RPC protocol, the tool definitions, the per-device switches and the session rights, the local
//! socket with its server, the stdio bridge an AI client starts (`--mcp`), and the relay to the app's page, which holds the notes.

pub mod bridge;
pub mod endpoint;
pub mod page;
pub mod protocol;
pub mod server;
pub mod session;
pub mod settings;
pub mod tools;

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

use page::{PageCalls, PageReply, PAGE_TIMEOUT};
use protocol::{ToolOutcome, ToolRunner};
use server::ServerHandle;
use session::Session;
use settings::McpSettings;
use tools::{listed_tools, Tool};

/// The event the page answers requests on (`src/libs/mcp/bridge.web.ts`).
pub const REQUEST_EVENT: &str = "fastmemo://mcp-request";

const TOO_MANY_WRITES: &str =
    "There have been too many changes in a minute: wait a moment before making another.";

/// What the MCP server keeps while the app runs.
#[derive(Default)]
pub struct McpState {
    /// Read at each call, so a switch applies from the next one.
    settings: Mutex<McpSettings>,
    calls: PageCalls,
    server: Mutex<Option<ServerHandle>>,
    /// One start or stop at a time: two at once could leave a server running that nothing can stop.
    switching: Mutex<()>,
}

/// One connection: its session, and the way to the page.
struct AppRunner {
    app: AppHandle,
    session: Session,
}

impl ToolRunner for AppRunner {
    fn listed(&self) -> Vec<Tool> {
        listed_tools(&self.app.state::<McpState>().settings.lock().unwrap())
    }

    fn call(&mut self, tool: Tool, args: Value) -> ToolOutcome {
        let state = self.app.state::<McpState>();
        let settings = state.settings.lock().unwrap().clone();
        let app = &self.app;
        run_on_page(
            &mut self.session,
            &settings,
            &state.calls,
            |request| {
                app.emit_to("main", REQUEST_EVENT, request)
                    .map_err(|err| err.to_string())
            },
            tool,
            args,
        )
    }
}

fn run_on_page(
    session: &mut Session,
    settings: &McpSettings,
    calls: &PageCalls,
    emit: impl Fn(Value) -> Result<(), String>,
    tool: Tool,
    args: Value,
) -> ToolOutcome {
    if tool.writes() && !session.allow_write(Instant::now()) {
        return ToolOutcome {
            text: TOO_MANY_WRITES.to_string(),
            is_error: true,
        };
    }
    let reply = calls.call(emit, tool, args, session.scope(settings), PAGE_TIMEOUT);
    if let Some(id) = reply.created_id {
        session.own(id);
    }
    ToolOutcome {
        text: reply.text,
        is_error: reply.is_error,
    }
}

/// The page's answer to a request.
#[tauri::command]
pub fn mcp_reply(app: AppHandle, id: u64, reply: PageReply) {
    app.state::<McpState>().calls.reply(id, reply);
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(dir.join("mcp.json"))
}

/// At launch: reads the switches and, with MCP on, starts the server. Off the main thread, since a start can wait a moment.
pub fn launch(app: &AppHandle) {
    let settings = settings_path(app)
        .map(|path| McpSettings::load(&path))
        .unwrap_or_default();
    let enabled = settings.enabled;
    *app.state::<McpState>().settings.lock().unwrap() = settings;
    if enabled {
        let app = app.clone();
        std::thread::spawn(move || {
            if let Err(err) = start(&app) {
                server::log(format_args!("the MCP server didn't start: {err}"));
            }
        });
    }
}

/// Starts the server. One already running stops first: its stop would wake the new listener and remove the new socket.
pub fn start(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<McpState>();
    let _switching = state.switching.lock().unwrap();
    stop_running(&state);
    let socket = endpoint::endpoint_for(&app.config().identifier)?;
    let runners = app.clone();
    let server = server::serve(
        &socket,
        move || {
            Box::new(AppRunner {
                app: runners.clone(),
                session: Session::default(),
            })
        },
        app.package_info().version.to_string(),
    )
    .map_err(|err| err.to_string())?;
    *state.server.lock().unwrap() = Some(server);
    Ok(())
}

/// Stops the server, if it's running. This can wait a moment: not on the main thread while that matters.
pub fn stop(app: &AppHandle) {
    let state = app.state::<McpState>();
    let _switching = state.switching.lock().unwrap();
    stop_running(&state);
}

fn stop_running(state: &McpState) {
    let running = state.server.lock().unwrap().take();
    if let Some(server) = running {
        server.stop();
    }
}

/// The bridge (`--mcp`) on the real stdin and stdout, to this build's own socket. Starts no part of Tauri. Without a usable
/// path it still answers, as with the app away. Returns the process's exit code.
pub fn run_bridge() -> i32 {
    let context = crate::context();
    let socket = endpoint::endpoint_for(&context.config().identifier);
    let version = context.package_info().version.to_string();
    let connect = || match &socket {
        Ok(path) => endpoint::connect(path),
        Err(reason) => Err(std::io::Error::other(reason.clone())),
    };
    bridge::relay(std::io::stdin().lock(), std::io::stdout().lock(), connect, &version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::page::PageReply;
    use crate::mcp::session::WRITES_PER_MINUTE;
    use serde_json::json;
    use std::cell::RefCell;

    /// Answers every request at once, and keeps what it was sent.
    struct Page {
        calls: PageCalls,
        sent: RefCell<Vec<Value>>,
        answer: PageReply,
    }

    impl Page {
        fn answering(created_id: Option<&str>) -> Page {
            Page {
                calls: PageCalls::default(),
                sent: RefCell::default(),
                answer: PageReply {
                    text: "done".to_string(),
                    is_error: false,
                    created_id: created_id.map(str::to_string),
                },
            }
        }

        fn run(&self, session: &mut Session, settings: &McpSettings, tool: Tool) -> ToolOutcome {
            run_on_page(
                session,
                settings,
                &self.calls,
                |request| {
                    let id = request["id"].as_u64().unwrap();
                    self.sent.borrow_mut().push(request);
                    self.calls.reply(
                        id,
                        PageReply {
                            text: self.answer.text.clone(),
                            is_error: self.answer.is_error,
                            created_id: self.answer.created_id.clone(),
                        },
                    );
                    Ok(())
                },
                tool,
                json!({}),
            )
        }
    }

    #[test]
    fn a_call_carries_the_pages_answer() {
        let page = Page::answering(None);
        let outcome = page.run(
            &mut Session::default(),
            &McpSettings::default(),
            Tool::ReadNote,
        );
        assert_eq!(outcome.text, "done");
        assert!(!outcome.is_error);
    }

    #[test]
    fn a_write_over_the_cap_is_refused_without_reaching_the_page() {
        let page = Page::answering(None);
        let mut session = Session::default();
        let settings = McpSettings::default();
        for _ in 0..WRITES_PER_MINUTE {
            assert!(
                !page
                    .run(&mut session, &settings, Tool::SetNoteFlags)
                    .is_error
            );
        }
        assert_eq!(page.sent.borrow().len(), WRITES_PER_MINUTE);

        let refused = page.run(&mut session, &settings, Tool::CreateNote);
        assert!(refused.is_error);
        assert!(
            refused.text.contains("too many changes"),
            "{}",
            refused.text
        );
        assert_eq!(page.sent.borrow().len(), WRITES_PER_MINUTE);

        // Reading goes on.
        assert!(!page.run(&mut session, &settings, Tool::ReadNote).is_error);
        assert_eq!(page.sent.borrow().len(), WRITES_PER_MINUTE + 1);
    }

    #[test]
    fn reads_have_no_cap() {
        let page = Page::answering(None);
        let mut session = Session::default();
        let settings = McpSettings::default();
        for _ in 0..=WRITES_PER_MINUTE {
            assert!(
                !page
                    .run(&mut session, &settings, Tool::SearchNotes)
                    .is_error
            );
        }
        // Nor do they use up what writes may do.
        assert!(!page.run(&mut session, &settings, Tool::CreateNote).is_error);
    }

    #[test]
    fn a_created_note_belongs_to_the_session_from_the_next_call() {
        let page = Page::answering(Some("new-note"));
        let mut session = Session::default();
        let settings = McpSettings::default();

        page.run(&mut session, &settings, Tool::CreateNote);
        page.run(&mut session, &settings, Tool::EditNote);

        let sent = page.sent.borrow();
        assert_eq!(sent[0]["scope"]["ownedIds"], json!([]));
        assert_eq!(sent[1]["scope"]["ownedIds"], json!(["new-note"]));
    }

    #[test]
    fn the_scope_follows_the_settings_of_this_call() {
        let page = Page::answering(None);
        let mut session = Session::default();
        let mut settings = McpSettings::default();

        page.run(&mut session, &settings, Tool::EditNote);
        settings
            .tools
            .insert(Tool::EditNote.name().to_string(), true);
        page.run(&mut session, &settings, Tool::EditNote);

        let sent = page.sent.borrow();
        assert_eq!(sent[0]["scope"]["editAll"], false);
        assert_eq!(sent[1]["scope"]["editAll"], true);
    }
}
