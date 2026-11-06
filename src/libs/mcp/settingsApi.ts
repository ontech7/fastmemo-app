/*
 * The settings page's way to the Rust side of the local MCP server (`src-tauri/src/mcp/mod.rs`). Desktop only: the Tauri API
 * is imported on use, so nothing here loads it on another platform.
 */

/** The per-device switches, as Rust keeps them. */
export interface McpSettings {
  enabled: boolean;
  /** Tool name to its switch. A tool not listed has its default (`MCP_TOOLS`). */
  tools: Record<string, boolean>;
  keepRunning: boolean;
}

export interface McpConnectionInfo {
  /** The executable an AI client runs with `--mcp`. */
  path: string;
  /** macOS: the app runs from outside the Applications folders, so the path may not last. */
  moved: boolean;
  /** Rust's `std::env::consts::OS`: `macos`, `windows`, `linux`. */
  platform: string;
}

/**
 * The tools and whether each starts switched on. Rust's `tools.rs` is the source: `scripts/mcp.test.mjs` checks the two
 * agree. The labels are the `mcp.tools.<name>` strings.
 */
export const MCP_TOOLS: { name: string; defaultOn: boolean }[] = [
  { name: "fastmemo_create_note", defaultOn: true },
  { name: "fastmemo_list_categories", defaultOn: true },
  { name: "fastmemo_search_notes", defaultOn: true },
  { name: "fastmemo_read_note", defaultOn: true },
  { name: "fastmemo_set_note_flags", defaultOn: true },
  { name: "fastmemo_help", defaultOn: true },
  { name: "fastmemo_check_update", defaultOn: true },
  { name: "fastmemo_edit_note", defaultOn: false },
  { name: "fastmemo_trash_note", defaultOn: false },
];

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function getMcpSettings(): Promise<McpSettings> {
  return invokeCommand<McpSettings>("mcp_get_settings");
}

/** Saves the switches and applies them; rejects with a message when the server can't start or the file can't be written. */
export function setMcpSettings(settings: McpSettings): Promise<void> {
  return invokeCommand<void>("mcp_set_settings", { settings });
}

export function getMcpConnectionInfo(): Promise<McpConnectionInfo> {
  return invokeCommand<McpConnectionInfo>("mcp_connection_info");
}
