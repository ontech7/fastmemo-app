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

    description_2_6_0: `• Added Kanban type note.
• Redesigned Home action menu when pressing “+”.
• Redesigned note type as a badge at the top.`,

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

    description_2_2_0: `• Added the ability to hide notes.
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
  intro: {
    step1: "Add your notes with one click.",
    step2: "Enrich your text using the bottom toolbar.",
    step3: "Create a To-Do list to manage your tasks",
    step4: "Create your own category on your needs.",
    step5: "Insert a secret code to hide your notes.",
    step6: "Syncronize your notes on your Google Firebase.",
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
    toggleProtectedNote: "Insert your secret code",
    toggleProtectedSelectedNotes: "Insert your secret code",
    toggleGeneric: "Insert your secret code",
    error: "The code you entered doesn't match. Try again.",
  },
  firstMemo: {
    title: "Welcome to Fast Memo! 🔊",
  },
  home: {
    notes: "Notes",
    search: "Search something...",
    deepSearch: "Deep search (text, lists…)",

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
    created: "Created: ",
    updated: "Updated: ",
    type: {
      todo: "To-Do",
      kanban: "Kanban",
      text: "Text",
    },
    settings: {
      delete: "Delete",
      important: "Important",
      protect: "Protect",
      readonly: "Read-Only",
      hide: "Hide",
      changecategory: "Change Category",
      share: "Share",
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
    deleteDevices: "Manage devices",
    handshakeFailed: "Connection attempt failed",
    handshakeFailedDesc: "Unable to connect to the Firebase server.",
  },
  synceddevices: {
    title: "Synced Devices",
    lastSync: "Last sync: ",
    error_fetching: "Error fetching devices",
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
    wipe_data: "Wipe data",
    about: "About",
    about_the_app: "About the app",
    about_the_developer: "About the developer",
    check_updates: "Check updates",
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
  aboutdeveloper: {
    title: "About me",
    freelance: "Freelance Web Developer",
    information: "Information",
    developer: "Developer",
    website: "Website",
  },
  voicerecognition: {
    title: "Voice recognition",
    enabled: "Enabled",
    interimResults: "Real-time transcription",
    continuous: "Manual stop",
    language: "Language",
    language_default: "Default (system)",
  },
  help: {
    title: "Help",
    how_to_create_note: {
      title: "How can I create a note?",
      text_1_0: "You can create a note by clicking the",
      text_1_1: "button on bottom-right corner of Home page.",
      text_2_0: "It will popup a new page where you can write a title and a description to your note.",
      text_3_0: "You are able to save it by going back in the Home page.",
    },
    how_to_create_todo_note: {
      title: "How can I create a To-Do note?",
      text_1_0: "You can create a To-Do note by clicking the",
      text_1_1: "button on bottom-right corner of Home page.",
      text_2_0: "It will popup a new page where you can write a title and a list of To-Do texts to your note.",
      text_3_0: "By pressing the 6 dots on the right of an item, you will be able to move it up and down.",
      text_4_0: "The cross button on the right will delete that item.",
      text_5_0: "The buttons on the bottom are: ",
      text_6_0: "• Add: a new To-Do item will be added in the list.",
      text_7_0: "• Hide/Unhide Checked: it will be hide/unhide To-Do items if they are checked.",
      text_8_0: "• Delete All: it will remove all the To-Do items present in the note.",
      text_9_0: "You are able to save it by going back in the Home page.",
    },
    how_to_edit_note: {
      title: "How can I edit a note?",
      text_1_0: "You can edit a note by selecting it in the Home page",
    },
    how_to_delete_note: {
      title: "How can I delete a note?",
      text_1_0: "You can delete a note by clicking",
      text_1_1: "on top-right corner, when viewing a note.",
      text_2_0: "It will open a popup menù. The first option is what you are looking for.",
    },
    how_to_select_notes: {
      title: "How can I select some notes?",
      text_1_0: "You can select notes by long pressing a note.",
      text_2_0:
        "You will go in 'edit mode', and it's possible to do various actions like deleting, putting them as important, read-only or locked.",
    },
    what_toolbar_below: {
      title: "What is that toolbar below?",
      text_1_0: "The toolbar can enrich your text in lots of ways.",
      text_2_0: "• Image: you can put and cut an image from your Gallery.",
      text_3_0: "• Bold: you can put in bold your text.",
      text_4_0: "• Italic: you can put in italic your text.",
      text_5_0: "• Underline: you can put in underline your text.",
      text_6_0: "• Subset: you can put your text in a bottom position relative to your text.",
      text_7_0: "• Superset: you can put your text in a top position relative to your text.",
      text_8_0: "• Bullet list: you can create a bullet list.",
      text_9_0: "• Ordered list: you can create an ordered list.",
      text_10_0: "• Code: you can create a wrapper where you can write formatted code.",
    },
    what_are_settings_note: {
      title: "What are the settings for a note?",
      text_1_0: "The settings for notes are:",
      text_2_0: "• Delete: you can delete the current note.",
      text_3_0: "• Important: you can set your note as important",
      text_4_0: "• Protect: you can lock your note. You will need a code or your fingerprint if activated.",
      text_5_0: "• Read-Only: your note cannot be modified.",
      text_6_0: "• Change Category: you can change the category of a note to another.",
      text_7_0: "• Share: you can share the text of your note to another social application.",
    },
    how_create_category: {
      title: "How can I create a category?",
      text_1_0: "You can create a new category by clicking",
      text_1_1: "on top-left corner in Home page.",
      text_2_0: "You will be redirected to 'Organize' page. On bottom-right corner you need to click",
      text_2_1: "",
      text_3_0:
        "Once again you will be redirected to 'Create Category' page. You will be asked to create a name and select an unique icon.",
      text_4_0: "After compiling the form, the",
      text_4_1: "will appear on bottom-right corner. You must click it to save your new category.",
    },
    how_edit_category: {
      title: "How can I edit a category?",
      text_1_0: "You can edit a category by clicking",
      text_1_1: "on top-left corner in Home page.",
      text_2_0:
        "You will be redirected to 'Organize' page. You need to select a category and you will be redirected once again to 'Update Category' page.",
    },
    how_organize_categories: {
      title: "How can I organize my categories?",
      text_1_0: "You can edit a category by clicking",
      text_1_1: "on top-left corner in Home page.",
      text_2_0: "You will be redirected to 'Organize' page. You need to click",
      text_2_1: "to go in 'organize mode'",
      text_3_0:
        "When clicking a category, he will be 'not numbered'. You can click another category to change the order of categories.",
      text_4_0: "When you finished, you can click the",
      text_4_1: "the changes.",
      text_5_0: "If you want to undo your changes, you can click",
      text_5_1: "",
    },
    how_delete_category: {
      title: "How can I delete a category?",
      text_1_0: "When being in Home page, you can long press on a category, and you go in 'edit mode'.",
      text_2_0: "If you click the",
      text_2_1:
        "a popup will appear, asking you if you want to delete the category along with your notes, or just transfer them to ALL notes.",
    },
    what_are_trashed_notes: {
      title: "What are the trashed notes?",
      text_1_0: "When deleting a note, it will go to the trashed notes. It's a bin where all the notes temporarily go.",
      text_2_0:
        "By default they will last only 7 days, and then they are gone. You can change this setting from the Basic settings.",
    },
    how_restore_trashed_notes: {
      title: "How can I restore trashed notes?",
      text_1_0:
        "When being in 'Trashed notes' page, you can select a note and a popup will appear asking you if you want to restore that note.",
      text_2_0: "You can restore multiple notes by long pressing a note, and select the notes you want. Click the",
      text_2_1: "on top-right corner.",
      text_3_0: "A popup will appear, and the second option is what you are looking for.",
      text_4_0: "You can also restore all the notes present in the bin, by clicking",
      text_4_1: "on top-right corner.",
      text_5_0: "A popup will appear, and the second option is what you are looking for.",
    },
    how_restore_delete_notes: {
      title: "How can I restore delete notes?",
      text_1_0:
        "When being in 'Trashed notes' page, you can long press a note you will go in 'edit mode', and select the notes you want to delete.",
      text_2_0: "Click the",
      text_2_1: "on top-right corner.",
      text_3_0: "A popup will appear, and the first option is what you are looking for.",
      text_4_0: "You can also delete all the notes present in the bin, by clicking",
      text_4_1: "on top-right corner.",
      text_5_0: "A popup will appear, and the second option is what you are looking for.",
    },
    what_cloud_sync: {
      title: "What is Cloud Sync?",
      text_1_0: "It's possible to sync your notes by connecting your Google Firebase account and enabling the sync mode.",
      text_2_0: "You don't need to do anything else. Your notes will be stored in your Google Firebase, crypted.",
    },
    what_secret_code: {
      title: "What is a secret code?",
      text_1_0: "Your locked notes will require a secret code you generated when opening the app for the first time.",
      text_2_0: "You can change it from Basic settings.",
    },
    what_import_export: {
      title: "What is Import/Export data?",
      text_1_0: "You can import or export data locally.",
      text_2_0: "By exporting them, a file will be generated in the folder you want to save in.",
      text_3_0: "It will be crypted by default. You will need a passphrase to import it.",
    },
    what_wipe_data: {
      title: "What is Wipe data?",
      text_1_0: "You can wipe all the notes and categories.",
      text_2_0: "A popup will appear in order to ask you if you are sure about this action.",
      text_3_0: "They will be deleted permanently.",
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

  /* toast */
  disconnected: "You have been disconnected from Cloud",
  dataSynced: "Data synced",
  noInternetConnection: "No internet connection",
  devicesLimitReached: "Devices limit exceeded",
  noteLimitReached: "Note limit reached",

  empty_title: "(No title)",
};

export default en;
