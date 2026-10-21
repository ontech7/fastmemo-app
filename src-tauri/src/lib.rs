use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};

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
// the app quits. A quit from the window (close button, Cmd+W) or the app menu (Cmd+Q) first asks the frontend to flush
// (`src/libs/flushOnExit.web.ts`) and exits once it reports back, or after FLUSH_TIMEOUT if a write hangs.
// Not covered: quits that bypass the event loop (macOS Dock Quit and logout, a Windows/Linux session ending) exit at once,
// losing at most the edit batch still open (ADR-015).

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

/// The app menu's Quit item.
#[cfg(target_os = "macos")]
const QUIT_MENU_ID: &str = "quit";

/// The event a menu item's id goes out on; the frontend runs the matching command (`src/libs/desktopMenu.web.ts`).
#[cfg(target_os = "macos")]
const MENU_EVENT: &str = "fastmemo://menu";

/// The menu items the frontend acts on.
#[cfg(target_os = "macos")]
const MENU_COMMANDS: [&str; 5] = ["new-note", "find", "settings", "export-import", "help"];

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
/// shortcuts cover the same commands). Quit is a plain item, not the predefined one: that sends `terminate:`, which
/// ends the process without any event the app could hold, so this one goes through `flush_then_exit`. The items with a
/// command (`MENU_COMMANDS`) share their shortcut with the frontend: a key the page handles doesn't reach the menu.
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
                    &item("settings", &labels.settings, Some("CmdOrCtrl+,"))?,
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
        .menu(|app| macos_menu(app, &MenuLabels::default()))
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == QUIT_MENU_ID {
                flush_then_exit(app);
            } else if MENU_COMMANDS.contains(&id) {
                let _ = app.emit_to("main", MENU_EVENT, id);
            }
        });

    builder
        // First: a second launch only focuses the running window. Two instances would share (and overwrite) the same
        // stored notes.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ExitState::default())
        .invoke_handler(tauri::generate_handler![biometric_authenticate, exit_after_flush, set_menu_labels])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                flush_then_exit(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // `code` is None when the last window is gone; `app.exit()` comes back here with Some and goes through.
            if let RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
                flush_then_exit(app);
            }
        });
}
