//! What one MCP connection may do: the notes it created, and how fast it may write.

use super::settings::McpSettings;
use super::tools::Tool;
use serde::Serialize;
use std::collections::VecDeque;
use std::time::{Duration, Instant};

pub const WRITES_PER_MINUTE: usize = 30;
/// Coarser than the minute's, per connection: 30 a minute kept up is 43,200 writes a day against Firestore's 20,000 free ones.
pub const WRITES_PER_HOUR: usize = 300;
const MINUTE: Duration = Duration::from_secs(60);
const HOUR: Duration = Duration::from_secs(3600);

/// Which of the two limits a refused write went over.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum WriteLimit {
    Minute,
    Hour,
}

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

    /// Counts a write against the last minute and the last hour, or says which limit it went over (the hour's first: it is
    /// the longer wait). A refused write is not counted.
    pub fn allow_write(&mut self, now: Instant) -> Result<(), WriteLimit> {
        while let Some(&oldest) = self.recent_writes.front() {
            if now.saturating_duration_since(oldest) >= HOUR {
                self.recent_writes.pop_front();
            } else {
                break;
            }
        }
        if self.recent_writes.len() >= WRITES_PER_HOUR {
            return Err(WriteLimit::Hour);
        }
        let last_minute = self
            .recent_writes
            .iter()
            .rev()
            .take_while(|&&at| now.saturating_duration_since(at) < MINUTE)
            .count();
        if last_minute >= WRITES_PER_MINUTE {
            return Err(WriteLimit::Minute);
        }
        self.recent_writes.push_back(now);
        Ok(())
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
            assert_eq!(session.allow_write(start), Ok(()));
        }
        assert_eq!(
            session.allow_write(start + Duration::from_secs(30)),
            Err(WriteLimit::Minute)
        );
        // A refused write doesn't count against the window.
        assert_eq!(
            session.allow_write(start + Duration::from_secs(59)),
            Err(WriteLimit::Minute)
        );
        assert_eq!(session.allow_write(start + Duration::from_secs(61)), Ok(()));
    }

    /// 29 writes a minute, a minute apart: the minute's limit is never reached, the hour's is.
    #[test]
    fn the_write_cap_refuses_the_301st_within_an_hour_while_the_minute_is_fine() {
        let mut session = Session::default();
        let start = Instant::now();
        let mut at = start;
        let mut done = 0;
        // 30 writes at the start of each of the first ten minutes: 300 in under ten minutes.
        for minute in 0..10 {
            at = start + Duration::from_secs(minute * 60);
            for _ in 0..WRITES_PER_MINUTE {
                assert_eq!(session.allow_write(at), Ok(()));
                done += 1;
            }
        }
        assert_eq!(done, WRITES_PER_HOUR);
        // The minute before holds no write, yet the hour is full.
        let later = at + Duration::from_secs(11 * 60);
        assert_eq!(session.allow_write(later), Err(WriteLimit::Hour));
        // A refused write doesn't count: it recovers once the first writes are an hour old.
        assert_eq!(
            session.allow_write(start + Duration::from_secs(3599)),
            Err(WriteLimit::Hour)
        );
        assert_eq!(
            session.allow_write(start + Duration::from_secs(3601)),
            Ok(())
        );
    }
}
