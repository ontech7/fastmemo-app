/**
 * The help topics an agent can ask for (`fastmemo_help`), in the order of the help screen (`app/settings/help.tsx`), which builds
 * its own list with JSX. `scripts/mcp.test.mjs` reads that file and fails when the two drift apart.
 *
 * Each base is an i18n key: its `title` and `text_N_M` strings are under it. The desktop app lists `help.what_desktop_shortcuts`.
 */
export const HELP_TOPICS: { catKey: string; bases: string[] }[] = [
  {
    catKey: "help.cat_notes",
    bases: [
      "help.how_to_create_note",
      "help.how_to_create_todo_note",
      "help.how_to_create_kanban_note",
      "help.how_to_create_code_note",
      "help.what_quick_note",
      "help.how_to_edit_note",
      "help.how_to_delete_note",
      "help.how_to_select_notes",
      "help.what_are_hidden_notes",
    ],
  },
  {
    catKey: "help.cat_editor",
    bases: ["help.what_toolbar_below", "help.what_find_replace", "help.what_are_settings_note"],
  },
  {
    catKey: "help.cat_categories",
    bases: ["help.how_create_category", "help.how_edit_category", "help.how_organize_categories", "help.how_delete_category"],
  },
  {
    catKey: "help.cat_trash",
    bases: ["help.what_are_trashed_notes", "help.how_restore_trashed_notes", "help.how_restore_delete_notes"],
  },
  {
    catKey: "help.cat_cloud",
    bases: [
      "help.what_cloud_sync",
      "help.what_conflict_copy",
      "help.what_encryption",
      "help.how_unlock_device",
      "help.forgot_password",
      "help.reset_encryption",
      "help.quick_backup",
    ],
  },
  {
    catKey: "help.cat_data",
    bases: ["help.what_secret_code", "help.what_import_export", "help.how_export_note", "help.what_wipe_data"],
  },
  {
    catKey: "help.cat_settings",
    bases: ["help.what_note_creation", "help.what_home_filters", "help.what_language"],
  },
  {
    catKey: "help.cat_more",
    bases: [
      "help.what_version_check",
      "help.what_report_problem",
      "help.what_webhooks",
      "help.what_platforms",
      "help.what_desktop_shortcuts",
    ],
  },
];

/** Topics about what only the phone app has (the AI assistant, voice dictation): the desktop app doesn't list them. */
export const HELP_MOBILE_ONLY: string[] = ["help.what_ai_assistant", "help.what_voice_dictation"];
