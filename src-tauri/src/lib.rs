use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(target_os = "macos")]
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use std::time::Instant;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_window_state::StateFlags;

mod net;

/// Prompt the OS biometric dialog (Touch ID on macOS, Windows Hello on Windows)
/// and report whether it succeeded. Used by the frontend's web/Tauri unlock path
/// to gate access to protected notes without the secret code. `reason` is the
/// localized message shown in the system prompt.
///
/// The system dialog is synchronous, so the blocking call is offloaded to the
/// blocking pool to keep the async runtime free. Any failure (cancel, no
/// enrolled biometric, unsupported hardware) resolves to `Ok(false)` so the
/// frontend can fall back to the secret-code prompt.
#[cfg(any(target_os = "macos", target_os = "windows"))]
#[tauri::command]
async fn biometric_authenticate(reason: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use robius_authentication::{
            AndroidText, BiometricStrength, Context, Policy, PolicyBuilder, Text, WindowsText,
        };

        let policy: Policy = PolicyBuilder::new()
            .biometrics(Some(BiometricStrength::Strong))
            .password(true) // allow the system password as a fallback factor
            .build()
            .ok_or_else(|| "failed to build authentication policy".to_string())?;

        let windows = WindowsText::new("Fast Memo", &reason)
            .ok_or_else(|| "invalid biometric prompt text".to_string())?;
        let text = Text {
            android: AndroidText {
                title: "Fast Memo",
                subtitle: None,
                description: None,
            },
            apple: &reason,
            windows,
        };

        Ok(Context::new(()).blocking_authenticate(text, &policy).is_ok())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Linux stub: biometrics are unsupported there (no `robius-authentication`), so
/// the command always reports failure and the frontend falls back to the secret
/// code. Kept registered so `invoke_handler` is identical across platforms.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
async fn biometric_authenticate(_reason: String) -> Result<bool, String> {
    Ok(false)
}

// Note edits are committed to storage in batches (ADR-013), so the latest ones may only be in the webview's memory when
// the app quits. A quit from the window (close button on Windows/Linux) or the app menu (Cmd+Q) first asks the frontend to
// flush (`src/libs/flushOnExit.web.ts`) and exits once it reports back, or after FLUSH_TIMEOUT if a write hangs. On macOS
// closing the window only hides it (`hide_main`), and the frontend flushes meanwhile.
// Not covered: quits that bypass the event loop (macOS Dock Quit and logout, a Windows/Linux session ending) exit at once,
// losing at most the edit batch still open (ADR-015). On macOS that is a quit while the window is open: a hidden one was
// flushed when it was closed.

/// The event the frontend flushes on.
const FLUSH_EVENT: &str = "fastmemo://flush-before-exit";
/// The longest a quit waits for the frontend.
const FLUSH_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Default)]
struct ExitState {
    requested: AtomicBool,
}

fn flush_then_exit(app: &AppHandle) {
    if app.state::<ExitState>().requested.swap(true, Ordering::SeqCst) {
        return;
    }
    if app.emit_to("main", FLUSH_EVENT, ()).is_err() {
        app.exit(0);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(FLUSH_TIMEOUT);
        app.exit(0);
    });
}

/// Called by the frontend once its writes are done.
#[tauri::command]
fn exit_after_flush(app: AppHandle) {
    app.exit(0);
}

// The window opens hidden (`visible: false` in tauri.conf.json): until the frontend has drawn its first screen it would
// be an empty dark rectangle. The frontend says when (`window_ready`); if it never does (it failed to load), the window
// shows after SHOW_FALLBACK anyway.

/// The longest the window stays hidden at launch.
const SHOW_FALLBACK: Duration = Duration::from_secs(5);

/// Whether the window was shown once: the first screen, the fallback, a second launch, the Dock.
#[derive(Default)]
struct WindowShown(AtomicBool);

