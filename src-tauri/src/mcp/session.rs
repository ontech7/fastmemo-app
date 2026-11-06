//! What one MCP connection may do: the notes it created, and how fast it may write.

use super::settings::McpSettings;
use super::tools::Tool;
use serde::Serialize;
use std::collections::VecDeque;
use std::time::{Duration, Instant};

pub const WRITES_PER_MINUTE: usize = 30;
const WINDOW: Duration = Duration::from_secs(60);

/// One connection. Sessions never share owned notes.
#[derive(Default)]
pub struct Session {
    owned_ids: Vec<String>,
    recent_writes: VecDeque<Instant>,
}

/// What the page may edit for a session; serialized as `{ editAll, ownedIds }`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditScope {
    pub edit_all: bool,
    pub owned_ids: Vec<String>,
}

impl Session {
    /// Records a note this session created.
    pub fn own(&mut self, note_id: String) {
        if !self.owned_ids.contains(&note_id) {
            self.owned_ids.push(note_id);
        }
    }

    pub fn scope(&self, settings: &McpSettings) -> EditScope {
        EditScope {
            edit_all: settings.is_on(Tool::EditNote),
            owned_ids: self.owned_ids.clone(),
        }
    }

    /// Counts a write against the last minute. A refused write is not counted.
    pub fn allow_write(&mut self, now: Instant) -> bool {
        while let Some(&oldest) = self.recent_writes.front() {
            if now.saturating_duration_since(oldest) >= WINDOW {
                self.recent_writes.pop_front();
            } else {
                break;
            }
        }
        if self.recent_writes.len() >= WRITES_PER_MINUTE {
            return false;
        }
        self.recent_writes.push_back(now);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::settings::McpSettings;
    use crate::mcp::tools::Tool;
    use std::time::{Duration, Instant};

    #[test]
    fn two_sessions_dont_share_owned_notes() {
        let mut a = Session::default();
        let b = Session::default();
        a.own("x".to_string());
        let settings = McpSettings::default();
        assert_eq!(a.scope(&settings).owned_ids, vec!["x".to_string()]);
        assert!(b.scope(&settings).owned_ids.is_empty());
    }

    #[test]
    fn owning_the_same_note_twice_lists_it_once() {
        let mut a = Session::default();
        a.own("x".to_string());
        a.own("x".to_string());
        assert_eq!(a.scope(&McpSettings::default()).owned_ids.len(), 1);
    }

    #[test]
    fn scope_edit_all_follows_the_switch() {
        let session = Session::default();
        let mut settings = McpSettings::default();
        assert!(!session.scope(&settings).edit_all);
        settings.tools.insert(Tool::EditNote.name().to_string(), true);
        assert!(session.scope(&settings).edit_all);
    }

    #[test]
    fn scope_serializes_camel_case() {
        let mut session = Session::default();
        session.own("x".to_string());
        let json = serde_json::to_value(session.scope(&McpSettings::default())).unwrap();
        assert_eq!(json, serde_json::json!({"editAll": false, "ownedIds": ["x"]}));
    }

    #[test]
    fn the_write_cap_refuses_the_31st_within_a_minute_and_recovers_after_it() {
        let mut session = Session::default();
        let start = Instant::now();
        for _ in 0..WRITES_PER_MINUTE {
            assert!(session.allow_write(start));
        }
        assert!(!session.allow_write(start + Duration::from_secs(30)));
        // A refused write doesn't count against the window.
        assert!(!session.allow_write(start + Duration::from_secs(59)));
        assert!(session.allow_write(start + Duration::from_secs(61)));
    }
}
