// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Before `run()`: the single-instance plugin would hand this launch to the running app.
    if std::env::args_os().any(|arg| arg == "--mcp") {
        std::process::exit(fastmemo_lib::mcp::run_bridge());
    }
    fastmemo_lib::run();
}