/// Shows the window as the user left it. `focus`: bring the app to the front, for what the user just asked (the Dock, a
/// second launch, a menu command); not for the launch's first show, which could come after the user moved on to another
/// app (a slow start).
fn show_main(app: &AppHandle, focus: bool) {
    // A closing full screen window asked back during its animation stays (`left_fullscreen`).
    #[cfg(target_os = "macos")]
    {
        *app.state::<LeavingFullscreen>().0.lock().unwrap() = None;
    }
    if let Some(window) = app.get_webview_window("main") {
        app.state::<WindowShown>().0.store(true, Ordering::SeqCst);
        // macOS: a closed (hidden) or minimized window comes back on the Space (desktop) the user is on, not on the one it was
        // closed on, which macOS would switch to. On every Space while it's shown, then back on one: the current one, at its
        // place and size. A window still on screen on another Space is left to macOS.
        #[cfg(target_os = "macos")]
        let hidden = !window.is_visible().unwrap_or(true);
        #[cfg(target_os = "macos")]
        if hidden {
            let _ = window.set_visible_on_all_workspaces(true);
        }
        let _ = window.unminimize();
        let _ = window.show();
        if focus {
            let _ = window.set_focus();
        }
        #[cfg(target_os = "macos")]
        if hidden {
            let _ = window.set_visible_on_all_workspaces(false);
        }
    }
}

/// Called by the frontend once its first screen is drawn (`src/libs/windowReady.web.ts`). Only the launch's first show
/// counts: after a reload (F5) the window stays as it is.
#[tauri::command]
fn window_ready(app: AppHandle) {
    if !app.state::<WindowShown>().0.load(Ordering::SeqCst) {
        show_main(&app, false);
    }
}

/// The event the frontend flushes on without quitting: the window was closed, the app goes on in the background.
#[cfg(target_os = "macos")]
const HIDDEN_EVENT: &str = "fastmemo://hidden";

/// macOS: closing the window leaves the app running, as Notes does (the Dock keeps its dot, a click on it brings the
/// window back as it was); Quit ends it. The frontend writes pending edits right away, as on a quit (the app goes on
/// running: no need to wait for it).
#[cfg(target_os = "macos")]
fn hide_main(window: &tauri::Window) {
    let _ = window.app_handle().emit_to("main", HIDDEN_EVENT, ());
    if !window.is_fullscreen().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    // A full screen window hidden as it is leaves its Space black: out of full screen first, hidden as that animation
    // ends (`left_fullscreen`). Not before: macOS puts the window back on screen then.
    let since = Instant::now();
    *window.state::<LeavingFullscreen>().0.lock().unwrap() = Some(since);
    let _ = window.set_fullscreen(false);
    let window = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(LEAVE_FULLSCREEN_MAX);
        let state = window.state::<LeavingFullscreen>();
        let current = {
            let mut leaving = state.0.lock().unwrap();
            let current = *leaving == Some(since);
            if current {
                *leaving = None;
            }
            current
        };
        if current {
            let _ = window.hide();
        }
    });
}

/// macOS: when a full screen window being closed was asked out of full screen; None once hidden for good, or asked back
/// (`show_main`).
#[cfg(target_os = "macos")]
#[derive(Default)]
struct LeavingFullscreen(Mutex<Option<Instant>>);

/// The window is resized (and focused) as the animation out of full screen starts and again as it ends (~0.6 s later):
/// an event this long after the start is the end.
#[cfg(target_os = "macos")]
const LEAVE_FULLSCREEN_END: Duration = Duration::from_millis(200);
/// How long a closing full screen window is kept hidden: past the end of the animation, whatever its events.
#[cfg(target_os = "macos")]
const LEAVE_FULLSCREEN_MAX: Duration = Duration::from_millis(2000);

