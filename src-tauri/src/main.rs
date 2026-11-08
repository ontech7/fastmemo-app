// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Before `run()`: the single-instance plugin would hand this launch to the running app.
    if std::env::args_os().any(|arg| arg == "--mcp") {
        std::process::exit(fastmemo_lib::mcp::run_bridge());
    }
    // A build check, hidden: whether the AI engine library opens in this executable (CI, a bundled app by hand).
    if std::env::args_os().any(|arg| arg == "--ai-selftest") {
        std::process::exit(fastmemo_lib::ai_selftest());
    }
    fastmemo_lib::run();
}
