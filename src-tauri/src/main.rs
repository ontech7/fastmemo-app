// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

// Kill the white launch flash by giving the native WebView the app background
// (#05091A) from the first frame. By default every platform's WebView paints
// white until the first HTML/CSS frame; with no splash to mask it that shows as
// a white blink on launch. Once global.css paints the body the pixels match, so
// this only affects the otherwise-white pre-paint window. Each call is a no-op
// if the WebView handle can't be reached.

/// macOS: WKWebView ignores `setOpaque:`; the property that actually controls
/// its background is the (KVC-only) `drawsBackground`. Turning it off makes the
/// WebView composite transparently, so the blue NSWindow (see
/// `apply_macos_titlebar`) shows through until the page paints.
#[cfg(target_os = "macos")]
fn set_webview_background(window: &tauri::Window) {
    use cocoa::base::{id, nil, NO};
    use cocoa::foundation::NSString;
    use objc::{class, msg_send, sel, sel_impl};

    let _ = window.with_webview(|webview| {
        let wk = webview.inner() as id;
        unsafe {
            let no_value: id = msg_send![class!(NSNumber), numberWithBool: NO];
            let key = NSString::alloc(nil).init_str("drawsBackground");
            let _: () = msg_send![wk, setValue: no_value forKey: key];
        }
    });
}

/// Windows: set the WebView2 controller's default background color. Needs
/// `ICoreWebView2Controller2` (WebView2 runtime 92+); no-op on older runtimes.
#[cfg(target_os = "windows")]
fn set_webview_background(window: &tauri::Window) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{COREWEBVIEW2_COLOR, ICoreWebView2Controller2};
    use windows::core::Interface;

    let _ = window.with_webview(|webview| {
        if let Ok(controller) = webview.controller().cast::<ICoreWebView2Controller2>() {
            unsafe {
                let _ = controller.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR {
                    A: 255,
                    R: 0x05,
                    G: 0x09,
                    B: 0x1A,
                });
            }
        }
    });
}

/// Linux: set the WebKitGTK view's background color directly.
#[cfg(target_os = "linux")]
fn set_webview_background(window: &tauri::Window) {
    use webkit2gtk::WebViewExt;

    let _ = window.with_webview(|webview| {
        let bg = gtk::gdk::RGBA {
            red: 5.0 / 255.0,
            green: 9.0 / 255.0,
            blue: 26.0 / 255.0,
            alpha: 1.0,
        };
        webview.inner().set_background_color(&bg);
    });
}

/// Fallback for any non-desktop target (Tauri only ships macOS/Windows/Linux).
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn set_webview_background(_window: &tauri::Window) {}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![biometric_authenticate])
        .setup(|app| {
            if let Some(main) = app.get_window("main") {
                // Blue titlebar from the first frame, independent of WebView paint
                // timing (see apply_macos_titlebar). Applied during setup, before
                // the window is shown, so it's already tinted on first paint.
                #[cfg(target_os = "macos")]
                apply_macos_titlebar(&main);

                // App-background WebView so launch never flashes white.
                set_webview_background(&main);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