/// A resize or focus of a window leaving full screen to be closed: from the end of the animation on, hide it, every time
/// macOS puts it back, until LEAVE_FULLSCREEN_MAX (`hide_main`).
#[cfg(target_os = "macos")]
fn left_fullscreen(window: &tauri::Window) {
    let leaving = *window.state::<LeavingFullscreen>().0.lock().unwrap();
    if leaving.is_some_and(|since| since.elapsed() >= LEAVE_FULLSCREEN_END) {
        let _ = window.hide();
    }
}

/// macOS: the window as the user had it out of full screen: its last ordinary (not zoomed) frame, and whether it was zoomed.
/// window-state saves a window quit in full screen as a zoomed one filling the screen; `save_windowed_frame` puts this back.
#[cfg(target_os = "macos")]
#[derive(Default)]
struct WindowedFrame(Mutex<Option<OrdinaryFrame>>);

/// As window-state saves a window: outer position, inner size.
#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
struct OrdinaryFrame {
    position: tauri::PhysicalPosition<i32>,
    size: tauri::PhysicalSize<u32>,
    zoomed: bool,
}

/// Records the window out of full screen: its frame if it's ordinary; only that it's zoomed if it is (window-state
/// restores a zoomed window from the frame it had before).
#[cfg(target_os = "macos")]
fn remember_windowed_frame(window: &tauri::Window) {
    if window.is_fullscreen().unwrap_or(true) || window.is_minimized().unwrap_or(true) {
        return;
    }
    let Ok(zoomed) = window.is_maximized() else {
        return;
    };
    let current = (window.outer_position(), window.inner_size());
    let state = window.state::<WindowedFrame>();
    let mut frame = state.0.lock().unwrap();
    if zoomed {
        if let Some(frame) = frame.as_mut() {
            frame.zoomed = true;
        }
    } else if let (Ok(position), Ok(size)) = current {
        *frame = Some(OrdinaryFrame {
            position,
            size,
            zoomed: false,
        });
    }
}

/// A quit in full screen: window-state has just saved the window (plugins see `RunEvent::Exit` first); its entry gets the
/// window as it was before full screen instead (its frame, zoomed or not), so the next launch opens that one.
#[cfg(target_os = "macos")]
fn save_windowed_frame(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Still in full screen, or leaving it to be hidden (Cmd+W then Cmd+Q): the plugin saved the full screen frame.
    let leaving = app.state::<LeavingFullscreen>().0.lock().unwrap().is_some();
    if !window.is_fullscreen().unwrap_or(false) && !leaving {
        return;
    }
    let Some(frame) = *app.state::<WindowedFrame>().0.lock().unwrap() else {
        return;
    };
    let Ok(dir) = app.path().app_config_dir() else {
        return;
    };
    let path = dir.join(tauri_plugin_window_state::DEFAULT_FILENAME);
    let Some(mut saved) = std::fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
    else {
        return;
    };
    let Some(main) = saved.get_mut("main").and_then(|entry| entry.as_object_mut()) else {
        return;
    };
    for (key, value) in [
        ("x", frame.position.x.into()),
        ("y", frame.position.y.into()),
        ("prev_x", frame.position.x.into()),
        ("prev_y", frame.position.y.into()),
        ("width", frame.size.width.into()),
        ("height", frame.size.height.into()),
        ("maximized", frame.zoomed.into()),
    ] {
        main.insert(key.to_string(), value);
    }
    if let Ok(bytes) = serde_json::to_vec_pretty(&saved) {
        let _ = std::fs::write(&path, bytes);
    }
}

/// The app menu's Quit item.
#[cfg(target_os = "macos")]
const QUIT_MENU_ID: &str = "quit";

/// The event a menu item's id goes out on; the frontend runs the matching command (`src/libs/desktopMenu.web.ts`).
#[cfg(target_os = "macos")]
const MENU_EVENT: &str = "fastmemo://menu";

/// The menu items the frontend acts on.
#[cfg(target_os = "macos")]
const MENU_COMMANDS: [&str; 9] = [
    "new-note",
    "new-text",
    "new-todo",
    "new-kanban",
    "new-code",
    "find",
    "settings",
    "export-import",
    "help",
];

