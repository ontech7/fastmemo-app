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

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

use page::{PageCalls, PageReply, PAGE_TIMEOUT};
use protocol::{ToolOutcome, ToolRunner};
use server::ServerHandle;
use session::{Session, WriteLimit};
use settings::McpSettings;
use tools::{listed_tools, Tool};

/// The event the page answers requests on (`src/libs/mcp/bridge.web.ts`).
pub const REQUEST_EVENT: &str = "fastmemo://mcp-request";

const TOO_MANY_WRITES_IN_A_MINUTE: &str =
    "There have been too many changes in a minute: wait a moment before making another.";
const TOO_MANY_WRITES_IN_AN_HOUR: &str =
    "There have been too many changes in an hour: stop making changes, and try again later.";

/// What an agent is told when a write goes over a limit: true of that limit, and of what to do.
fn too_many_writes(limit: WriteLimit) -> &'static str {
    match limit {
        WriteLimit::Minute => TOO_MANY_WRITES_IN_A_MINUTE,
        WriteLimit::Hour => TOO_MANY_WRITES_IN_AN_HOUR,
    }
}

/// What the MCP server keeps while the app runs.
#[derive(Default)]
pub struct McpState {
    /// Read at each call, so a switch applies from the next one.
    settings: Mutex<McpSettings>,
    calls: PageCalls,
    server: Mutex<Option<ServerHandle>>,
    /// One start or stop at a time: two at once could leave a server running that nothing can stop.
    switching: Mutex<()>,
    /// One `apply_settings` at a time: its file write, settings swap and start or stop are one step, or two quick changes could
    /// leave the server running while the settings say off. Apart from `switching`, which `start` and `stop` take inside it.
    applying: Mutex<()>,
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
    if tool.writes() {
        if let Err(limit) = session.allow_write(Instant::now()) {
            return ToolOutcome {
                text: too_many_writes(limit).to_string(),
                is_error: true,
            };
        }
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

/// The settings the page shows: what's in force now.
#[tauri::command]
pub fn mcp_get_settings(app: AppHandle) -> McpSettings {
    app.state::<McpState>().settings.lock().unwrap().clone()
}

/// Saves the page's switches and applies them: the server starts when MCP went on and stops when it went off, and is left
/// alone when `enabled` didn't change. A start that fails comes back as the error; the switch stays saved on, and the next
/// launch tries again. Off the main thread, since a start or a stop can wait a moment.
#[tauri::command]
pub async fn mcp_set_settings(app: AppHandle, settings: McpSettings) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || apply_settings(&app, settings))
        .await
        .map_err(|err| err.to_string())?
}

fn apply_settings(app: &AppHandle, settings: McpSettings) -> Result<(), String> {
    let state = app.state::<McpState>();
    let _applying = state.applying.lock().unwrap();
    let path = settings_path(app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|err| err.to_string())?;
    }
    settings.save(&path).map_err(|err| err.to_string())?;
    let enabled = settings.enabled;
    let was_enabled = std::mem::replace(&mut *state.settings.lock().unwrap(), settings).enabled;
    let started = if enabled && !was_enabled {
        start(app)
    } else {
        if !enabled && was_enabled {
            stop(app);
        }
        Ok(())
    };
    // The icon follows the switches saved, a start that failed or not.
    crate::tray::sync(app);
    started
}

/// What an AI client needs to launch this app, and whether that's likely to keep working.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    /// The executable the client runs with `--mcp`.
    pub path: String,
    /// macOS: the app runs from outside the Applications folders, so the path may not last.
    pub moved: bool,
    pub platform: String,
}

#[tauri::command]
pub fn mcp_connection_info() -> ConnectionInfo {
    // An AppImage runs from a temporary mount: the file the user keeps is $APPIMAGE.
    let appimage = if cfg!(target_os = "linux") {
        std::env::var("APPIMAGE").ok().filter(|path| !path.is_empty())
    } else {
        None
    };
    let path = appimage.unwrap_or_else(|| {
        std::env::current_exe()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_default()
    });
    let moved = cfg!(target_os = "macos")
        && !in_applications(&path, std::env::var("HOME").ok().as_deref());
    ConnectionInfo {
        path,
        moved,
        platform: std::env::consts::OS.to_string(),
    }
}

/// Whether the path is under `/Applications/` or the user's `~/Applications/`.
fn in_applications(path: &str, home: Option<&str>) -> bool {
    path.starts_with("/Applications/")
        || home
            .filter(|home| !home.is_empty())
            .is_some_and(|home| path.starts_with(&format!("{}/Applications/", home.trim_end_matches('/'))))
}

/// At launch: reads the switches and, with MCP on, starts the server. Off the main thread, since a start can wait a moment.
pub fn launch(app: &AppHandle) {
    let settings = settings_path(app)
        .map(|path| McpSettings::load(&path))
        .unwrap_or_default();
    let enabled = settings.enabled;
    *app.state::<McpState>().settings.lock().unwrap() = settings;
    crate::tray::sync(app);
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
    fn only_the_applications_folders_keep_the_app_in_place() {
        let app = "Fast Memo.app/Contents/MacOS/Fast Memo";
        assert!(in_applications(&format!("/Applications/{app}"), Some("/Users/a")));
        assert!(in_applications(&format!("/Users/a/Applications/{app}"), Some("/Users/a")));
        assert!(in_applications(&format!("/Users/a/Applications/{app}"), Some("/Users/a/")));
        assert!(!in_applications(&format!("/Users/a/Downloads/{app}"), Some("/Users/a")));
        assert!(!in_applications(&format!("/Volumes/Fast Memo/{app}"), Some("/Users/a")));
        assert!(!in_applications(&format!("/Users/b/Applications/{app}"), Some("/Users/a")));
        // No home: only the system folder counts, and an empty home matches nothing.
        assert!(!in_applications(&format!("/Users/a/Applications/{app}"), None));
        assert!(!in_applications("/Applications", Some("")));
        assert!(!in_applications("/ApplicationsX/app", Some("")));
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
    fn each_limit_tells_the_agent_its_own_wait() {
        let minute = too_many_writes(WriteLimit::Minute);
        let hour = too_many_writes(WriteLimit::Hour);
        assert!(minute.contains("in a minute") && minute.contains("wait a moment"));
        assert!(hour.contains("in an hour") && hour.contains("later"));
        assert!(!hour.contains("a moment"));
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
