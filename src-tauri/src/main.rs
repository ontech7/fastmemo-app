// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "macos")]
use tauri::Manager;

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

/// Tint the native macOS titlebar to the app background (#05091A). macOS only
/// auto-derives the titlebar color from the WebView's painted background, which
/// is sampled too early under the prod asset protocol and stays the default
/// gray. Setting the NSWindow background + a transparent titlebar makes it blue
/// deterministically, in both dev and prod.
#[cfg(target_os = "macos")]
fn apply_macos_titlebar(window: &tauri::Window) {
    use cocoa::appkit::{NSColor, NSWindow, NSWindowStyleMask};
    use cocoa::base::{id, nil, YES};

    let Ok(raw) = window.ns_window() else {
        return;
    };
    let ns_window = raw as id;
    unsafe {
        // Blue window background → shows through the transparent titlebar.
        let bg = NSColor::colorWithRed_green_blue_alpha_(
            nil,
            5.0 / 255.0,
            9.0 / 255.0,
            26.0 / 255.0,
            1.0,
        );
        ns_window.setBackgroundColor_(bg);
        ns_window.setTitlebarAppearsTransparent_(YES);

        // wry makes the WebView a full-size content view (it fills the window,
        // *under* the titlebar). With an opaque titlebar that's hidden, but once
        // the titlebar is transparent the content shows through and overlaps the
        // traffic-light buttons. Drop that flag so the titlebar stays its own
        // band — tinted blue by the window background — with content below it.
        let mut mask = ns_window.styleMask();
        mask.remove(NSWindowStyleMask::NSFullSizeContentViewWindowMask);
        ns_window.setStyleMask_(mask);
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![biometric_authenticate])
        .setup(|app| {
            // Blue titlebar from the first frame, independent of WebView paint
            // timing (see apply_macos_titlebar). Applied during setup, before the
            // window is shown, so it's already tinted on first paint.
            #[cfg(target_os = "macos")]
            if let Some(main) = app.get_window("main") {
                apply_macos_titlebar(&main);
            }

            #[cfg(not(target_os = "macos"))]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
