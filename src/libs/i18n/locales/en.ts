const en = {
  languageCode: "en",
  languageName: "English",

  date: {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  },
  changelog: {
    title: "What's new?",

    web: {
      description_1_1_1: `• Added offline notes: keep a note only on this device, without syncing it to the cloud.
• Voice Recognition 2.0: improved voice dictation with automatic AI cleanup.
• The AI Assistant can now suggest a category from the note title.
• Added undo/redo and strikethrough to the text editor.
• Desktop unlock now supports Touch ID and Windows Hello.
• Various fixes.`,

      description_1_0_0: `• First stable release of Fast Memo Desktop (out of BETA).
• Brand-new modern design across the whole app, with the new Geist font, glass surfaces and gradients.
• Redesigned onboarding with new intro steps.
• Added note creation settings to customize the defaults for new notes.
• Added step mode for To-Do notes.
• Various fixes.`,

      description_0_3_0: `• Added new note type: Code note with built-in code editor, syntax highlighting, multiple tabs, and language auto-detection.
• Added find and replace in text notes.
• Added note export.
• Various fixes.`,

      description_0_2_0: `• Added the ability to reorder kanban columns.
• Improved animations.
• Various fixes.`,

      description_0_1_1: `• Fixed Cloud synchronization at app startup.
• Notes are now correctly sorted after each synchronization.`,

      description_0_1_0: `• Initial release of Fast Memo Desktop (BETA) with all mobile features.`,
    },

    mobile: {
      description_3_1_1: `• Added offline notes: keep a note only on this device, without syncing it to the cloud.
• Voice Recognition 2.0: improved voice dictation with automatic AI cleanup.
• The AI Assistant can now suggest a category from the note title.
• Added undo/redo and strikethrough to the text editor.
• Various fixes.`,

      description_3_0_0: `• Brand-new modern design across the whole app, with the new Geist font, glass surfaces and gradients.
• Redesigned onboarding with new intro steps.
• Added note creation settings to customize the defaults for new notes.
• Added step mode for To-Do notes.
• Refreshed app icon and splash screen.
• Various fixes.`,

      description_2_9_1: `• Added new note type: Code note with built-in code editor, syntax highlighting, multiple tabs, and language auto-detection.
• Added Qwen 2.5 7B model with device RAM detection. New AI actions for code: Explain code and Add comments.
• Added find and replace in text notes.
• Added note export.
• Various fixes.`,

      description_2_8_0: `• Added self-hosted AI Assistant (Qwen 2.5) with smart features for notes. Set it up in Settings -> AI Assistant.
• Added the ability to reorder kanban columns.
• Improved animations.
• Various fixes.`,

      description_2_7_1: `• Fixed Cloud synchronization at app startup.
• Notes are now correctly sorted after each synchronization.`,

      description_2_7_0: `• Fixed Kanban drag and drop on mobile, tablet and desktop.
• Aligned the mobile and desktop apps.
• Official release of the desktop app.`,

      description_2_6_2: `• Added Kanban type note.
• Redesigned Home action menu when pressing “+”.
• Redesigned note type as a badge at the top.
• Various fixes.`,

      description_2_5_3: `• Various fixes.`,

      description_2_5_2: `• Added the ability to reorder notes by creation date and update date.
• Added the ability to change language directly from settings.
• Redesign of modals.
• Various fixes.`,

      description_2_4_2: `• Revised and improved the app’s internal structure to make it faster and more stable.
• Added voice recognition for note transcription (text and lists).
• Added the ability to perform deep searches (text and lists).
• Various fixes.`,

      description_2_3_0: `• Added Japanese language.
• Updated webhooks to BETA version 2.0.
• Miscellaneous fixes.`,

      description_2_2_1: `• Added the ability to hide notes.
• Added the ability to report an issue in Settings → Feedback and Assistance.
• Miscellaneous fixes.`,

      description_2_1_0: `• Added number of note letters and maximum note size.
• Added number of items in ToDo note.
• Added maximum limit for cloud devices (3).
• Miscellaneous fixes.`,

      description_2_0_0: `• Added Cloud Sync with Google Firebase.
• Added Webhooks management (for expert user).
• Added left and center alignment options for text notes.
• Added secret code for some options.
• Changed size of all elements.
• Changed design for secret code screen.
• Changed the style of the To-Do note.
• Miscellaneous fixes.`,

      description_1_4_0: `• Added To-Do type note.
• Miscellaneous fixes.`,

      description_1_3_0: `• Added translations for Italian, Spanish, French, German and Chinese.
• Added new icons for categories.
• Miscellaneous fixes.`,

      description_1_2_1: `• Release in production.
• Added notes, temporary notes, categories, etc.
• Added secret code.
• Miscellaneous fixes.`,
    },
  },
  intro: {
    step1: "Add your notes with one click.",
    step2: "Enrich your text using the bottom toolbar.",
    step3: "Create a To-Do list to manage your tasks.",
    step4: "Visualize your ideas with Kanban boards.",
    step5: "Take note of your snippets.",
    step6: "Create your own category on your needs.",
    step7: "Insert a secret code to hide your notes.",
    step8: "Synchronize your notes on Google Firebase.",
    title: "What is Fast Memo?",
    continue: "Continue",
  },
  setupcode: {
    title: "Secret Code",
    firstCode_1: "Create a secret code to hide your notes.",
    firstCode_2: "You will be able to swap to Fingerprint from settings.",
    repeatCode: "Repeat your secret code.",
    savedCode: "Your secret code has been saved!",
    error: "The code you entered doesn't match. Try again.",
  },
  secretcode: {
    title: "Secret Code",
    oldCode: "Put your old secret code.",
    newCode: "Now put your new secret code.",
    repeatCode: "Repeat your new secret code.",
    savedCode: "Your new secret code has been saved!",
    unlockCode: "Insert your secret code",
    error: "The code you entered doesn't match. Try again.",
  },
  firstMemo: {
    title: "Welcome to Fast Memo! 🔊",
  },
  home: {
    notes: "Notes",
    search: "Search something...",
    deepSearch: "Deep search (text, lists…)",
    selected_count: "{{count}} selected",

    filters: {
      deepSearch: "Deep search",
      orderBy: "Order by:",
      createdAt: "Creation date",
      updatedAt: "Update date",
    },
  },
  note: {
    title_placeholder: "Title",
    description_placeholder: "Write something here...",
    no_items: "There are no items.\nAdd one by pressing the bottom right button.",
    characters: "characters",
    completed: "completed",
    on: "on",
    mode_free: "List",
    mode_steps: "Step",
    ongoing: "Ongoing",
    created: "Created: ",
    updated: "Updated: ",
    type: {
      todo: "To-Do",
      kanban: "Kanban",
      text: "Text",
      code: "Code",
    },
    settings: {
      delete: "Delete",
      important: "Important",
      protect: "Protect",
      readonly: "Read-Only",
      hide: "Hide",
      make_offline: "Make offline",
      sync_to_cloud: "Sync to cloud",
      made_offline: "Note is now offline",
      synced_as_duplicate: "Synced to cloud as a copy",
      changecategory: "Change Category",
      share: "Share",
      export: "Export",
      export_description: "Choose the export format",
      export_txt: "Plain Text (.txt)",
      info: "Information",
    },
    info: {
      title: "Information",
      type: "Type",
      category: "Category",
      created: "Created",
      updated: "Updated",
      flags: "Flags",
      no_flags: "None",
      offline: "Offline",
      close: "Close",
    },
    find_replace: {
      search_placeholder: "Search...",
      replace_placeholder: "Replace with...",
      replace_short: "Replace",
      replace_one: "Replace",
      replace_all: "All",
    },
  },
  kanban: {
    add_column: "Add column",
    add_card: "Add card",
    column_name_placeholder: "Column name",
    delete_column: "Delete column",
    move_to: "Move to",
    no_columns: "No columns.\nAdd one to get started.",
    no_cards: "No cards",
    columns_count: "columns",
    cards_count: "cards",
  },
  code: {
    add_tab: "Add tab",
    tab_title_placeholder: "Filename",
    code_placeholder: "Write your code here...",
    max_tabs_reached: "Maximum 6 tabs reached",
    delete_tab: "Delete tab",
    delete_tab_confirm: "Are you sure you want to delete this tab? This can't be undone.",
    language: "Language",
  },
  changecategory: {
    title: "Change Category",
  },
  cloudsync: {
    title: "Cloud Sync",
    syncing_1: "Sync on-going...",
    syncing_2: "Wait until finishes",
    enable: "Enable Cloud sync",
    save: "Save settings",
    edit: "Edit settings",
    resync: "Resync data",
    resync_confirm_title: "Resync data?",
    resync_confirm_desc:
      "This uploads your notes and categories to the cloud and downloads the ones already stored there, merging both. Do you want to continue?",
    deleteDevices: "Manage devices",
    handshakeFailed: "Connection attempt failed",
    handshakeFailedDesc: "Unable to connect to the Firebase server.",
    vault: {
      setup_title: "Protect your notes",
      setup_desc:
        "You're turning on end-to-end encryption for cloud sync. Choose an encryption password — it's the key that keeps your notes private.",
      migrate_title: "Turn on encryption",
      migrate_desc:
        "We're upgrading your cloud sync to end-to-end encryption. Choose an encryption password — the notes already in your cloud will be re-encrypted with it, and you'll enter this password once on each device.",
      point_private:
        "Only you can read your notes — not us, not Google. They're encrypted on your device before they're uploaded.",
      point_password: "Your notes are protected by an encryption password that you choose and only you know.",
      point_devices: "You'll enter this password once on each device you sync.",
      point_norecover:
        "We can't reset it for you. If you forget it, you'll need the recovery key we show you next — so keep it somewhere safe.",
      unlock_title: "Unlock your notes",
      unlock_desc: "Enter your encryption password to read and sync your notes on this device.",
      unlock_action: "Unlock",
      recover_title: "Recover your access",
      recover_desc: "Lost your password? Enter your recovery key and choose a new encryption password.",
      recovery_title: "Recovery key",
      recovery_desc:
        "Write this down and keep it somewhere safe. It's the only way back into your notes if you ever forget your password — and we won't show it again.",
      recovery_saved: "I've saved it",
      change_title: "Change password",
      change_desc:
        "Enter your current password and choose a new one. Your notes stay encrypted and aren't touched, and devices already unlocked keep working — only the password itself changes. From now on, any new device will need the new password to unlock.",
      change_action: "Change password",
      change_success: "Encryption password changed",
      changePassphrase: "Change password",
      reset_title: "Reset encryption",
      reset_desc:
        "Only use this if you've lost both your password and your recovery key. It deletes the encrypted notes in the cloud and starts over. Notes on this device are kept and re-uploaded with a new password.",
      reset_action: "Reset encryption",
      resetVault: "Reset encryption",
      passphrase_placeholder: "Encryption password",
      passphrase_confirm_placeholder: "Confirm password",
      current_passphrase_placeholder: "Current password",
      new_passphrase_placeholder: "New password",
      recovery_key_placeholder: "Recovery key",
      passphrase_too_short: "Use at least 8 characters",
      passphrase_mismatch: "The passwords don't match",
      wrong_passphrase: "Wrong password, try again",
      wrong_recovery_key: "That recovery key isn't valid",
      forgot_passphrase: "Forgot your password?",
      continue: "Continue",
      creating: "Setting up encryption…",
      migrating: "Encrypting your notes…",
      unlocking: "Unlocking…",
      saving: "Saving…",
      finishing: "Finishing up…",
      uploading: "Encrypting and uploading your notes…",
      resetting: "Resetting…",
      error_generic: "Something went wrong. Please try again.",
      verify_failed: "Couldn't check your encryption status. Check your connection and try again.",
      locked_prompt: "Your notes are locked — unlock them in Cloud settings to sync.",
      setup_prompt: "Set up end-to-end encryption in Cloud settings to protect and sync your notes.",
      setup_action: "Turn on encryption",
      setup_cta_hint:
        "Your notes aren't encrypted yet. Turn on end-to-end encryption to protect them — it only takes a moment.",
      locked_cta_title: "Sync is paused",
      locked_cta_hint:
        "Your notes are encrypted and locked on this device, so cloud sync is on hold. Enter your encryption password to unlock them and resume syncing.",
      enable_hint: "Cloud sync is end-to-end encrypted — only you can read your notes, not us and not Google.",
      prompt_title: "Sync paused",
      prompt_desc: "Your notes aren't syncing yet. Finish setting up encryption in Cloud settings to turn sync back on.",
      prompt_close: "Close",
      prompt_go: "Go to Cloud sync",
      backup_hint:
        "Tip: export an encrypted backup of your notes before continuing. It's optional, but it's a safe fallback in case anything goes wrong.",
      backup_action: "Quick backup",
    },
  },
  synceddevices: {
    title: "Synced Devices",
    lastSync: "Last sync: ",
    error_fetching: "Error fetching devices",
    upToDate: "Up to date",
    pending: "{{count}} pending",
    mostRecent: "Most recent",
  },
  createcategory: {
    title_create: "Create Category",
    title_update: "Update Category",
    name_title: "Name",
    name_placeholder: "Enter category name here...",
    icon_title: "Icon",
    notes_num: "Notes: ",
  },
  organizecategory: {
    title: "Organize",
  },
  trashednotes: {
    title: "Trashed Notes",
    countdown: "Delete in: {{days}} day(s), {{hours}} hour(s) and {{minutes}} minute(s)",
    settings: {
      delete_all: "Delete all",
      restore_all: "Restore all",
      delete_selected: "Delete selected",
      restore_selected: "Restore selected",
    },
  },
  webhooks: {
    title: "Webhooks",
    addTextNote: "Add Text Note",
    addTodoNote: "Add Todo Note",
    addKanbanNote: "Add Kanban Note",
    addCodeNote: "Add Code Note",
    updateNote: "Update Note",
    temporaryDeleteNote: "Temporary Delete Note",
    deleteNote: "Delete Note",
    restoreNote: "Restore Note",
    createCategory: "Create Category",
    deleteCategory: "Delete Category",
    updateCategory: "Update Category",
    exportData: "Export Data",
    exporData: "Export Data",
    importData: "Import Data",
    wipeData: "Wipe Data",
  },
  generalsettings: {
    title: "Settings",
    basic: "Basic",
    cloudsync: "Cloud Sync",
    temporary_trash_lifespan: "Temporary trash lifespan",
    days: "days",
    change_secret_code: "Change your secret code",
    enable_fingerprint: "Enable Fingerprint",
    fingerprint_reason: "Unlock your notes",
    advanced: "Advanced",
    show_hidden: "Show hidden notes",
    export_import_data: "Export/Import data",
    export_import_popup_title: "Secret Passphrase",
    export_import_placeholder_input: "Enter secret code...",
    export_popup_description:
      "Write your secret passphrase here. Remember to save it otherwise you won't be able to recover your notes.",
    import_popup_description: "Write your secret passphrase here to import your notes.",
    webhooks: "Webhooks",
    voice_recognition: "Voice recognition",
    ai_assistant: "AI Assistant",
    note_creation: "Note creation",
    wipe_data: "Wipe data",
    developer_options: "Developer options",
    about: "About",
    about_the_app: "About the app",
    about_the_developer: "About the developer",
    check_updates: "Check updates",
    checking_updates: "Checking...",
    update_available: "Update available",
    update_confirm: "Do you want to install it now?",
    no_updates: "You are using the latest version.",
    feedback_and_help: "Feedback and Help",
    help: "Help",
    changelog: "Changelog",
    report: "Report a problem",
    suggest: "Recommend to a friend",
  },
  info: {
    title: "Information",
    fastmemo: "Fast Memo",
    app: "App",
    version: "Version",
    libraries: "Libraries",
  },
  note_creation: {
    title: "Note creation",
    mode_section: "Mode",
    default_type_section: "Default note type",
    mode: {
      simple: "Simple",
      simple_description: "Tap creates a text note. Use the dropdown for other types.",
      smart: "Smart",
      smart_description: "Tap always creates the type you choose below.",
      adaptive: "Adaptive",
      adaptive_description: "Tap creates the same type as your last note.",
    },
  },
  aboutdeveloper: {
    title: "About me",
    freelance: "Freelance Web Developer",
    information: "Information",
    developer: "Developer",
    website: "Website",
    openLink: "Open link",
  },
  ai: {
    title: "AI Assistant",
    model: "Model",
    status: "Status",
    settings: "Settings",
    enabled: "Enabled",
    downloaded: "Downloaded",
    not_downloaded: "Not downloaded",
    downloading: "Downloading...",
    download_model: "Download model",
    cancel: "Cancel",
    delete_model: "Delete model",
    info: "The AI assistant runs entirely on your device. No data is sent to external servers. The model needs to be downloaded once (~400 MB) and will be stored locally.",
    model_light: "Fast, basic quality. 3GB+ RAM required.",
    model_powerful: "Good balance of speed and quality. 4GB+ RAM required.",
    model_advanced: "High quality results. 6GB+ RAM required.",
    model_pro: "Best quality, near-desktop performance. 8GB+ RAM required.",
    model_unavailable: "Not enough RAM on this device",
    capabilities_title: "What can I do?",
    cap: {
      generate_title: "Generate a title from note content",
      summarize: "Summarize a text note into a few sentences",
      fix_grammar: "Fix spelling and grammar",
      shorten: "Make a text shorter and more concise",
      translate: "Translate a note into your app language",
      suggest_items: "Suggest new items for a checklist",
      suggest_category: "Suggest the best category for a note",
      voice_cleanup: "Clean up dictated text with punctuation",
      explain_code: "Explain what code does",
      add_comments: "Add inline comments to code",
    },
    unavailable_web: "AI Assistant is only available on mobile devices.",
    native_rebuild_needed: "AI Assistant requires a native rebuild.\nRun: npx expo run:android",
    voice_only: "Voice only",
    voice_only_hint: "Interact with the assistant using only your voice",
    listening: "Listening...",
    tap_to_speak: "Tap the mic to speak",
    sending_soon: "Sending...",
    placeholder: "What would you like to do?",
    processing: "Thinking...",
    feedback: {
      note_created: 'Note "{{title}}" created',
      property_toggled: "{{count}} note(s) updated",
      note_deleted: "{{count}} note(s) moved to trash",
      category_changed: "{{count}} note(s) moved",
      done: "Done",
      note_renamed: 'Note renamed to "{{title}}"',
      items_added: "{{count}} item(s) added",
      category_created: 'Category "{{name}}" created',
      note_restored: "{{count}} note(s) restored",
      category_switched: 'Switched to "{{name}}"',
      no_notes_found: "No matching notes found",
      category_not_found: "Category not found",
      not_todo_note: "That note is not a checklist",
      category_exists: "Category already exists",
      note_converted: 'Note "{{title}}" converted',
      notes_merged: 'Notes merged into "{{title}}"',
      setting_changed: "Setting updated",
      help_message:
        'I can create notes, lists and boards, delete, rename, convert and merge notes, and more.\nTry: "Create a shopping list with milk and bread"\nSee all features in Settings > AI Assistant.',
      same_type: "The note is already that type",
      not_understood: "I can only help with notes",
      error: "Something went wrong, try again",
      voice_unavailable: "Voice not available",
    },
    editor: {
      generate_title: "Generate title",
      summarize: "Summarize",
      suggest_items: "Suggest items",
      suggest_category: "Suggest category",
      explain_code: "Explain code",
      add_comments: "Add comments",
      fix_grammar: "Fix grammar",
      shorten: "Make shorter",
      translate: "Translate",
      min_model: "Minimum",
      before: "Before",
      after: "After",
      apply: "Apply",
      no_content: "Write something first",
      no_category_match: "No matching category found",
      error: "Could not generate, try again",
    },
  },
  voicerecognition: {
    title: "Voice recognition",
    enabled: "Enabled",
    interimResults: "Real-time transcription",
    continuous: "Manual stop",
    language: "Language",
    language_default: "Default (system)",
    dictation: {
      listening: "Listening…",
      paused: "Paused",
      hint: 'Speak now. Say "comma", "period", "question mark" or "new line" to punctuate.',
      insert: "Insert",
      cancel: "Cancel",
      ai_cleanup: "Clean up with AI",
      processing: "Cleaning up…",
    },
  },
  help: {
    title: "Help",
    search_placeholder: "How can we help you?",
    no_results: "No results. Try another word.",
    search_placeholders: [
      "Search or describe what you need…",
      "How do I create a note?",
      "What does the toolbar do?",
      "How does cloud sync work?",
      "How do I recover a deleted note?",
    ],
    ai_thinking: "Searching with AI…",
    ai_results: "AI results · tap to clear",
    ai_invite_title: "Can't find what you're looking for?",
    ai_invite_subtitle: "Describe it in your own words and let the AI assistant find the right topic.",
    cat_notes: "Notes",
    cat_editor: "Editor & formatting",
    cat_categories: "Categories",
    cat_trash: "Trash",
    cat_cloud: "Cloud sync & encryption",
    cat_data: "Security & data",
    cat_settings: "Settings",
    cat_more: "More & info",
    cat_ai: "AI Assistant",
    how_to_create_note: {
      title: "How do I create a note?",
      text_1_0: "Tap the",
      text_1_1: "button in the bottom-right corner of the Home screen.",
      text_2_0: "A new page opens where you can add a title and write your note.",
      text_3_0: "To save it, just go back to the Home screen.",
    },
    how_to_create_todo_note: {
      title: "How do I create a to-do list?",
      text_1_0: "Tap the",
      text_1_1: "button in the bottom-right corner of the Home screen.",
      text_2_0: "A new page opens where you can add a title and your to-do items.",
      text_3_0: "Drag the six dots on the right of an item to move it up or down.",
      text_4_0: "Tap the cross on the right to remove an item.",
      text_5_0: "The buttons at the bottom let you:",
      text_6_0: "• Add — add a new item to the list.",
      text_7_0:
        "• Switch mode — switch between List (a classic checklist) and Step (a numbered, sequential list you complete in order).",
      text_8_0: "• Delete all — remove every item in the list.",
      text_9_0: "To save it, just go back to the Home screen.",
    },
    how_to_create_kanban_note: {
      title: "How do I create a Kanban board?",
      text_1_0: "Tap the",
      text_1_1: "button in the bottom-right corner of the Home screen and choose 'Kanban'.",
      text_2_0: "A board opens with one column ready to use.",
      text_3_0: "• Add a column — tap 'Add column' on the right (up to 10).",
      text_4_0: "• Rename a column — edit the text in its header.",
      text_5_0: "• Change a column's color — tap the colored square in its header.",
      text_6_0: "• Add a card — tap 'Add card' at the bottom of a column.",
      text_7_0: "• Move a card — press and hold it, then drag it to another column.",
      text_8_0: "• Delete a card — tap the trash icon on the card.",
      text_9_0: "• Delete a column — tap the trash icon in its header.",
      text_10_0: "To save the board, just go back to the Home screen.",
    },
    how_to_create_code_note: {
      title: "How do I create a code note?",
      text_1_0: "Tap the",
      text_1_1: "button in the bottom-right corner of the Home screen and choose 'Code'.",
      text_2_0: "You get a real code editor with syntax highlighting.",
      text_3_0: "• Tabs — keep several snippets in one note; add, rename, delete or drag them to reorder (up to 6).",
      text_4_0: "• Language — tap the language bar to pick one, or let it be detected automatically.",
      text_5_0: "• Find & replace — tap the search icon at the top, just like in a text note.",
      text_6_0: "To save it, just go back to the Home screen.",
    },
    how_to_edit_note: {
      title: "How do I edit a note?",
      text_1_0: "Just tap the note on the Home screen to open it and make your changes.",
    },
    how_to_delete_note: {
      title: "How do I delete a note?",
      text_1_0: "While viewing a note, tap",
      text_1_1: "in the top-right corner.",
      text_2_0: "A menu opens — 'Delete' is the first option.",
    },
    how_to_select_notes: {
      title: "How do I select several notes at once?",
      text_1_0: "Press and hold any note to start selecting.",
      text_2_0:
        "This turns on selection mode, where you can act on multiple notes together — delete them, or mark them as important, read-only or locked.",
    },
    what_are_hidden_notes: {
      title: "How do hidden notes work?",
      text_1_0: "Open a note's options menu and tap 'Hide' to keep it out of sight on the Home screen.",
      text_2_0:
        "To see hidden notes again, turn on 'Show hidden notes' in the advanced settings — you'll need your secret code to do it.",
    },
    what_toolbar_below: {
      title: "What's the toolbar at the bottom?",
      text_1_0: "It lets you format and enrich your text. Here's what the buttons do:",
      text_2_0: "• Undo / Redo — step back or forward through your latest changes.",
      text_3_0: "• Image — insert a picture from your gallery.",
      text_4_0: "• Bold — make the selected text bold.",
      text_5_0: "• Italic — make the selected text italic.",
      text_6_0: "• Strikethrough — cross out the selected text.",
      text_7_0: "• Underline — underline the selected text.",
      text_8_0: "• Subscript — lower the text slightly below the line.",
      text_9_0: "• Superscript — raise the text slightly above the line.",
      text_10_0: "• Bullet list — start a bulleted list.",
      text_11_0: "• Numbered list — start a numbered list.",
      text_12_0: "• Code — wrap the text in a formatted code block.",
    },
    what_find_replace: {
      title: "How do I find and replace text?",
      text_1_0: "While editing a text or code note, tap the search icon in the top-right corner.",
      text_2_0: "Type what you're looking for: the arrows jump between matches and show how many there are.",
      text_3_0: "Turn on 'Replace' to swap the current match, or replace every match at once.",
    },
    what_are_settings_note: {
      title: "What are the note options?",
      text_1_0: "Open a note and tap the ⋮ menu in the top-right corner. From there you can:",
      text_2_0: "• Delete — move the note to the trash.",
      text_3_0: "• Important — mark the note so it stands out at the top.",
      text_4_0: "• Protect — lock the note behind your secret code or fingerprint.",
      text_5_0: "• Read-only — keep the note from being edited by accident.",
      text_6_0: "• Hide — keep the note off the Home screen until you choose to show hidden notes.",
      text_7_0: "• Make offline — keep the note only on this device, never synced to the cloud.",
      text_8_0: "• Change category — move the note to another category.",
      text_9_0: "• Export (text notes) — save the note as a .txt, Markdown or PDF file.",
      text_10_0: "• Information — see the note's type, category and dates.",
    },
    how_create_category: {
      title: "How do I create a category?",
      text_1_0: "On the Home screen, tap",
      text_1_1: "in the top-left corner.",
      text_2_0: "This opens the 'Organize' page. There, tap",
      text_2_1: "in the bottom-right corner.",
      text_3_0: "On the 'Create category' page, give it a name and pick an icon that isn't already in use.",
      text_4_0: "When you're done, tap",
      text_4_1: "in the bottom-right corner to save it.",
    },
    how_edit_category: {
      title: "How do I edit a category?",
      text_1_0: "On the Home screen, tap",
      text_1_1: "in the top-left corner.",
      text_2_0:
        "On the 'Organize' page, tap the category you want to change — its edit page opens, where you can rename it or pick a new icon.",
    },
    how_organize_categories: {
      title: "How do I reorder my categories?",
      text_1_0: "On the Home screen, tap",
      text_1_1: "in the top-left corner.",
      text_2_0: "On the 'Organize' page, tap",
      text_2_1: "to enter organize mode.",
      text_3_0: "Tap a category to pick it up, then tap another to drop it there and change the order.",
      text_4_0: "When you're happy with the order, tap",
      text_4_1: "to save it.",
      text_5_0: "To discard your changes, tap",
      text_5_1: "in the top-right corner.",
    },
    how_delete_category: {
      title: "How do I delete a category?",
      text_1_0: "On the Home screen, press and hold a category to enter selection mode.",
      text_2_0: "Then tap",
      text_2_1: "and choose whether to delete the category together with its notes, or keep the notes by moving them to 'All'.",
    },
    what_are_trashed_notes: {
      title: "What is the trash?",
      text_1_0: "When you delete a note it isn't gone right away — it goes to the trash first.",
      text_2_0:
        "Notes stay there for 7 days and are then removed for good. You can change how long they're kept in the basic settings.",
    },
    how_restore_trashed_notes: {
      title: "How do I restore deleted notes?",
      text_1_0: "Open the 'Trash' page and tap a note — you'll be asked whether you want to restore it.",
      text_2_0: "To restore several at once, press and hold a note, select the ones you want, then tap",
      text_2_1: "in the top-right corner.",
      text_3_0: "In the menu that appears, choose 'Restore'.",
      text_4_0: "To bring everything back at once, tap",
      text_4_1: "in the top-right corner.",
      text_5_0: "In the menu that appears, choose 'Restore all'.",
    },
    how_restore_delete_notes: {
      title: "How do I permanently delete notes from the trash?",
      text_1_0: "Open the 'Trash' page, press and hold a note to enter selection mode, then pick the ones to remove.",
      text_2_0: "Tap",
      text_2_1: "in the top-right corner.",
      text_3_0: "In the menu that appears, choose 'Delete'.",
      text_4_0: "To empty the whole trash at once, tap",
      text_4_1: "in the top-right corner.",
      text_5_0: "In the menu that appears, choose 'Delete all'.",
    },
    what_cloud_sync: {
      title: "What is Cloud Sync?",
      text_1_0:
        "You can sync your notes across devices by connecting your own Google Firebase project and enabling sync. There is no central Fast Memo server — your data lives only in your Firebase.",
      text_2_0: "Your notes are end-to-end encrypted on your device before they're uploaded, so no one but you can read them.",
      text_link: "Read the step-by-step guide to set up Google Firebase →",
    },
    what_encryption: {
      title: "How are my notes encrypted?",
      text_1_0:
        "Cloud Sync uses end-to-end encryption. The first time you set it up you choose an encryption password, and your device derives from it the key that protects your notes.",
      text_2_0:
        "The key never leaves your device and is never stored in the cloud, so even someone with access to your Firebase cannot read your note contents without your password.",
      text_3_0: "Note contents are encrypted; titles and dates stay readable so the app can sort and sync them.",
    },
    how_unlock_device: {
      title: "Why do I need to unlock on each device?",
      text_1_0:
        "Each device unlocks encryption once by entering your password. After that the key is stored securely on the device (Keychain / Keystore), so you don't re-enter it at every launch.",
      text_2_0:
        "If a device stays locked, syncing is paused on it until you unlock — this prevents your notes from ever being saved unreadable.",
    },
    forgot_password: {
      title: "I forgot my encryption password",
      text_1_0: "When you set up encryption you are shown a recovery key once. Keep it somewhere safe.",
      text_2_0:
        "On the unlock screen choose 'Forgot password', enter your recovery key, and set a new password. No notes are lost.",
      text_3_0:
        "If you lose both the password and the recovery key, your cloud notes cannot be decrypted by anyone — that is the point of end-to-end encryption.",
    },
    reset_encryption: {
      title: "What does resetting encryption do?",
      text_1_0: "Resetting is the last resort, for when both the password and the recovery key are lost.",
      text_2_0:
        "It creates a fresh encryption setup from the notes currently on this device and replaces the cloud copy. Old cloud notes that can no longer be decrypted are removed.",
      text_3_0:
        "Your local notes are kept and re-uploaded, so this device loses nothing — but your other devices will need to unlock again with the new password.",
    },
    quick_backup: {
      title: "What is Quick backup?",
      text_1_0: "On the encryption setup, unlock and reset screens you'll find an optional 'Quick backup' button.",
      text_2_0:
        "It exports a passphrase-protected file of your notes straight from this device, independent of the cloud — a safety net before a big sync or a reset. Your notes always stay on this device regardless.",
    },
    what_secret_code: {
      title: "What is the secret code?",
      text_1_0: "It's the code you set the first time you opened the app, and you'll need it to open any note you've locked.",
      text_2_0: "You can change it anytime from the basic settings.",
    },
    what_import_export: {
      title: "What are import and export?",
      text_1_0: "They let you save a copy of your data, or bring it back, right here on your device.",
      text_2_0: "When you export, a file is saved to the folder you choose.",
      text_3_0: "The file is always encrypted — you'll need the passphrase you set to import it again.",
    },
    how_export_note: {
      title: "How do I export a single note?",
      text_1_0: "Open a text note, tap the options menu and choose 'Export'.",
      text_2_0: "Then pick the format you want:",
      text_3_0: "• Plain text (.txt) — just the text, without formatting.",
      text_4_0: "• Markdown (.md) — keeps headings and basic formatting.",
      text_5_0: "• PDF — a tidy document, ready to share.",
      text_6_0: "The file is shared through your device, so you can save or send it wherever you like.",
    },
    what_wipe_data: {
      title: "What does wiping data do?",
      text_1_0: "It removes all your notes and categories from this device in one go.",
      text_2_0: "You'll be asked to confirm first, since this can't be undone.",
      text_3_0: "Once confirmed, everything is deleted permanently.",
    },
    what_note_creation: {
      title: "What does the note creation setting do?",
      text_1_0:
        "It decides what happens when you tap the [+] button on the Home screen. In Settings → Note creation you can choose:",
      text_2_0: "• Simple — [+] creates a text note; use the menu for the other types.",
      text_3_0: "• Smart — [+] always creates the type you picked as your favourite.",
      text_4_0: "• Adaptive — [+] creates the same type as the last note you worked on.",
    },
    what_home_filters: {
      title: "How do the Home filters work?",
      text_1_0: "Tap the filter icon at the top of the Home screen to change how your notes are shown.",
      text_2_0: "• Order by — sort by creation date or last update, ascending or descending.",
      text_3_0:
        "• Deep search — also search inside note contents and lists, not just titles (it asks for your secret code first).",
    },
    what_language: {
      title: "How do I change the language?",
      text_1_0: "Open the basic settings and tap 'Language' to switch.",
      text_2_0:
        "You can follow your device's language automatically, or pick one of the seven available: English, Italian, Spanish, French, German, Chinese and Japanese.",
    },
    what_version_check: {
      title: "Does the app check for updates?",
      text_1_0: "Yes — when you open Fast Memo it quietly checks whether a newer version is available.",
      text_2_0:
        "When there's an update, a 'What's new?' screen shows what changed. You can also check anytime from the settings.",
    },
    what_report_problem: {
      title: "How do I report a problem?",
      text_1_0: "Go to Settings → Report a problem.",
      text_2_0:
        "Pick a topic, describe what happened, and optionally attach a few screenshots and your device info to help us look into it.",
      text_3_0: "You can send one report per day.",
    },
    what_webhooks: {
      title: "What are webhooks?",
      text_1_0:
        "Webhooks are for power users: they let Fast Memo notify another service whenever something happens — a note created, updated or deleted, a category changed, data exported, and so on.",
      text_2_0: "Each action can call a web address of your choice. You set them up in Settings → Webhooks.",
    },
    what_platforms: {
      title: "Where can I use Fast Memo?",
      text_1_0: "Fast Memo works on both mobile and desktop (Windows, macOS and Linux), plus a web version.",
      text_2_0: "Connect the same Google Firebase project on each device and your notes stay in sync everywhere.",
    },
    what_ai_assistant: {
      title: "What is the AI Assistant?",
      text_1_0:
        "Fast Memo includes a self-hosted AI Assistant that runs entirely on your device. No data is sent to external servers.",
      text_2_0: "To set it up, go to Settings -> AI Assistant, choose a model and download it.",
      text_3_0:
        "Once enabled, a sparkle button appears inside each note editor. Tap it to access smart actions like: generate a title, summarize, continue writing, format text, suggest checklist items, or suggest a category.",
      text_4_0: "The AI works offline and supports multiple languages.",
    },
  },
  report: {
    title: "Report a Problem",
    question: "What is the topic of the issue?",
    topic: {
      crash: "Crash",
      notes: "Notes",
      categories: "Categories",
      cloud: "Cloud",
      webhooks: "Webhooks",
      export_import: "Export/Import",
      translations: "Translations",
      suggestions: "Suggestions",
      other: "Other",
    },
    descriptionPlaceholder: "Please describe the issue in detail (required)",
    deviceInfoCheckbox: "For more accurate diagnosis, kindly provide us with device details.",
    attachments: "Add Images",
    sendReport: "Send Report",

    sent_message_1: "Thank you for submitting the report.",
    sent_message_2: "Another report can be submitted from the day:",

    attachments_limit: "Attachments limit:",
    size_limit: "Size limit per image:",
    loading: "Loading...",

    messages: {
      size: {
        title: "File Too Large!",
        text: "Choose a smaller file or compress it.",
      },
      success: {
        title: "Success!",
        text: "The report has been successfully sent.",
      },
      error: {
        title: "Error!",
        text: "The report could not be sent.",
      },
      missing: {
        title: "Missing Data!",
        text: "Please fill in the topic and description of the issue.",
      },
    },
  },

  /* popup */
  popup: {
    delete_category: "Do you want to delete this Category?\nYou can MOVE notes to 'ALL' category",
    restore_single_note: "Do you want to restore this Note?",
    restore_notes: "Do you want to restore those Notes?",
    delete_notes: "Do you want to delete those Notes?",
    delete_notes_perma: "Do you want to delete those Notes permanently?",
    restore_all_notes: "Do you want to restore ALL Notes?",
    delete_all_notes_perma: "Do you want to delete ALL Notes permanently?",
    select_one_option: "Please select one option",
    passphrase_wrong: "The passphrase you entered is wrong.",
    are_you_sure_wipe: "Are you sure you want to wipe your data?\nYou will lose all notes and categories created.",
    finish_organize_categories: "Finish to organize categories or undo your changes.",
    generic_success_description: "The operation was successful.",
  },

  /* generic */
  All: "All",
  delete_and_move: "Delete and Move",
  delete_with_notes: "Delete with Notes",
  ok: "Ok",
  confirm: "Confirm",
  cancel: "Cancel",
  delete: "Delete",
  restore: "Restore",
  warning: "Warning",
  error: "Error",
  import: "Import",
  export: "Export",
  retry: "Retry",
  wipe: "Wipe all",
  wipeWithCloud: "Wipe + Cloud",
  loading: "Loading...",

  developeroptions: {
    title: "Developer Options",
    warning: "These options may compromise Cloud Sync for specific notes or affect app performance.",
    unlimited_text_space: "Unlimited text space",
    unlimited_text_space_desc: "Current limit: 1 MB",
    unlimited_kanban_columns: "Unlimited Kanban columns",
    unlimited_kanban_columns_desc: "Current limit: 10 columns",
    unlimited_trash_time: "Unlimited trash time",
    unlimited_trash_time_desc: "Current limit: 30 days",
    change_app_icon: "Change app icon",
    change_app_icon_desc: "Coming soon",
  },

  /* toast */
  disconnected: "You have been disconnected from Cloud",
  dataSynced: "Data synced",
  noInternetConnection: "No internet connection",
  devicesLimitReached: "Devices limit exceeded",
  noteLimitReached: "Note limit reached",
  developerModeActivated: "Developer mode activated!",
  developerModeAlready: "Developer mode is already active",
  developerModeTaps: "{{remaining}} tap(s) to enable developer mode",

  empty_title: "(No title)",
};

export default en;
