//! The nine tools: names, switches, and the definitions an agent reads.

use super::settings::McpSettings;
use serde_json::{json, Value};

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Tool {
    CreateNote,
    ListCategories,
    SearchNotes,
    ReadNote,
    SetNoteFlags,
    Help,
    CheckUpdate,
    EditNote,
    TrashNote,
}

impl Tool {
    pub const ALL: [Tool; 9] = [
        Tool::CreateNote,
        Tool::ListCategories,
        Tool::SearchNotes,
        Tool::ReadNote,
        Tool::SetNoteFlags,
        Tool::Help,
        Tool::CheckUpdate,
        Tool::EditNote,
        Tool::TrashNote,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Tool::CreateNote => "fastmemo_create_note",
            Tool::ListCategories => "fastmemo_list_categories",
            Tool::SearchNotes => "fastmemo_search_notes",
            Tool::ReadNote => "fastmemo_read_note",
            Tool::SetNoteFlags => "fastmemo_set_note_flags",
            Tool::Help => "fastmemo_help",
            Tool::CheckUpdate => "fastmemo_check_update",
            Tool::EditNote => "fastmemo_edit_note",
            Tool::TrashNote => "fastmemo_trash_note",
        }
    }

    pub fn from_name(name: &str) -> Option<Tool> {
        Tool::ALL.into_iter().find(|tool| tool.name() == name)
    }

    /// Whether the tool starts switched on. `edit_note` and `trash_note` start off.
    pub fn default_on(self) -> bool {
        !matches!(self, Tool::EditNote | Tool::TrashNote)
    }

    /// Whether the tool changes the user's notes.
    pub fn writes(self) -> bool {
        matches!(
            self,
            Tool::CreateNote | Tool::SetNoteFlags | Tool::EditNote | Tool::TrashNote
        )
    }

    pub fn definition(self) -> Value {
        json!({
            "name": self.name(),
            "description": self.description(),
            "inputSchema": self.input_schema(),
            "annotations": self.annotations(),
        })
    }

    fn annotations(self) -> Value {
        let (read_only, destructive, idempotent) = match self {
            Tool::CreateNote => (false, false, false),
            Tool::SetNoteFlags => (false, false, true),
            // A replacement overwrites what was there.
            Tool::EditNote => (false, true, false),
            Tool::TrashNote => (false, true, true),
            _ => (true, false, true),
        };
        let mut annotations = json!({
            "readOnlyHint": read_only,
            "openWorldHint": false,
        });
        // The spec reads these two only when the tool isn't read-only.
        if !read_only {
            annotations["destructiveHint"] = json!(destructive);
            annotations["idempotentHint"] = json!(idempotent);
        }
        annotations
    }

    fn description(self) -> &'static str {
        match self {
            Tool::CreateNote => {
                "Creates a note in Fast Memo. Pick the type when the user didn't say; text is the usual choice. \
Keep the title short, about 60 characters. `category` must be a name returned by fastmemo_list_categories; \
omit it when none fits. Give the content that matches the type: `text` for a text note, `items` for a todo, \
`tabs` for a code note, `columns` for a kanban. For a text note, `text` is HTML: p, h1-h3, ul, ol, li, strong, \
em, code, pre, blockquote and a are supported. Returns the note's id and rev."
            }
            Tool::ListCategories => "Lists the categories that exist in Fast Memo. Categories can't be created through MCP.",
            Tool::SearchNotes => {
                "Finds notes by title or content. Without a query, returns the most recently updated notes. Each result \
has the id, title, type, category, updated time, important and read-only flags, and a short snippet. Locked and \
hidden notes never appear. When there are more results, the reply has `nextOffset`: pass it as `offset` to get \
the next page."
            }
            Tool::ReadNote => {
                "Reads one note: its content and its rev. Images in a text note are replaced by a placeholder. \
Locked and hidden notes can't be read. A long note comes in parts: when the result has `nextOffset`, call again \
with that value as `offset` (in characters) to continue."
            }
            Tool::SetNoteFlags => {
                "Sets flags on an existing note. `important` can be set or cleared; `readOnly` and `locked` can only be \
set to true. Works on a read-only note, since it doesn't touch the content."
            }
            Tool::Help => {
                "Fast Memo's help section. Without `topic`, lists the topics (key, title, category). With a topic key, \
returns that topic's text in the app's language."
            }
            Tool::CheckUpdate => {
                "Says whether a newer version of Fast Memo exists. Reports the installed version and the newer one, \
or that it is up to date. It doesn't install anything."
            }
            Tool::EditNote => {
                "Changes an existing note. Needs the `rev` from the last read or creation of that note; if the note \
changed since, the edit is refused and the note must be read again. Read-only notes can't be edited. \
Without the user's permission for edits, only notes created in this same session can be edited. \
Give only the operations you need. All notes: `title`, `category` (a name from fastmemo_list_categories, or \
null for the default category). Text notes: `appendHtml` adds HTML at the end, `replaceHtml` replaces the \
whole content (refused when the note holds images); both are HTML. Todo notes: `addItems`, `updateItems` \
(by item id), `removeItemIds`. Kanban notes: `addColumns`, `addCards` (to a column id), `moveCards` (to \
another column), `removeCardIds`. Code notes: `addTabs`, `updateTabs` (by tab id). The ids come from \
fastmemo_read_note. Returns the note's new rev."
            }
            Tool::TrashNote => {
                "Moves a note to the trash, where the user can restore it. Read-only notes can't be trashed. \
It doesn't delete anything permanently."
            }
        }
    }

    fn input_schema(self) -> Value {
        match self {
            Tool::CreateNote => json!({
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["text", "todo", "code", "kanban"],
                        "description": "The kind of note. Choose it when the user didn't say; text is the usual choice."
                    },
                    "title": {"type": "string", "description": "A short title, about 60 characters."},
                    "text": {
                        "type": "string",
                        "description": "For type text: the content as HTML (p, h1-h3, ul, ol, li, strong, em, code, pre, blockquote, a)."
                    },
                    "items": array_of(
                        "For type todo: the items.",
                        todo_item_schema(),
                    ),
                    "tabs": array_of(
                        "For type code: the tabs.",
                        code_tab_schema(),
                    ),
                    "columns": array_of(
                        "For type kanban: the columns, each with its cards.",
                        kanban_column_schema(),
                    ),
                    "category": {
                        "type": "string",
                        "description": "A name from fastmemo_list_categories. Omit it when none fits."
                    },
                    "important": {"type": "boolean"},
                    "readOnly": {"type": "boolean"},
                    "locked": {"type": "boolean"}
                },
                "required": ["type", "title"]
            }),
            Tool::ListCategories | Tool::CheckUpdate => json!({"type": "object", "properties": {}}),
            Tool::SearchNotes => json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Text to look for in titles and content."},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 50},
                    "offset": {"type": "integer", "minimum": 0, "description": "The nextOffset of the previous page."}
                }
            }),
            Tool::ReadNote => json!({
                "type": "object",
                "properties": {
                    "id": note_id(),
                    "offset": {
                        "type": "integer",
                        "minimum": 0,
                        "description": "Where to continue, in characters: the nextOffset of the previous result."
                    }
                },
                "required": ["id"]
            }),
            Tool::TrashNote => json!({
                "type": "object",
                "properties": {"id": note_id()},
                "required": ["id"]
            }),
            Tool::SetNoteFlags => json!({
                "type": "object",
                "properties": {
                    "id": note_id(),
                    "important": {"type": "boolean"},
                    "readOnly": {"type": "boolean", "enum": [true], "description": "Can only be set to true."},
                    "locked": {"type": "boolean", "enum": [true], "description": "Can only be set to true."}
                },
                "required": ["id"]
            }),
            Tool::Help => json!({
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "A topic key from the list. Omit it to list the topics."}
                }
            }),
            Tool::EditNote => json!({
                "type": "object",
                "properties": {
                    "id": note_id(),
                    "rev": {"type": "integer", "description": "The rev from the last read or creation of this note."},
                    "title": {"type": "string"},
                    "category": {
                        "type": ["string", "null"],
                        "description": "A name from fastmemo_list_categories, or null for the default category."
                    },
                    "appendHtml": {"type": "string", "description": "Text note: HTML added at the end."},
                    "replaceHtml": {"type": "string", "description": "Text note: HTML that replaces the whole content."},
                    "addItems": array_of("Todo note: items to add.", todo_item_schema()),
                    "updateItems": array_of(
                        "Todo note: items to change, by id.",
                        json!({
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "text": {"type": "string"},
                                "checked": {"type": "boolean"}
                            },
                            "required": ["id"]
                        }),
                    ),
                    "removeItemIds": array_of("Todo note: ids of the items to remove.", json!({"type": "string"})),
                    "addColumns": array_of(
                        "Kanban note: columns to add.",
                        json!({
                            "type": "object",
                            "properties": {"name": {"type": "string"}, "color": {"type": "string"}},
                            "required": ["name"]
                        }),
                    ),
                    "addCards": array_of(
                        "Kanban note: cards to add.",
                        json!({
                            "type": "object",
                            "properties": {"columnId": {"type": "string"}, "text": {"type": "string"}},
                            "required": ["columnId", "text"]
                        }),
                    ),
                    "moveCards": array_of(
                        "Kanban note: cards to move to another column.",
                        json!({
                            "type": "object",
                            "properties": {"cardId": {"type": "string"}, "toColumnId": {"type": "string"}},
                            "required": ["cardId", "toColumnId"]
                        }),
                    ),
                    "removeCardIds": array_of("Kanban note: ids of the cards to remove.", json!({"type": "string"})),
                    "addTabs": array_of("Code note: tabs to add.", code_tab_schema()),
                    "updateTabs": array_of(
                        "Code note: tabs to change, by id.",
                        json!({
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "title": {"type": "string"},
                                "language": {"type": "string"},
                                "code": {"type": "string"}
                            },
                            "required": ["id"]
                        }),
                    )
                },
                "required": ["id", "rev"]
            }),
        }
    }
}

