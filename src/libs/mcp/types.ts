/** A tool call, from Rust (`src-tauri/src/mcp/page.rs`). `tool` is the full name (`fastmemo_read_note`). */
export interface McpRequest {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  scope: { editAll: boolean; ownedIds: string[] };
}

export interface McpReply {
  text: string;
  isError: boolean;
  createdId?: string;
}

export type UpdateCheck =
  | { kind: "newer"; current: string; latest: string }
  | { kind: "current"; current: string }
  | { kind: "packageManager"; current: string };