/// The menu's labels, in the app's language (`set_menu_labels`); `{name}` stands for the app's name.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
struct MenuLabels {
    about: String,
    settings: String,
    services: String,
    hide: String,
    hide_others: String,
    show_all: String,
    quit: String,
    file: String,
    new_note: String,
    new_text: String,
    new_todo: String,
    new_kanban: String,
    new_code: String,
    export_import: String,
    close_window: String,
    edit: String,
    undo: String,
    redo: String,
    cut: String,
    copy: String,
    paste: String,
    select_all: String,
    find: String,
    view: String,
    fullscreen: String,
    window: String,
    minimize: String,
    zoom: String,
    help: String,
    help_item: String,
}

/// English, until the frontend sends its language's labels.
impl Default for MenuLabels {
    fn default() -> Self {
        let s = |text: &str| text.to_string();
        Self {
            about: s("About {name}"),
            settings: s("Settings…"),
            services: s("Services"),
            hide: s("Hide {name}"),
            hide_others: s("Hide Others"),
            show_all: s("Show All"),
            quit: s("Quit {name}"),
            file: s("File"),
            new_note: s("New Note"),
            new_text: s("New Text Note"),
            new_todo: s("New To-Do List"),
            new_kanban: s("New Kanban Board"),
            new_code: s("New Code Note"),
            export_import: s("Export/Import Data…"),
            close_window: s("Close Window"),
            edit: s("Edit"),
            undo: s("Undo"),
            redo: s("Redo"),
            cut: s("Cut"),
            copy: s("Copy"),
            paste: s("Paste"),
            select_all: s("Select All"),
            find: s("Find…"),
            view: s("View"),
            fullscreen: s("Enter Full Screen"),
            window: s("Window"),
            minimize: s("Minimize"),
            zoom: s("Zoom"),
            help: s("Help"),
            help_item: s("{name} Help"),
        }
    }
}

/// macOS: the menu bar. Windows and Linux have none (a light menu bar inside the dark window would clash; the keyboard
/// shortcuts cover New Note, Find and Settings there). Quit is a plain item, not the predefined one: that sends
/// `terminate:`, which ends the process without any event the app could hold, so this one goes through
/// `flush_then_exit`. The frontend handles the same keys as New Note, Find and Settings: a key the page handles doesn't
/// reach the menu, one it leaves alone does.
#[cfg(target_os = "macos")]
fn macos_menu(app: &AppHandle, labels: &MenuLabels) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{
        AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
    };

    let name = app.package_info().name.clone();
    let named = |label: &str| label.replace("{name}", &name);
    let about = AboutMetadata {
        name: Some(name.clone()),
        version: Some(app.package_info().version.to_string()),
        copyright: app.config().bundle.copyright.clone(),
        ..Default::default()
    };
    let item = |id: &str, label: &str, accelerator: Option<&str>| MenuItem::with_id(app, id, label, true, accelerator);

    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                &name,
                true,
                &[
                    &PredefinedMenuItem::about(app, Some(&named(&labels.about)), Some(about))?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("settings", &labels.settings, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, Some(&labels.services))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, Some(&named(&labels.hide)))?,
                    &PredefinedMenuItem::hide_others(app, Some(&labels.hide_others))?,
                    &PredefinedMenuItem::show_all(app, Some(&labels.show_all))?,
                    &PredefinedMenuItem::separator(app)?,
                    &item(QUIT_MENU_ID, &named(&labels.quit), Some("CmdOrCtrl+Q"))?,
                ],
            )?,
            &Submenu::with_items(
                app,
                &labels.file,
                true,
                &[
                    &item("new-note", &labels.new_note, Some("CmdOrCtrl+N"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("new-text", &labels.new_text, None)?,
                    &item("new-todo", &labels.new_todo, None)?,
                    &item("new-kanban", &labels.new_kanban, None)?,
                    &item("new-code", &labels.new_code, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("export-import", &labels.export_import, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, Some(&labels.close_window))?,
                ],
            )?,
            &Submenu::with_items(
                app,
                &labels.edit,
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some(&labels.undo))?,
                    &PredefinedMenuItem::redo(app, Some(&labels.redo))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some(&labels.cut))?,
                    &PredefinedMenuItem::copy(app, Some(&labels.copy))?,
                    &PredefinedMenuItem::paste(app, Some(&labels.paste))?,
                    &PredefinedMenuItem::select_all(app, Some(&labels.select_all))?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("find", &labels.find, Some("CmdOrCtrl+F"))?,
                ],
            )?,
            &Submenu::with_items(
                app,
                &labels.view,
                true,
                &[&PredefinedMenuItem::fullscreen(app, Some(&labels.fullscreen))?],
            )?,
            &Submenu::with_id_and_items(
                app,
                WINDOW_SUBMENU_ID,
                &labels.window,
                true,
                &[
                    &PredefinedMenuItem::minimize(app, Some(&labels.minimize))?,
                    &PredefinedMenuItem::maximize(app, Some(&labels.zoom))?,
                ],
            )?,
            &Submenu::with_id_and_items(
                app,
                HELP_SUBMENU_ID,
                &labels.help,
                true,
                &[&item("help", &named(&labels.help_item), None)?],
            )?,
        ],
    )
}

