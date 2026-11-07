/** The name an AI client files Fast Memo under. */
const SERVER_NAME = "fastmemo";

/**
 * What to paste into each AI client to connect it to this app: its executable run with `--mcp` (a stdio server).
 * Claude Code and Codex take a command; Claude Desktop and Cursor take the same JSON in their own files.
 */
export function connectionSnippets(path: string): { claudeCode: string; codex: string; json: string } {
  const quoted = `"${path}"`;
  return {
    claudeCode: `claude mcp add ${SERVER_NAME} -- ${quoted} --mcp`,
    codex: `codex mcp add ${SERVER_NAME} -- ${quoted} --mcp`,
    json: JSON.stringify({ mcpServers: { [SERVER_NAME]: { command: path, args: ["--mcp"] } } }, null, 2),
  };
}
