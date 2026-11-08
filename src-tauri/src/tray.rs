//! Windows and Linux: while the local MCP server is on (and the "keep running" switch with it), closing the window hides it
//! and a tray icon stays, with Open and Quit. macOS has its own way (the Dock, `hide_main` in lib.rs) and never gets a tray.
//! The code compiles everywhere; `keeps_running` is what keeps macOS out.

use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::mcp::settings::McpSettings;

const TRAY_ID: &str = "main";
const OPEN_ID: &str = "tray-open";
const QUIT_ID: &str = "tray-quit";

/// The menu's labels, in the app's language (`set_tray_labels`).
#[derive(Clone, Deserialize)]
pub struct TrayLabels {
    pub open: String,
    pub quit: String,
}

/// English, until the frontend sends its language's labels.
impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            open: "Open Fast Memo".to_string(),
            quit: "Quit".to_string(),
        }
    }
}

/// The labels the icon's menu is built with.
#[derive(Default)]
pub struct TrayState {
    labels: Mutex<TrayLabels>,
}

/// Whether closing the window leaves the app running with a tray icon: MCP on, the switch on, and not macOS.
pub fn keeps_running(settings: &McpSettings) -> bool {
    keeps_running_on(cfg!(target_os = "macos"), settings)
}

fn keeps_running_on(is_macos: bool, settings: &McpSettings) -> bool {
    !is_macos && settings.enabled && settings.keep_running
}

/// Whether a close hides the window now: the settings say so and the icon is there to bring it back. Without the icon (it
/// failed to build) the app would be running with no way to reach it, so the close quits.
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub fn hides_on_close(app: &AppHandle) -> bool {
    keeps_running(&crate::mcp::mcp_get_settings(app.clone())) && app.tray_by_id(TRAY_ID).is_some()
}

/// Creates or removes the icon to match the settings in force. Queued to the main thread, where icons and their menus must be
/// made (GTK requires it on Linux), and decided there, from the settings of that moment: calls in a row end in the last one's
/// state. Takes no lock while it waits for anything.
pub fn sync(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let keep = keeps_running(&crate::mcp::mcp_get_settings(handle.clone()));
        let exists = handle.tray_by_id(TRAY_ID).is_some();
        if keep && !exists {
            if let Err(err) = build(&handle) {
                crate::mcp::server::log(format_args!("the tray icon wasn't created: {err}"));
            }
        } else if !keep && exists {
            handle.remove_tray_by_id(TRAY_ID);
        }
    });
}

fn menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let labels = app.state::<TrayState>().labels.lock().unwrap().clone();
    Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, OPEN_ID, labels.open, true, None::<&str>)?,
            &MenuItem::with_id(app, QUIT_ID, labels.quit, true, None::<&str>)?,
        ],
    )
}

fn build(app: &AppHandle) -> tauri::Result<()> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu(app)?)
        // Windows: a left click opens the window, the menu is the right click's. Linux sends no click events: only the menu.
        .show_menu_on_left_click(false)
        .tooltip(&app.package_info().name)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN_ID => crate::show_main(app, true),
            QUIT_ID => crate::flush_then_exit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main(tray.app_handle(), true);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app).map(|_| ())
}

/// The frontend's labels for the menu, at startup and on every language change. With an icon up, its menu is rebuilt.
#[tauri::command]
pub fn set_tray_labels(app: AppHandle, labels: TrayLabels) -> Result<(), String> {
    *app.state::<TrayState>().labels.lock().unwrap() = labels;
    let handle = app.clone();
    app.run_on_main_thread(move || {
        if let Some(tray) = handle.tray_by_id(TRAY_ID) {
            if let Ok(menu) = menu(&handle) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    })
    .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::settings::McpSettings;

    fn settings(enabled: bool, keep_running: bool) -> McpSettings {
        McpSettings {
            enabled,
            keep_running,
            ..McpSettings::default()
        }
    }

    #[test]
    fn keeps_running_needs_both_switches() {
        // Windows and Linux: MCP on and the background switch on.
        assert!(keeps_running_on(false, &settings(true, true)));
        assert!(!keeps_running_on(false, &settings(false, true)));
        assert!(!keeps_running_on(false, &settings(true, false)));
        assert!(!keeps_running_on(false, &settings(false, false)));
        // macOS has its own behavior: never a tray.
        assert!(!keeps_running_on(true, &settings(true, true)));
    }
}
