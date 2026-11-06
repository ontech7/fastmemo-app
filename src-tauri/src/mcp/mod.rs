//! Local MCP server: the JSON-RPC protocol, the tool definitions, the per-device switches and the session rights, the local
//! socket with its server, and the stdio bridge an AI client starts (`--mcp`).

pub mod bridge;
pub mod endpoint;
pub mod protocol;
pub mod server;
pub mod session;
pub mod settings;
pub mod tools;

/// The bridge (`--mcp`) on the real stdin and stdout, to this build's own socket. Starts no part of Tauri. Without a usable
/// path it still answers, as with the app away. Returns the process's exit code.
pub fn run_bridge() -> i32 {
    let context = crate::context();
    let socket = endpoint::endpoint_for(&context.config().identifier);
    let version = context.package_info().version.to_string();
    let connect = || match &socket {
        Ok(path) => endpoint::connect(path),
        Err(reason) => Err(std::io::Error::other(reason.clone())),
    };
    bridge::relay(std::io::stdin().lock(), std::io::stdout().lock(), connect, &version)
}
