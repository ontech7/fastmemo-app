//! What a Windows window needs to look and behave like the app, not like a browser (elsewhere these do nothing): the
//! title bar in the app's colour, the text fields' menu down to its editing items, and a minimised window's page told it
//! is hidden. The dark theme itself is the window's config (`theme`), on Windows and macOS. ADR-033.

#[cfg(windows)]
use tauri::Manager;
use tauri::{WebviewWindow, Window};

/// `#05091A` (`COLOR.bg`, the window's `backgroundColor`) as a COLORREF: 0x00BBGGRR.
#[cfg(windows)]
const TITLE_BAR_COLOR: u32 = 0x001A_0905;

/// Windows 11 draws the title bar in the app's colour. Windows 10 has no such setting and refuses it: its bar keeps the dark
/// theme's grey, as on Linux, which follows the system theme.
#[cfg(windows)]
pub fn paint_title_bar(window: &WebviewWindow) {
    use windows_sys::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CAPTION_COLOR};

    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    // An error is Windows 10's refusal: nothing to report.
    unsafe {
        DwmSetWindowAttribute(
            hwnd.0 as _,
            DWMWA_CAPTION_COLOR as _,
            &TITLE_BAR_COLOR as *const u32 as *const _,
            size_of::<u32>() as u32,
        );
    }
}

#[cfg(not(windows))]
pub fn paint_title_bar(_window: &WebviewWindow) {}

/// WebView2 fills a text field's menu with Edge's own items (emoji, writing assistance, passwords…): only cut, copy and
/// paste stay. Everywhere else the page shows no menu at all, but over selected text (`useKeyboardShortcuts.web.ts`).
#[cfg(windows)]
pub fn keep_only_editing_items(window: &WebviewWindow) {
    use webview2_com::ContextMenuRequestedEventHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_11;
    use windows_core::{Interface, PWSTR};

    const KEPT: [&str; 3] = ["cut", "copy", "paste"];

    let registered = window.with_webview(|webview| {
        let handler = ContextMenuRequestedEventHandler::create(Box::new(|_, args| {
            let Some(args) = args else {
                return Ok(());
            };
            unsafe {
                let items = args.MenuItems()?;
                let mut count = 0;
                items.Count(&mut count)?;
                for index in (0..count).rev() {
                    let mut name = PWSTR::null();
                    items.GetValueAtIndex(index)?.Name(&mut name)?;
                    if !KEPT.contains(&webview2_com::take_pwstr(name).as_str()) {
                        items.RemoveValueAtIndex(index)?;
                    }
                }
            }
            Ok(())
        }));
        let mut token = 0;
        let added = unsafe {
            webview
                .controller()
                .CoreWebView2()
                .and_then(|core| core.cast::<ICoreWebView2_11>())
                .and_then(|core| core.add_ContextMenuRequested(&handler, &mut token))
        };
        if let Err(error) = added {
            log(format_args!("cannot trim the text fields' menu: {error}"));
        }
    });
    if let Err(error) = registered {
        log(format_args!("cannot trim the text fields' menu: {error}"));
    }
}

#[cfg(not(windows))]
pub fn keep_only_editing_items(_window: &WebviewWindow) {}

/// WebView2 isn't told when its window is minimised: the page would go on as if on screen. Hidden, it's throttled like a
/// browser's background tab and gets `visibilitychange`, which saves the edits not yet written (`flushOnExit.web.ts`) and,
/// back on screen, reconnects the sync (`SyncOnProvider`). It still answers the local MCP server's calls (ADR-032).
#[cfg(windows)]
pub fn follow_minimised(window: &Window) {
    let Some(webview) = window.app_handle().get_webview_window(window.label()) else {
        return;
    };
    let visible = !window.is_minimized().unwrap_or(false);
    let told = webview.with_webview(move |webview| {
        if let Err(error) = unsafe { webview.controller().SetIsVisible(visible) } {
            log(format_args!("cannot tell the page it is minimised: {error}"));
        }
    });
    if let Err(error) = told {
        log(format_args!("cannot tell the page it is minimised: {error}"));
    }
}

#[cfg(not(windows))]
pub fn follow_minimised(_window: &Window) {}

/// To stderr, which a release build on Windows has nowhere to show: what a debug run needs. Not `eprintln!`, which panics
/// when stderr is closed.
#[cfg(windows)]
fn log(message: std::fmt::Arguments) {
    use std::io::Write;
    let _ = writeln!(std::io::stderr(), "fastmemo window: {message}");
}