/// The tools an agent sees. `edit_note` stays listed while `create_note` is on, since an agent may still edit the
/// notes it created in its own session.
pub fn listed_tools(settings: &McpSettings) -> Vec<Tool> {
    Tool::ALL
        .into_iter()
        .filter(|&tool| match tool {
            Tool::EditNote => settings.is_on(Tool::EditNote) || settings.is_on(Tool::CreateNote),
            _ => settings.is_on(tool),
        })
        .collect()
}

fn note_id() -> Value {
    json!({"type": "string", "description": "The note's id."})
}

fn array_of(description: &str, items: Value) -> Value {
    json!({"type": "array", "description": description, "items": items})
}

fn todo_item_schema() -> Value {
    json!({
        "type": "object",
        "properties": {"text": {"type": "string"}, "checked": {"type": "boolean"}},
        "required": ["text"]
    })
}

fn code_tab_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "language": {"type": "string"},
            "code": {"type": "string"}
        },
        "required": ["title", "code"]
    })
}

fn kanban_column_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "color": {"type": "string"},
            "cards": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["name"]
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::settings::McpSettings;

    #[test]
    fn every_tool_is_prefixed_and_has_an_object_schema() {
        assert_eq!(Tool::ALL.len(), 9);
        for tool in Tool::ALL {
            assert!(tool.name().starts_with("fastmemo_"), "{}", tool.name());
            assert_eq!(Tool::from_name(tool.name()), Some(tool));
            let def = tool.definition();
            assert_eq!(def["name"], tool.name());
            assert!(!def["description"].as_str().unwrap().is_empty());
            assert_eq!(def["inputSchema"]["type"], "object");
            assert!(def["inputSchema"]["properties"].is_object());
            assert!(def["annotations"].is_object());
        }
        assert_eq!(Tool::from_name("fastmemo_nope"), None);
        assert_eq!(Tool::from_name("create_note"), None);
    }

    #[test]
    fn defaults() {
        for tool in Tool::ALL {
            let off = matches!(tool, Tool::EditNote | Tool::TrashNote);
            assert_eq!(tool.default_on(), !off, "{}", tool.name());
        }
    }

    #[test]
    fn annotations() {
        for tool in [
            Tool::ListCategories,
            Tool::SearchNotes,
            Tool::ReadNote,
            Tool::Help,
            Tool::CheckUpdate,
        ] {
            assert_eq!(
                tool.definition()["annotations"]["readOnlyHint"],
                true,
                "{}",
                tool.name()
            );
            assert!(!tool.writes(), "{}", tool.name());
        }
        for tool in [
            Tool::CreateNote,
            Tool::SetNoteFlags,
            Tool::EditNote,
            Tool::TrashNote,
        ] {
            assert_eq!(
                tool.definition()["annotations"]["readOnlyHint"],
                false,
                "{}",
                tool.name()
            );
            assert!(tool.writes(), "{}", tool.name());
        }
        assert_eq!(
            Tool::TrashNote.definition()["annotations"]["destructiveHint"],
            true
        );
        assert_eq!(
            Tool::CreateNote.definition()["annotations"]["destructiveHint"],
            false
        );
    }

    fn settings_with(entries: &[(Tool, bool)]) -> McpSettings {
        let mut settings = McpSettings::default();
        for (tool, on) in entries {
            settings.tools.insert(tool.name().to_string(), *on);
        }
        settings
    }

    #[test]
    fn edit_note_is_listed_when_create_note_is_on_even_if_itself_off() {
        let listed = listed_tools(&settings_with(&[(Tool::EditNote, false)]));
        assert!(listed.contains(&Tool::CreateNote));
        assert!(listed.contains(&Tool::EditNote));
        assert!(!listed.contains(&Tool::TrashNote));
    }

    #[test]
    fn edit_note_is_not_listed_with_both_off() {
        let listed = listed_tools(&settings_with(&[(Tool::EditNote, false), (Tool::CreateNote, false)]));
        assert!(!listed.contains(&Tool::EditNote));
        assert!(!listed.contains(&Tool::CreateNote));
    }

    #[test]
    fn edit_note_is_listed_on_its_own_switch() {
        let listed = listed_tools(&settings_with(&[(Tool::EditNote, true), (Tool::CreateNote, false)]));
        assert!(listed.contains(&Tool::EditNote));
    }
}
