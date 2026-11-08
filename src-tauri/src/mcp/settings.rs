//! The per-device MCP switches, kept in a small JSON file. A missing or corrupt file means MCP is off.

use super::tools::Tool;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct McpSettings {
    pub enabled: bool,
    /// Tool name (`fastmemo_create_note`, ...) to its switch. A tool not stored here has its default.
    pub tools: BTreeMap<String, bool>,
    pub keep_running: bool,
}

impl Default for McpSettings {
    fn default() -> Self {
        McpSettings {
            enabled: false,
            tools: BTreeMap::new(),
            keep_running: true,
        }
    }
}

impl McpSettings {
    pub fn is_on(&self, tool: Tool) -> bool {
        self.tools
            .get(tool.name())
            .copied()
            .unwrap_or_else(|| tool.default_on())
    }

    /// Missing or corrupt: the default, so off.
    pub fn load(path: &Path) -> McpSettings {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    /// Writes a temp file beside the target and renames it over, so a crash never leaves half a file.
    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        let json = serde_json::to_string_pretty(self)
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))?;
        let mut temp = path.as_os_str().to_owned();
        temp.push(".tmp");
        let temp = std::path::PathBuf::from(temp);
        std::fs::write(&temp, json)?;
        std::fs::rename(&temp, path).inspect_err(|_| {
            let _ = std::fs::remove_file(&temp);
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::tools::Tool;
    use std::path::PathBuf;

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fastmemo-mcp-{}-{}", std::process::id(), name));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("mcp.json")
    }

    #[test]
    fn off_by_default_and_when_corrupt() {
        let path = temp_path("corrupt");
        assert!(!McpSettings::load(&path).enabled);
        std::fs::write(&path, "{not json").unwrap();
        let loaded = McpSettings::load(&path);
        assert!(!loaded.enabled);
        assert!(loaded.keep_running);
        assert!(loaded.tools.is_empty());
    }

    #[test]
    fn saved_values_round_trip_and_unknown_tools_fall_to_their_default() {
        let path = temp_path("roundtrip");
        let mut settings = McpSettings::default();
        settings.enabled = true;
        settings.keep_running = false;
        settings.tools.insert(Tool::EditNote.name().to_string(), true);
        settings.tools.insert(Tool::CreateNote.name().to_string(), false);
        settings.save(&path).unwrap();

        let loaded = McpSettings::load(&path);
        assert!(loaded.enabled);
        assert!(!loaded.keep_running);
        assert!(loaded.is_on(Tool::EditNote));
        assert!(!loaded.is_on(Tool::CreateNote));
        // Not stored: the tool's own default.
        assert!(loaded.is_on(Tool::SearchNotes));
        assert!(!loaded.is_on(Tool::TrashNote));

        // camelCase keys on disk, and no temp file left behind.
        let raw: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(raw["keepRunning"], false);
        assert_eq!(raw["tools"]["fastmemo_edit_note"], true);
        assert_eq!(std::fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
    }
}
