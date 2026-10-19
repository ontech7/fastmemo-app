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
// the app quits. Every quit (window close button, Cmd+Q, the OS ending the session) first asks the frontend to flush
// (`src/libs/flushOnExit.web.ts`) and exits once it reports back, or after FLUSH_TIMEOUT if a write hangs.

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

/// macOS: WKWebView paints white until the first frame, and Tauri's `backgroundColor` doesn't reach the webview layer
/// there. Turning off its (KVC-only) `drawsBackground` lets the window's #05091A show through until the page paints, so
/// launch never flashes white. A no-op if the WebView handle can't be reached.
#[cfg(target_os = "macos")]
fn clear_webview_background(window: &tauri::WebviewWindow) {
    use objc2::{msg_send, runtime::AnyObject};
    use objc2_foundation::{NSNumber, NSString};

    let _ = window.with_webview(|webview| {
        let wk = webview.inner() as *mut AnyObject;
        if wk.is_null() {
            return;
        }
        unsafe {
            let no = NSNumber::new_bool(false);
            let key = NSString::from_str("drawsBackground");
            let _: () = msg_send![&*wk, setValue: &*no, forKey: &*key];
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Some(main) = app.get_webview_window("main") {
                clear_webview_background(&main);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = app;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // `code` is None when the user quits (Cmd+Q, the OS ending the session); `app.exit()` comes back here with
            // Some and goes through.
            if let RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
                flush_then_exit(app);
            }
        });
}
