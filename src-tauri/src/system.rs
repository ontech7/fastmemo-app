//! The system's own windows the frontend opens (`src/libs/print.web.ts`).

/// Opens the system's print dialog on the main window. The page has laid the note out for print beforehand (a print-only
/// copy in the top document): the dialog prints the window as it is, and its "Save as PDF" writes text, not a picture.
/// One path for the three systems, which each implement `print`; no capability, as it is the app's own command.
#[tauri::command]
pub fn print_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}
