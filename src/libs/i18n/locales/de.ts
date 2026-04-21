const de = {
  languageCode: "de",
  languageName: "Deutsch",

  date: {
    mon: "Mon",
    tue: "Die",
    wed: "Mit",
    thu: "Don",
    fri: "Fre",
    sat: "Sam",
    sun: "Son",
  },
  changelog: {
    title: "Was gibt's Neues?",

    web: {
      description_0_3_0: `• Neuer Notiztyp: Code, mit integriertem Editor, Syntaxhervorhebung, mehreren Tabs und automatischer Spracherkennung.
• Such- und Ersetzungsfunktion in Textnotizen hinzugefugt.
• Notiz-Export hinzugefugt.
• Verschiedene Fehlerbehebungen.`,

      description_0_2_0: `• Kanban-Spalten koennen jetzt verschoben werden.
• Animationen verbessert.
• Verschiedene Korrekturen.`,

      description_0_1_1: `• Cloud-Synchronisierung beim Start der App behoben.
• Notizen werden nach jeder Synchronisierung nun korrekt sortiert.`,

      description_0_1_0: `• Erste Veröffentlichung von Fast Memo Desktop (BETA) mit allen mobilen Funktionen.`,
    },

    mobile: {
      description_2_9_0: `• Neuer Notiztyp: Code, mit integriertem Editor, Syntaxhervorhebung, mehreren Tabs und automatischer Spracherkennung.
• Qwen 2.5 7B Modell mit Gerate-RAM-Erkennung hinzugefugt. Neue AI-Aktionen fur Code: Code erklaren und Kommentare hinzufugen.
• Such- und Ersetzungsfunktion in Textnotizen hinzugefugt.
• Notiz-Export hinzugefugt.
• Verschiedene Fehlerbehebungen.`,

      description_2_8_0: `• Self-hosted KI-Assistent (Qwen 2.5) mit smarten Funktionen fuer Notizen hinzugefuegt. Einrichtung unter Einstellungen -> KI-Assistent.
• Kanban-Spalten koennen jetzt verschoben werden.
• Animationen verbessert.
• Verschiedene Korrekturen.`,

      description_2_7_1: `• Cloud-Synchronisierung beim Start der App behoben.
• Notizen werden nach jeder Synchronisierung nun korrekt sortiert.`,

      description_2_7_0: `• Kanban-Drag-and-Drop auf Mobilgeräten, Tablets und am Desktop behoben.
• Mobile- und Desktop-App angeglichen.
• Offizielle Veröffentlichung der Desktop-App.`,

      description_2_6_2: `• Notiztyp Kanban hinzugefügt.
• Startseite beim Drücken von „+“ überarbeitet.
• Notiztyp als Abzeichen oben neu gestaltet.
• Verschiedene Korrekturen.`,

      description_2_5_3: `• Verschiedene Korrekturen.`,

      description_2_5_2: `• Möglichkeit hinzugefügt, Notizen nach Erstellungsdatum und Aktualisierungsdatum neu anzuordnen.
• Möglichkeit hinzugefügt, die Sprache direkt in den Einstellungen zu ändern.
• Überarbeitung der Modals.
• Verschiedene Korrekturen.`,

      description_2_4_2: `• Überarbeitete und verbesserte interne Struktur der App für mehr Geschwindigkeit und Stabilität.
• Sprach­erkennung zur Transkription von Notizen (Text und Listen) hinzugefügt.
• Hinzugefügt: Möglichkeit zur Durchführung von Tiefensuchen (Text und Listen).
• Verschiedene Fehlerbehebungen.`,

      description_2_3_0: `• Japanische Sprache hinzugefügt.
• Webhooks auf BETA-Version 2.0 aktualisiert.
• Verschiedene Korrekturen.`,

      description_2_2_1: `• Hinzugefügt die Möglichkeit, Notizen zu verstecken.
• Hinzugefügt die Möglichkeit, ein Problem in den Einstellungen → Feedback und Unterstützung zu melden.
• Verschiedene Korrekturen.`,

      description_2_1_0: `• Anzahl der Notizbuchstaben und maximale Notizgröße hinzugefügt.
• Anzahl der Elemente in ToDo-Notiz hinzugefügt.
• Maximale Grenze für Cloud-Geräte hinzugefügt (3).
• Verschiedene Korrekturen.`,

      description_2_0_0: `• Cloud-Synchronisierung mit Google Firebase hinzugefügt.
• Webhooks-Verwaltung hinzugefügt (für erfahrene Benutzer).
• Links- und Mittelausrichtungsoptionen für Textnotizen hinzugefügt.
• Geheimcode für einige Optionen hinzugefügt.
• Größe aller Elemente geändert.
• Geändertes Design für den Geheimcode-Bildschirm.
• Der Stil der To-Do-Notiz wurde geändert.
• Verschiedene Korrekturen.`,

      description_1_4_0: `• Notiz vom Typ "Aufgaben" hinzugefügt.
• Verschiedene Korrekturen.`,

      description_1_3_0: `• Übersetzungen für Italienisch, Spanisch, Französisch, Deutsch und Chinesisch hinzugefügt.
• Neue Symbole für Kategorien hinzugefügt.
• Verschiedene Korrekturen.`,

      description_1_2_1: `• Freigabe in Produktion.
• Notizen, temporäre Notizen, Kategorien usw. hinzugefügt.
• Geheimcode hinzugefügt.
• Verschiedene Korrekturen.`,
    },
  },
  intro: {
    step1: "Fügen Sie Ihre Notizen mit einem Klick hinzu.",
    step2: "Bereichern Sie Ihren Text mithilfe der unteren Symbolleiste.",
    step3: "Erstellen Sie eine To-Do-Liste, um Ihre Aufgaben zu verwalten.",
    step4: "Erstellen Sie Ihre eigene Kategorie entsprechend Ihren Anforderungen.",
    step5: "Geben Sie einen Geheimcode ein, um Ihre Notizen zu verbergen.",
    step6: "Synchronisieren Sie Ihre Notizen auf Ihrer Google Firebase.",
    title: "Was ist Fast Memo?",
    continue: "Geht weiter",
  },
  setupcode: {
    title: "Geheim Code",
    firstCode_1: "Erstellen Sie einen Geheimcode, um Ihre Notizen zu verbergen.",
    firstCode_2: "Sie können in den Einstellungen zum Fingerabdruck wechseln.",
    repeatCode: "Wiederholen Sie Ihren Geheimcode.",
    savedCode: "Ihr Geheimcode wurde gespeichert!",
    error: "Der eingegebene Code stimmt nicht überein. Versuchen Sie es erneut.",
  },
  secretcode: {
    title: "Geheim Code",
    oldCode: "Geben Sie Ihren alten Geheimcode ein.",
    newCode: "Geben Sie nun Ihren neuen Geheimcode ein.",
    repeatCode: "Wiederholen Sie Ihren neuen Geheimcode.",
    savedCode: "Ihr neuer Geheimcode wurde gespeichert!",
    unlockCode: "Geben Sie Ihren Geheimcode ein",
    error: "Der von Ihnen eingegebene Code stimmt nicht überein. Versuchen Sie es erneut.",
  },
  firstMemo: {
    title: "Willkommen bei FastMemo! 🔊",
  },
  home: {
    notes: "Notiz",
    search: "Nach etwas suchen…",
    deepSearch: "Tiefensuche (Text, Listen…)",

    filters: {
      deepSearch: "Tiefensuche",
      orderBy: "Sortieren nach:",
      createdAt: "Erstellungsdatum",
      updatedAt: "Aktualisierungsdatum",
    },
  },
  note: {
    title_placeholder: "Titel",
    description_placeholder: "Schreiben Sie hier etwas…",
    no_items: "Es sind keine Elemente vorhanden.\nFügen Sie eines hinzu, indem Sie auf die Schaltfläche unten rechts klicken.",
    characters: "Textzeichen",
    completati: "vollendet",
    on: "von",
    created: "Erstellt: ",
    updated: "Geändert: ",
    type: {
      todo: "Liste",
      kanban: "Kanban",
      text: "Text",
      code: "Code",
    },
    settings: {
      delete: "Löschen",
      important: "Wichtig",
      protect: "Schützen",
      readonly: "Schreibgeschützt",
      hide: "Verstecken",
      changecategory: "Kategorie ändern",
      share: "Aktie",
      export: "Exportieren",
      export_description: "Wählen Sie das Exportformat",
      export_txt: "Klartext (.txt)",
    },
    find_replace: {
      search_placeholder: "Suchen...",
      replace_placeholder: "Ersetzen durch...",
      replace_short: "Ersetz.",
      replace_one: "Ersetzen",
      replace_all: "Alle",
    },
  },
  kanban: {
    add_column: "Spalte hinzufügen",
    add_card: "Karte hinzufügen",
    column_name_placeholder: "Spaltenname",
    delete_column: "Spalte löschen",
    move_to: "Verschieben nach",
    no_columns: "Keine Spalten.\nFügen Sie eine hinzu, um zu beginnen.",
    no_cards: "Keine Karten",
    columns_count: "Spalten",
    cards_count: "Karten",
  },
  code: {
    add_tab: "Tab hinzufugen",
    tab_title_placeholder: "Dateiname",
    code_placeholder: "Schreiben Sie Ihren Code hier...",
    max_tabs_reached: "Maximum von 6 Tabs erreicht",
    delete_tab: "Tab loschen",
    language: "Sprache",
  },
  changecategory: {
    title: "Kategorie ändern",
  },
  cloudsync: {
    title: "Cloud Sync",
    syncing_1: "Synchronisierung läuft…",
    syncing_2: "Warten Sie, bis der Vorgang abgeschlossen ist",
    enable: "Aktivieren Sie die Cloud-Sync",
    save: "Einstellungen speichern",
    edit: "Einstellungen bearbeiten",
    resync: "Daten erneut sync",
    deleteDevices: "Geräte verwalten",
    handshakeFailed: "Verbindungsversuch fehlgeschlagen",
    handshakeFailedDesc: "Es konnte keine Verbindung zum Firebase-Server hergestellt werden.",
  },
  synceddevices: {
    title: "Verbundene Geräte",
    lastSync: "Letzte Sync.: ",
    error_fetching: "Fehler beim Abrufen der Geräte",
  },
  createcategory: {
    title_create: "Kategorie Erstellen",
    title_update: "Kategorie Aktualisieren",
    name_title: "Name",
    name_placeholder: "Geben Sie hier den Kategorienamen ein...",
    icon_title: "Symbol",
    notes_num: "Notiz: ",
  },
  organizecategory: {
    title: "Organisieren",
  },
  trashednotes: {
    title: "Vernichtete Notizen",
    countdown: "Löschen in: {{days}} Tagen, {{hours}} Stunden e {{minutes}} Minuten",
    settings: {
      delete_all: "Alles löschen",
      restore_all: "Alles wiederherstellen",
      delete_selected: "Ausgewählte löschen",
      restore_selected: "Ausgewählte wiederherstellen",
    },
  },
  webhooks: {
    title: "Webhooks",
    addTextNote: "Textnotiz hinzufügen",
    addTodoNote: "Todo-Notiz hinzufügen",
    addKanbanNote: "Kanban-Notiz hinzufügen",
    addCodeNote: "Code-Notiz hinzufugen",
    updateNote: "Nota de actualización",
    temporaryDeleteNote: "Notiz vorübergehend löschen",
    deleteNote: "Notiz löschen",
    restoreNote: "Notiz wiederherstellen",
    createCategory: "Kategorie erstellen",
    deleteCategory: "Kategorie löschen",
    updateCategory: "Kategorie aktualisieren",
    exportData: "Daten exportieren",
    exporData: "Daten exportieren",
    importData: "Daten importieren",
    wipeData: "Daten löschen",
  },
  generalsettings: {
    title: "Einstellungen",
    basic: "Basic",
    cloudsync: "Cloud Sync",
    temporary_trash_lifespan: "Temporäre Papierkorbdauer",
    days: "Tage",
    change_secret_code: "Ändern Sie Ihren Geheimcode",
    enable_fingerprint: "Fingerabdruck aktivieren",
    advanced: "Fortschrittlich",
    show_hidden: "Versteckte Notizen anzeigen",
    export_import_data: "Daten exportieren/importieren",
    export_import_popup_title: "Geheime Passphrase",
    export_import_placeholder_input: "Geheimcode eingeben...",
    export_popup_description:
      "Geben Sie hier Ihre geheime Passphrase ein. Denken Sie daran, es zu speichern, da Sie Ihre Notizen sonst nicht wiederherstellen können.",
    import_popup_description: "Geben Sie hier Ihre geheime Passphrase ein, um Ihre Notizen zu importieren.",
    webhooks: "Webhooks",
    voice_recognition: "Spracherkennung",
    ai_assistant: "KI-Assistent",
    wipe_data: "Daten löschen",
    developer_options: "Entwickleroptionen",
    about: "Um",
    about_the_app: "Über die App",
    about_the_developer: "Über den Entwickler",
    check_updates: "Auf updates prüfen",
    checking_updates: "Überprüfung...",
    update_available: "Update verfügbar",
    update_confirm: "Möchten Sie es jetzt installieren?",
    no_updates: "Sie verwenden die neueste Version.",
    feedback_and_help: "Feedback und Hilfe",
    help: "Hilfe",
    changelog: "Änderungsprotokoll",
    report: "Ein Problem melden",
    suggest: "Einem Freund empfehlen",
  },
  info: {
    title: "Information",
    fastmemo: "Fast Memo",
    app: "App",
    version: "Ausführung",
    libraries: "Bibliotheken",
  },
  aboutdeveloper: {
    title: "Über mich",
    freelance: "Freiberuflicher Webentwickler",
    information: "Information",
    developer: "Entwickler",
    website: "Webseite",
  },
  ai: {
    title: "KI-Assistent",
    model: "Modell",
    status: "Status",
    settings: "Einstellungen",
    enabled: "Aktiviert",
    downloaded: "Heruntergeladen",
    not_downloaded: "Nicht heruntergeladen",
    downloading: "Wird heruntergeladen...",
    download_model: "Modell herunterladen",
    cancel: "Abbrechen",
    delete_model: "Modell loeschen",
    info: "Der KI-Assistent laeuft vollstaendig auf Ihrem Geraet. Es werden keine Daten an externe Server gesendet. Das Modell muss einmal heruntergeladen werden (~400 MB) und wird lokal gespeichert.",
    model_light: "Schnell, Basisqualitat. 3GB+ RAM erforderlich.",
    model_powerful: "Gute Balance zwischen Geschwindigkeit und Qualitat. 4GB+ RAM erforderlich.",
    model_advanced: "Hohe Qualitat. 6GB+ RAM erforderlich.",
    model_pro: "Beste Qualitat, Desktop-nahe Leistung. 8GB+ RAM erforderlich.",
    model_unavailable: "Nicht genug RAM auf diesem Gerat",
    capabilities_title: "Was kann ich?",
    cap: {
      generate_title: "Titel aus dem Notizinhalt generieren",
      summarize: "Textnotiz in wenigen Saetzen zusammenfassen",
      continue_writing: "Weiterschreiben, wo du aufgehoert hast",
      format_text: "Text mit Ueberschriften, Fettdruck, Listen usw. formatieren",
      suggest_items: "Neue Elemente fuer eine Checkliste vorschlagen",
      suggest_category: "Die beste Kategorie fuer eine Notiz vorschlagen",
      explain_code: "Erklaren was der Code macht",
      add_comments: "Kommentare zum Code hinzufugen",
    },
    unavailable_web: "KI-Assistent ist nur auf Mobilgeraeten verfuegbar.",
    native_rebuild_needed: "KI-Assistent erfordert einen nativen Rebuild.\nFuehre aus: npx expo run:android",
    voice_only: "Nur Sprache",
    voice_only_hint: "Mit dem Assistenten nur per Sprache interagieren",
    listening: "Hoere zu...",
    tap_to_speak: "Tippen Sie auf das Mikrofon zum Sprechen",
    sending_soon: "Wird gesendet...",
    placeholder: "Was moechten Sie tun?",
    processing: "Denke nach...",
    feedback: {
      note_created: 'Notiz "{{title}}" erstellt',
      property_toggled: "{{count}} Notiz(en) aktualisiert",
      note_deleted: "{{count}} Notiz(en) in den Papierkorb verschoben",
      category_changed: "{{count}} Notiz(en) verschoben",
      done: "Fertig",
      note_renamed: 'Notiz umbenannt in "{{title}}"',
      items_added: "{{count}} Element(e) hinzugefuegt",
      category_created: 'Kategorie "{{name}}" erstellt',
      note_restored: "{{count}} Notiz(en) wiederhergestellt",
      category_switched: 'Gewechselt zu "{{name}}"',
      no_notes_found: "Keine passenden Notizen gefunden",
      category_not_found: "Kategorie nicht gefunden",
      not_todo_note: "Diese Notiz ist keine Checkliste",
      category_exists: "Kategorie existiert bereits",
      note_converted: 'Notiz "{{title}}" konvertiert',
      notes_merged: 'Notizen zu "{{title}}" zusammengefuegt',
      setting_changed: "Einstellung aktualisiert",
      help_message:
        'Ich kann Notizen, Listen und Boards erstellen, loeschen, umbenennen, konvertieren und zusammenfuegen.\nVersuche: "Erstelle eine Einkaufsliste mit Milch und Brot"\nAlle Funktionen unter Einstellungen > KI-Assistent.',
      same_type: "Die Notiz ist bereits von diesem Typ",
      not_understood: "Ich kann nur bei Notizen helfen",
      error: "Etwas ist schiefgelaufen, versuche es erneut",
      voice_unavailable: "Sprache nicht verfuegbar",
    },
    editor: {
      generate_title: "Titel generieren",
      summarize: "Zusammenfassen",
      continue_writing: "Weiterschreiben",
      suggest_items: "Elemente vorschlagen",
      format_text: "Text formatieren",
      suggest_category: "Kategorie vorschlagen",
      explain_code: "Code erklaren",
      add_comments: "Kommentare hinzufugen",
      min_model: "Minimum",
      no_content: "Schreibe zuerst etwas",
      no_category_match: "Keine passende Kategorie gefunden",
      error: "Konnte nicht generieren, versuche es erneut",
    },
  },
  voicerecognition: {
    title: "Spracherkennung",
    enabled: "Aktiviert",
    interimResults: "Echtzeit-Transkription",
    continuous: "Manueller Stopp",
    language: "Sprache",
    language_default: "Standard (System)",
  },
  help: {
    title: "Hilfe",
    how_to_create_note: {
      title: "Wie kann ich eine Notiz erstellen?",
      text_1_0: "Sie können eine Notiz erstellen, indem Sie unten rechts auf der Startseite auf die Schaltfläche",
      text_1_1: "klicken.",
      text_2_0: "Es öffnet sich eine neue Seite, auf der Sie Ihrer Notiz einen Titel und eine Beschreibung hinzufügen können.",
      text_3_0: "Sie können es speichern, indem Sie zur Startseite zurückkehren.",
    },
    how_to_create_todo_note: {
      title: "Wie kann ich eine To-Do-Notiz erstellen?",
      text_1_0: "Sie können eine To-Do-Notiz erstellen, indem Sie auf klicken",
      text_1_1: "Schaltfläche unten rechts auf der Startseite.",
      text_2_0:
        "Es öffnet sich eine neue Seite, auf der Sie Ihrer Notiz einen Titel und eine Liste mit To-Do-Texten hinzufügen können.",
      text_3_0: "Durch Drücken der 6 Punkte rechts neben einem Element können Sie es nach oben und unten verschieben.",
      text_4_0: "Das Kreuz auf der rechten Seite löscht dieses Element.",
      text_5_0: "Die Schaltflächen unten sind:",
      text_6_0: "• Hinzufügen: Ein neues To-Do-Element wird zur Liste hinzugefügt.",
      text_7_0: "• Ein-/Ausblenden aktiviert: Es werden Aufgabenelemente ein-/ausblenden, wenn sie aktiviert sind.",
      text_8_0: "• Alle löschen: Alle in der Notiz vorhandenen To-Do-Elemente werden entfernt.",
      text_9_0: "Sie können es speichern, indem Sie zur Startseite zurückkehren.",
    },
    how_to_create_kanban_note: {
      title: "Wie kann ich eine Kanban-Notiz erstellen?",
      text_1_0: "Sie können eine Kanban-Notiz erstellen, indem Sie auf die Schaltfläche",
      text_1_1: "unten rechts auf der Startseite klicken und 'Kanban' auswählen.",
      text_2_0: "Eine neue Seite wird mit einer bereits erstellten Spalte angezeigt.",
      text_3_0:
        "• Um eine Spalte hinzuzufügen: Klicken Sie auf die Schaltfläche 'Spalte hinzufügen' rechts (maximal 5 Spalten).",
      text_4_0: "• Um eine Spalte umzubenennen: Bearbeiten Sie den Text in der Spaltenüberschrift.",
      text_5_0: "• Um die Farbe einer Spalte zu ändern: Klicken Sie auf das farbige Quadrat in der Überschrift.",
      text_6_0: "• Um eine Karte hinzuzufügen: Klicken Sie unten in der Spalte auf 'Karte hinzufügen'.",
      text_7_0: "• Um eine Karte zu verschieben: Halten Sie die Karte gedrückt und ziehen Sie sie in eine andere Spalte.",
      text_8_0: "• Um eine Karte zu löschen: Klicken Sie auf das Papierkorbsymbol auf der Karte.",
      text_9_0: "• Um eine Spalte zu löschen: Klicken Sie auf das Papierkorbsymbol in der Spaltenüberschrift.",
      text_10_0: "Sie können die Notiz speichern, indem Sie zur Startseite zurückkehren.",
    },
    how_to_edit_note: {
      title: "Wie kann ich eine Notiz bearbeiten?",
      text_1_0: "Sie können eine Notiz bearbeiten, indem Sie sie auf der Startseite auswählen.",
    },
    how_to_delete_note: {
      title: "Wie kann ich eine Notiz löschen?",
      text_1_0: "Sie können eine Notiz löschen, indem Sie auf klicken",
      text_1_1: "in der oberen rechten Ecke, wenn eine Notiz angezeigt wird.",
      text_2_0: "Es öffnet sich ein Popup-Menü. Die erste Option ist das, wonach Sie suchen.",
    },
    how_to_select_notes: {
      title: "Wie kann ich einige Notizen auswählen?",
      text_1_0: "Sie können Notizen auswählen, indem Sie lange auf eine Notiz drücken.",
      text_2_0:
        "Sie gelangen in den 'Bearbeitungsmodus' und können verschiedene Aktionen ausführen, z. B. löschen, sie als wichtig, schreibgeschützt oder gesperrt festlegen.",
    },
    what_toolbar_below: {
      title: "Was ist das für eine Symbolleiste unten?",
      text_1_0: "Die Symbolleiste kann Ihren Text auf viele Arten bereichern.",
      text_2_0: "• Bild: Sie können ein Bild aus Ihrer Galerie einfügen und ausschneiden.",
      text_3_0: "• Fett: Sie können Ihren Text fett formatieren.",
      text_4_0: "• Kursiv: Sie können Ihren Text kursiv schreiben.",
      text_5_0: "• Unterstreichen: Sie können Ihren Text unterstreichen.",
      text_6_0: "• Teilmenge: Sie können Ihren Text relativ zu Ihrem Text an einer unteren Position platzieren.",
      text_7_0: "• Obermenge: Sie können Ihren Text relativ zu Ihrem Text an oberster Stelle platzieren.",
      text_8_0: "• Aufzählungsliste: Sie können eine Aufzählungsliste erstellen.",
      text_9_0: "• Geordnete Liste: Sie können eine geordnete Liste erstellen.",
      text_10_0: "• Code: Sie können einen Wrapper erstellen, in den Sie formatierten Code schreiben können.",
    },
    what_are_settings_note: {
      title: "Welche Einstellungen gibt es für eine Notiz?",
      text_1_0: "Die Einstellungen für Notizen sind:",
      text_2_0: "• Löschen: Sie können die aktuelle Notiz löschen.",
      text_3_0: "• Wichtig: Sie können Ihre Notiz als wichtig festlegen",
      text_4_0:
        "• Schützen: Sie können Ihre Notiz sperren. Sie benötigen einen Code oder Ihren Fingerabdruck, falls aktiviert.",
      text_5_0: "• Schreibgeschützt: Ihre Notiz kann nicht geändert werden.",
      text_6_0: "• Kategorie ändern: Sie können die Kategorie einer Notiz in eine andere ändern.",
      text_7_0: "• Teilen: Sie können den Text Ihrer Notiz mit einer anderen sozialen Anwendung teilen.",
    },
    how_create_category: {
      title: "Wie kann ich eine Kategorie erstellen?",
      text_1_0: "Sie können eine neue Kategorie erstellen, indem Sie auf klicken",
      text_1_1: "in der oberen linken Ecke der Startseite.",
      text_2_0: "Sie werden zur Seite 'Organisieren' weitergeleitet. Klicken Sie unten rechts auf ",
      text_2_1: "",
      text_3_0:
        "Sie werden erneut zur Seite 'Kategorie erstellen' weitergeleitet. Sie werden aufgefordert, einen Namen zu erstellen und ein eindeutiges Symbol auszuwählen.",
      text_4_0: "Nach dem Kompilieren des Formulars wird das",
      text_4_1: "wird in der unteren rechten Ecke angezeigt. Sie müssen darauf klicken, um Ihre neue Kategorie zu speichern.",
    },
    how_edit_category: {
      title: "Wie kann ich eine Kategorie bearbeiten?",
      text_1_0: "Sie können eine Kategorie bearbeiten, indem Sie darauf klicken",
      text_1_1: "in der oberen linken Ecke der Startseite.",
      text_2_0:
        "Sie werden zur Seite 'Organisieren' weitergeleitet. Sie müssen eine Kategorie auswählen und werden erneut zur Seite 'Kategorie aktualisieren' weitergeleitet.",
    },
    how_organize_categories: {
      title: "Wie kann ich meine Kategorien organisieren?",
      text_1_0: "Sie können eine Kategorie bearbeiten, indem Sie darauf klicken",
      text_1_1: "in der oberen linken Ecke der Startseite.",
      text_2_0: "Sie werden zur Seite ‚Organisieren‘ weitergeleitet. Sie müssen klicken",
      text_2_1: "um in den ‚Organisierungsmodus‘ zu wechseln",
      text_3_0:
        "Wenn Sie auf eine Kategorie klicken, wird diese ‚nicht nummeriert‘. Sie können auf eine andere Kategorie klicken, um die Reihenfolge der Kategorien zu ändern.",
      text_4_0: "Wenn Sie fertig sind, können Sie auf klicken",
      text_4_1: "die Änderungen.",
      text_5_0: "Wenn Sie Ihre Änderungen rückgängig machen möchten, können Sie auf klicken",
      text_5_1: "",
    },
    how_delete_category: {
      title: "Wie kann ich eine Kategorie löschen?",
      text_1_0: "Auf der Startseite können Sie lange auf eine Kategorie drücken und gelangen so in den Bearbeitungsmodus.",
      text_2_0: "Wenn Sie auf klicken",
      text_2_1:
        "Es erscheint ein Popup, in dem Sie gefragt werden, ob Sie die Kategorie zusammen mit Ihren Notizen löschen oder sie einfach auf ALLE Notizen übertragen möchten.",
    },
    what_are_trashed_notes: {
      title: "Was sind die verworfenen Notizen?",
      text_1_0:
        "Wenn Sie eine Notiz löschen, wird sie in den Papierkorb verschoben. Es ist ein Papierkorb, in dem alle Notizen vorübergehend abgelegt werden.",
      text_2_0:
        "Standardmäßig halten sie nur 7 Tage und dann sind sie verschwunden. Sie können diese Einstellung in den Grundeinstellungen ändern.",
    },
    how_restore_trashed_notes: {
      title: "Wie kann ich gelöschte Notizen wiederherstellen?",
      text_1_0:
        "Auf der Seite 'Notizen im Papierkorb' können Sie eine Notiz auswählen und ein Popup wird angezeigt, in dem Sie gefragt werden, ob Sie diese Notiz wiederherstellen möchten.",
      text_2_0:
        "Sie können mehrere Notizen wiederherstellen, indem Sie lange auf eine Notiz drücken und die gewünschten Notizen auswählen. Klicken Sie auf",
      text_2_1: "in der oberen rechten Ecke.",
      text_3_0: "Ein Popup erscheint und die zweite Option ist genau das, wonach Sie suchen.",
      text_4_0: "Sie können auch alle im Papierkorb vorhandenen Notizen wiederherstellen, indem Sie auf klicken",
      text_4_1: "in der oberen rechten Ecke.",
      text_5_0: "Ein Popup erscheint und die zweite Option ist genau das, wonach Sie suchen.",
    },
    how_restore_delete_notes: {
      title: "Wie kann ich gelöschte Notizen wiederherstellen?",
      text_1_0:
        "Wenn Sie sich auf der Seite 'Notizen im Papierkorb' befinden, können Sie lange auf eine Notiz drücken, um in den 'Bearbeitungsmodus' zu gelangen, und die Notizen auswählen, die Sie löschen möchten.",
      text_2_0: "Klicken Sie auf",
      text_2_1: "in der oberen rechten Ecke.",
      text_3_0: "Ein Popup erscheint und die erste Option ist das, wonach Sie suchen.",
      text_4_0: "Sie können auch alle im Papierkorb vorhandenen Notizen löschen, indem Sie auf klicken",
      text_4_1: "in der oberen rechten Ecke.",
      text_5_0: "Ein Popup erscheint und die zweite Option ist genau das, wonach Sie suchen.",
    },
    what_cloud_sync: {
      title: "Was ist Cloud Sync?",
      text_1_0:
        "Sie können Ihre Notizen synchronisieren, indem Sie Ihr Google Firebase-Konto verbinden und den Synchronisierungsmodus aktivieren.",
      text_2_0: "Sie müssen nichts weiter tun. Ihre Notizen werden verschlüsselt in Ihrer Google Firebase gespeichert.",
    },
    what_secret_code: {
      title: "Was ist ein Geheimcode?",
      text_1_0:
        "Für Ihre gesperrten Notizen ist ein Geheimcode erforderlich, den Sie beim ersten Öffnen der App generiert haben.",
      text_2_0: "Sie können es in den Grundeinstellungen ändern.",
    },
    what_import_export: {
      title: "Was sind Import-/Exportdaten?",
      text_1_0: "Sie können Daten lokal importieren oder exportieren.",
      text_2_0: "Durch den Export wird eine Datei in dem Ordner generiert, in dem Sie speichern möchten.",
      text_3_0: "Es wird standardmäßig verschlüsselt. Sie benötigen eine Passphrase, um es zu importieren.",
    },
    what_wipe_data: {
      title: "Was ist Wipe-Daten?",
      text_1_0: "Sie können alle Notizen und Kategorien löschen.",
      text_2_0: "Es erscheint ein Popup, in dem Sie gefragt werden, ob Sie sich bei dieser Aktion sicher sind.",
      text_3_0: "Sie werden dauerhaft gelöscht.",
    },
    what_ai_assistant: {
      title: "Was ist der KI-Assistent?",
      text_1_0:
        "Fast Memo enthaelt einen selbst gehosteten KI-Assistenten, der vollstaendig auf deinem Geraet laeuft. Keine Daten werden an externe Server gesendet.",
      text_2_0: "Zum Einrichten gehe zu Einstellungen -> KI-Assistent, waehle ein Modell und lade es herunter.",
      text_3_0:
        "Nach der Aktivierung erscheint ein Sparkle-Button in jedem Notiz-Editor. Tippe darauf fuer smarte Aktionen wie: Titel generieren, zusammenfassen, weiterschreiben, Text formatieren, Checklisten-Elemente vorschlagen oder Kategorie vorschlagen.",
      text_4_0: "Die KI funktioniert offline und unterstuetzt mehrere Sprachen.",
    },
  },
  report: {
    title: "Problem melden",
    question: "Was ist das Thema des Problems?",
    topic: {
      crash: "Absturz",
      notes: "Notizen",
      categories: "Kategorien",
      cloud: "Cloud",
      webhooks: "Webhooks",
      export_import: "Export/Import",
      translations: "Übersetzungen",
      suggestions: "Vorschläge",
      other: "Andere",
    },
    descriptionPlaceholder: "Bitte beschreiben Sie das Problem ausführlich (erforderlich)",
    deviceInfoCheckbox: "Für eine genauere Diagnose bitten wir Sie, uns bitte Gerätedetails bereitzustellen.",
    attachments: "Füge Bilder hinzu",
    sendReport: "Bericht senden",

    sent_message_1: "Vielen Dank für das Einreichen des Berichts.",
    sent_message_2: "Ein weiterer Bericht kann ab dem Tag eingereicht werden:",

    attachments_limit: "Anhangslimit:",
    size_limit: "Größenlimit pro Bild:",
    loading: "Laden...",

    messages: {
      size: {
        title: "Datei zu groß!",
        text: "Wählen Sie eine kleinere Datei oder komprimieren Sie sie.",
      },
      success: {
        title: "Erfolg!",
        text: "Der Bericht wurde erfolgreich gesendet.",
      },
      error: {
        title: "Fehler!",
        text: "Der Bericht konnte nicht gesendet werden.",
      },
      missing: {
        title: "Fehlende Daten!",
        text: "Bitte füllen Sie das Thema und die Beschreibung des Problems aus.",
      },
    },
  },

  /* popup */
  popup: {
    delete_category: "Möchten Sie diese Kategorie löschen?\nSie können Notizen in die Kategorie 'ALLE' VERSCHIEBEN",
    restore_single_note: "Möchten Sie diese Notiz wiederherstellen?",
    restore_notes: "Möchten Sie diese Notizen wiederherstellen?",
    delete_notes: "Möchten Sie diese Notizen löschen?",
    delete_notes_perma: "Möchten Sie diese Notizen dauerhaft löschen?",
    restore_all_notes: "Möchten Sie ALLE Notizen wiederherstellen?",
    delete_all_notes_perma: "Möchten Sie ALLE Notizen dauerhaft löschen?",
    select_one_option: "Bitte wählen Sie eine Option",
    passphrase_wrong: "Die von Ihnen eingegebene Passphrase ist falsch.",
    are_you_sure_wipe:
      "Sind Sie sicher, dass Sie Ihre Daten löschen möchten?\nSie verlieren alle erstellten Notizen und Kategorien.",
    finish_organize_categories: "Fertigstellen, um Kategorien zu organisieren oder Ihre Änderungen rückgängig zu machen.",
    generic_success_description: "Der Vorgang war erfolgreich.",
  },

  /* generic */
  All: "Alle",
  delete_and_move: "Löschen und Verschieben",
  delete_with_notes: "Mit Notizen löschen",
  ok: "Ok",
  confirm: "Bestätigt",
  cancel: "Stornieren",
  delete: "Löschen",
  restore: "Wiederherstellen",
  warning: "Warnung",
  error: "Fehler",
  import: "Importieren",
  export: "Export",
  retry: "Wiederholen",
  wipe: "Alles abwischen",
  wipeWithCloud: "Abwischen + Cloud",
  loading: "Wird geladen...",

  developeroptions: {
    title: "Entwickleroptionen",
    warning:
      "Diese Optionen können die Cloud-Synchronisierung bestimmter Notizen beeinträchtigen oder die App-Leistung beeinflussen.",
    unlimited_text_space: "Unbegrenzter Textspeicher",
    unlimited_text_space_desc: "Aktuelles Limit: 1 MB",
    unlimited_kanban_columns: "Unbegrenzte Kanban-Spalten",
    unlimited_kanban_columns_desc: "Aktuelles Limit: 10 Spalten",
    unlimited_trash_time: "Unbegrenzte Papierkorb-Zeit",
    unlimited_trash_time_desc: "Aktuelles Limit: 30 Tage",
    change_app_icon: "App-Symbol ändern",
    change_app_icon_desc: "Demnächst",
  },

  /* toast */
  disconnected: "Ihre Verbindung zur Cloud wurde getrennt",
  dataSynced: "Daten synchronisiert",
  noInternetConnection: "Keine Internetverbindung",
  devicesLimitReached: "Gerätelimit überschritten",
  noteLimitReached: "Notizlimit erreicht",
  developerModeActivated: "Entwicklermodus aktiviert!",
  developerModeAlready: "Entwicklermodus ist bereits aktiv",
  developerModeTaps: "Noch {{remaining}} Tippen, um den Entwicklermodus zu aktivieren",

  empty_title: "(Kein Titel)",
};

export default de;