/// The frontend's labels for the menu, at startup and on every language change. Synchronous, so it runs on the main
/// thread, where macOS menus live. Nothing to do elsewhere: there's no menu bar.
#[tauri::command]
fn set_menu_labels(app: AppHandle, labels: MenuLabels) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let menu = macos_menu(&app, &labels).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, labels);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(target_os = "macos")]
    let builder = builder
        .manage(LeavingFullscreen::default())
        .manage(WindowedFrame::default())
        .menu(|app| macos_menu(app, &MenuLabels::default()))
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == QUIT_MENU_ID {
                flush_then_exit(app);
            } else if MENU_COMMANDS.contains(&id) {
                // The window may be closed (hidden): a new note or the settings bring it back.
                show_main(app, true);
                let _ = app.emit_to("main", MENU_EVENT, id);
            }
        });

    builder
        // First: a second launch only focuses the running window. Two instances would share (and overwrite) the same
        // stored notes.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app, true)))
        // The window's size and place, as the user left them. Not its visibility: it shows once drawn (`window_ready`).
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ExitState::default())
        .manage(WindowShown::default())
        .manage(net::Net::default())
        .invoke_handler(tauri::generate_handler![
            biometric_authenticate,
            exit_after_flush,
            window_ready,
            set_menu_labels,
            net::net_request,
            net::net_cancel,
            net::net_webhook
        ])
        .setup(|app| {
            // The config's frame: window-state's restore lands just after (on the main queue), recorded through its
            // Moved/Resized like any later change.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                remember_windowed_frame(&window.as_ref().window());
            }
            let app = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(SHOW_FALLBACK);
                window_ready(app);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if matches!(event, WindowEvent::Resized(_) | WindowEvent::Focused(true)) {
                left_fullscreen(window);
            }
            #[cfg(target_os = "macos")]
            if matches!(event, WindowEvent::Resized(_) | WindowEvent::Moved(_)) {
                remember_windowed_frame(window);
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                #[cfg(target_os = "macos")]
                hide_main(window);
                #[cfg(not(target_os = "macos"))]
                flush_then_exit(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            // `code` is None when the last window is gone; `app.exit()` comes back here with Some and goes through.
            RunEvent::ExitRequested { code: None, api, .. } => {
                api.prevent_exit();
                flush_then_exit(app);
            }
            // A click on the Dock icon (or opening the app again): the window, closed or not (still on screen, it may be
            // leaving full screen to be hidden).
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => show_main(app, true),
            #[cfg(target_os = "macos")]
            RunEvent::Exit => save_windowed_frame(app),
            _ => {}
        });
}
