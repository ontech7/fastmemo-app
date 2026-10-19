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

/// macOS: Tauri's default menu, except Quit. Its predefined Quit (Cmd+Q) sends `terminate:`, which ends the process
/// without any event the app could hold, so this one is a plain item that goes through `flush_then_exit`.
#[cfg(target_os = "macos")]
fn macos_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{
        AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
    };

    let name = app.package_info().name.clone();
    let about = AboutMetadata {
        name: Some(name.clone()),
        version: Some(app.package_info().version.to_string()),
        copyright: app.config().bundle.copyright.clone(),
        ..Default::default()
    };

    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                &name,
                true,
                &[
                    &PredefinedMenuItem::about(app, None, Some(about))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, QUIT_MENU_ID, format!("Quit {name}"), true, Some("CmdOrCtrl+Q"))?,
                ],
            )?,
            &Submenu::with_items(app, "File", true, &[&PredefinedMenuItem::close_window(app, None)?])?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            &Submenu::with_items(app, "View", true, &[&PredefinedMenuItem::fullscreen(app, None)?])?,
            &Submenu::with_id_and_items(
                app,
                WINDOW_SUBMENU_ID,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?,
            &Submenu::with_id_and_items(app, HELP_SUBMENU_ID, "Help", true, &[])?,
        ],
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(target_os = "macos")]
    let builder = builder.menu(macos_menu).on_menu_event(|app, event| {
        if event.id() == QUIT_MENU_ID {
            flush_then_exit(app);
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
        .invoke_handler(tauri::generate_handler![biometric_authenticate, exit_after_flush])
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
