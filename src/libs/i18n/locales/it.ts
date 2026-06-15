const it = {
  languageCode: "it",
  languageName: "Italiano",

  date: {
    mon: "Lun",
    tue: "Mar",
    wed: "Mer",
    thu: "Gio",
    fri: "Ven",
    sat: "Sab",
    sun: "Dom",
  },
  changelog: {
    title: "Cosa c'è di nuovo?",

    web: {
      description_1_2_0: `• Sincronizzazione cloud con crittografia end-to-end: le tue note sono protette con una chiave solo tua.
• Nuova barra "nota rapida" per scrivere al volo una nota dalla home.
• Sezione Aiuto rinnovata con ricerca intelligente basata su AI.
• Varie correzioni e miglioramenti.`,

      description_1_1_1: `• Aggiunte le note offline: mantieni una nota solo su questo dispositivo, senza sincronizzarla sul cloud.
• Riconoscimento vocale 2.0: dettatura vocale migliorata con pulizia automatica tramite AI.
• L'Assistente AI ora puo' suggerire una categoria a partire dal titolo della nota.
• Aggiunti annulla/ripeti e barrato nell'editor di testo.
• Lo sblocco desktop ora supporta Touch ID e Windows Hello.
• Fix varie.`,

      description_1_0_0: `• Prima versione stabile di Fast Memo Desktop (fuori dalla BETA).
• Nuovo design moderno in tutta l'app, con il nuovo font Geist, superfici glass e gradienti.
• Onboarding ridisegnato con nuovi step introduttivi.
• Aggiunte impostazioni di creazione nota per personalizzare i valori predefiniti.
• Aggiunta modalita' a step per le note To-Do.
• Fix varie.`,

      description_0_3_0: `• Aggiunta nuova tipologia di nota: Codice, con editor integrato, syntax highlighting, tab multiple e rilevamento automatico del linguaggio.
• Aggiunta funzione trova e sostituisci nelle note di testo.
• Aggiunta esportazione note.
• Fix varie.`,

      description_0_2_0: `• Aggiunta possibilita' di spostare le colonne kanban.
• Migliorate animazioni.
• Fix varie.`,

      description_0_1_1: `• Sistemata sincronizzazione Cloud all'avvio dell'app.
• Ora le note vengono ordinate correttamente dopo ogni sincronizzazione.`,

      description_0_1_0: `• Prima versione di Fast Memo Desktop (BETA) con tutte le funzionalità disponibili finora.`,
    },

    mobile: {
      description_3_2_0: `• Sincronizzazione cloud con crittografia end-to-end: le tue note sono protette con una chiave solo tua.
• Nuova barra "nota rapida" per scrivere al volo una nota dalla home.
• Sezione Aiuto rinnovata con ricerca intelligente basata su AI.
• Varie correzioni e miglioramenti.`,

      description_3_1_1: `• Aggiunte le note offline: mantieni una nota solo su questo dispositivo, senza sincronizzarla sul cloud.
• Riconoscimento vocale 2.0: dettatura vocale migliorata con pulizia automatica tramite AI.
• L'Assistente AI ora puo' suggerire una categoria a partire dal titolo della nota.
• Aggiunti annulla/ripeti e barrato nell'editor di testo.
• Fix varie.`,

      description_3_0_0: `• Nuovo design moderno in tutta l'app, con il nuovo font Geist, superfici glass e gradienti.
• Onboarding ridisegnato con nuovi step introduttivi.
• Aggiunte impostazioni di creazione nota per personalizzare i valori predefiniti.
• Aggiunta modalita' a step per le note To-Do.
• Rinnovate icona dell'app e schermata di avvio.
• Fix varie.`,

      description_2_9_1: `• Aggiunta nuova tipologia di nota: Codice, con editor integrato, syntax highlighting, tab multiple e rilevamento automatico del linguaggio.
• Aggiunto modello Qwen 2.5 7B con rilevamento RAM del dispositivo. Nuove azioni AI per il codice: Spiega il codice e Aggiungi commenti.
• Aggiunta funzione trova e sostituisci nelle note di testo.
• Aggiunta esportazione note.
• Fix varie.`,

      description_2_8_0: `• Aggiunta AI Assistant self-hosted nel cellulare (Qwen 2.5) con funzionalita' smart per le note. Configuralo in Impostazioni -> Assistente AI.
• Aggiunta possibilita' di spostare le colonne kanban.
• Migliorate animazioni.
• Fix varie.`,

      description_2_7_1: `• Sistemata sincronizzazione Cloud all'avvio dell'app.
• Ora le note vengono ordinate correttamente dopo ogni sincronizzazione.`,

      description_2_7_0: `• Sistemato il trascinamento Kanban su mobile, tablet e desktop.
• Allineata l'app tra Mobile e Desktop.
• Rilascio ufficiale dell'app Desktop.`,

      description_2_6_2: `• Aggiunta nota di tipo Kanban.
• Rivisitato il design della Home quando si clicca “+”.
• Rivisitato il tipo di nota: ora è un badge in alto.
• Correzioni varie.`,

      description_2_5_3: `• Correzioni varie.`,

      description_2_5_2: `• Aggiunta la possibilità di riordinare le note per data di creazione e data di aggiornamento.
• Aggiunta la possibilità di cambiare lingua direttamente dalle impostazioni.
• Rifacimento delle modali.
• Correzioni varie.`,

      description_2_4_2: `• Rivista e migliorata la struttura interna dell’app per renderla più veloce e stabile.
• Aggiunto il riconoscimento vocale per la trascrizione delle note (testo e liste).
• Aggiunta la possibilità di fare ricerche approfondite (testo e liste).
• Correzioni varie.`,

      description_2_3_0: `• Aggiunta la lingua Giapponese.
• Aggiornati webhooks alla versione BETA 2.0.
• Correzioni varie.`,

      description_2_2_1: `• Aggiunta la possibilità di nascondere le note.
• Aggiunta la possibilità di segnalare un problema in Impostazioni → Feedback e Assistenza.
• Aggiornati webhooks.
• Correzioni varie.`,

      description_2_1_0: `• Aggiunto numero lettere nota e dimensione massima nota.
• Aggiunto numero elementi in nota ToDo.
• Aggiunto limite massimo dispositivi su cloud (3).
• Correzioni varie.`,

      description_2_0_0: `• Aggiunto sincronizzazione Cloud con Google Firebase.
• Aggiunta gestione Webhook (per utenti esperti).
• Aggiunto allineamento a sinistra e centro nelle opzioni delle note di testo.
• Aggiunto codice segreto per alcune opzioni.
• Modificata grandezza di tutti gli elementi.
• Modificato design per schermata codice segreto.
• Modificato lo stile della nota To-Do.
• Correzioni varie.`,

      description_1_4_0: `• Aggiunta nota di tipo To-Do.
• Correzioni varie.`,

      description_1_3_0: `• Aggiunte traduzioni per italiano, spagnolo, francese, tedesco e cinese.
• Aggiunte nuove icone per le categorie.
• Correzioni varie.`,

      description_1_2_1: `• Rilascio in produzione.
• Aggiunte note, note temporanee, categorie, ecc.
• Aggiunto codice segreto.
• Correzioni varie.`,
    },
  },
  intro: {
    step1: "Aggiungi le tue note con un clic.",
    step2: "Arricchisci il tuo testo utilizzando la barra degli strumenti in basso.",
    step3: "Crea un elenco di cose da fare per gestire le tue attività.",
    step4: "Visualizza le tue idee con le bacheche Kanban.",
    step5: "Prendi nota dei tuoi snippets.",
    step6: "Crea la tua categoria in base alle tue esigenze.",
    step7: "Inserisci un codice segreto per nascondere le tue note.",
    step8: "Sincronizza le tue note su Google Firebase.",
    title: "Cos'è Fast Memo?",
    continue: "Continua",
  },
  setupcode: {
    title: "Codice Segreto",
    firstCode_1: "Crea un codice segreto per nascondere le tue note.",
    firstCode_2: "Sarai in grado di passare all'impronta digitale dalle impostazioni.",
    repeatCode: "Ripeti il tuo codice segreto.",
    savedCode: "Il tuo codice segreto è stato salvato!",
    error: "Il codice inserito non corrisponde. Riprova.",
  },
  secretcode: {
    title: "Codice Segreto",
    oldCode: "Metti il ​​tuo vecchio codice segreto.",
    newCode: "Ora inserisci il tuo nuovo codice segreto.",
    repeatCode: "Ripeti il ​​tuo nuovo codice segreto.",
    savedCode: "Il tuo nuovo codice segreto è stato salvato!",
    unlockCode: "Inserisci il tuo codice segreto",
    error: "Il codice inserito non corrisponde. Riprova.",
  },
  firstMemo: {
    title: "Benvenuto su Fast Memo! 🔊",
  },
  home: {
    notes: "Note",
    search: "Cerca qualcosa…",
    quickNote: "Nota rapida…",
    deepSearch: "Ricerca approfondita (testo, liste…)",
    selected_count: "{{count}} selezionate",

    filters: {
      deepSearch: "Ricerca approfondita",
      orderBy: "Ordina per:",
      createdAt: "Data di creazione",
      updatedAt: "Data di modifica",
    },
  },
  note: {
    title_placeholder: "Titolo",
    description_placeholder: "Scrivi qualcosa qui…",
    no_items: "Non sono presenti elementi.\nAggiungine uno premendo il tasto in basso a destra.",
    characters: "caratteri",
    completed: "completati",
    on: "su",
    mode_free: "Lista",
    mode_steps: "Step",
    ongoing: "In corso",
    created: "Creato: ",
    updated: "Modificato: ",
    type: {
      todo: "Lista",
      kanban: "Kanban",
      text: "Testo",
      code: "Codice",
    },
    settings: {
      delete: "Cancella",
      important: "Importante",
      protect: "Proteggi",
      readonly: "Solo lettura",
      hide: "Nascondi",
      make_offline: "Rendi offline",
      sync_to_cloud: "Sincronizza nel cloud",
      made_offline: "La nota è ora offline",
      synced_as_duplicate: "Sincronizzata nel cloud come copia",
      changecategory: "Cambia Categoria",
      share: "Condividi",
      export: "Esporta",
      export_description: "Scegli il formato di esportazione",
      export_txt: "Testo semplice (.txt)",
      info: "Informazioni",
    },
    info: {
      title: "Informazioni",
      type: "Tipo",
      category: "Categoria",
      created: "Creata",
      updated: "Modificata",
      flags: "Contrassegni",
      no_flags: "Nessuno",
      offline: "Offline",
      close: "Chiudi",
    },
    find_replace: {
      search_placeholder: "Cerca...",
      replace_placeholder: "Sostituisci con...",
      replace_short: "Sost.",
      replace_one: "Sostituisci",
      replace_all: "Tutti",
    },
  },
  kanban: {
    add_column: "Aggiungi colonna",
    add_card: "Aggiungi card",
    column_name_placeholder: "Nome colonna",
    delete_column: "Elimina colonna",
    move_to: "Sposta in",
    no_columns: "Nessuna colonna.\nAggiungine una per iniziare.",
    no_cards: "Nessuna card",
    columns_count: "colonne",
    cards_count: "card",
  },
  code: {
    add_tab: "Aggiungi tab",
    tab_title_placeholder: "Nome file",
    code_placeholder: "Scrivi il tuo codice qui...",
    max_tabs_reached: "Massimo 6 tab raggiunto",
    delete_tab: "Elimina tab",
    delete_tab_confirm: "Sei sicuro di voler eliminare questa tab? L'azione è irreversibile.",
    language: "Linguaggio",
  },
  changecategory: {
    title: "Cambia Categoria",
  },
  cloudsync: {
    title: "Sincronizzazione Cloud",
    syncing_1: "Sincronizzazione in corso…",
    syncing_2: "Aspetta fino al termine",
    enable: "Abilita sincronizzazione Cloud",
    save: "Salva impostazioni",
    edit: "Modifica impostazioni",
    resync: "Risincronizza i dati",
    resync_confirm_title: "Risincronizzare i dati?",
    resync_confirm_desc:
      "Questa operazione carica le tue note e categorie nel cloud e scarica quelle già presenti, unendole. Vuoi continuare?",
    deleteDevices: "Gestisci dispositivi",
    handshakeFailed: "Tentativo di connessione fallito",
    handshakeFailedDesc: "Non è stato possibile connettersi al server di Firebase.",
    vault: {
      setup_title: "Proteggi le tue note",
      setup_desc:
        "Stai attivando la crittografia end-to-end per la sincronizzazione cloud. Scegli una password di crittografia: è la chiave che mantiene private le tue note.",
      migrate_title: "Attiva la crittografia",
      migrate_desc:
        "Stiamo aggiornando la sincronizzazione cloud alla crittografia end-to-end. Scegli una password di crittografia: le note già nel tuo cloud verranno ricifrate con essa, e la inserirai una volta su ogni dispositivo.",
      point_private:
        "Solo tu puoi leggere le tue note — non noi, non Google. Vengono cifrate sul tuo dispositivo prima di essere caricate.",
      point_password: "Le tue note sono protette da una password di crittografia che scegli tu e che conosci solo tu.",
      point_devices: "Inserirai questa password una volta su ogni dispositivo che sincronizzi.",
      point_norecover:
        "Non possiamo reimpostarla per te. Se la dimentichi, ti servirà la chiave di recupero che ti mostriamo subito dopo — quindi conservala al sicuro.",
      unlock_title: "Sblocca le tue note",
      unlock_desc: "Inserisci la tua password di crittografia per leggere e sincronizzare le note su questo dispositivo.",
      unlock_action: "Sblocca",
      recover_title: "Recupera l'accesso",
      recover_desc: "Hai perso la password? Inserisci la chiave di recupero e scegli una nuova password di crittografia.",
      recovery_title: "Chiave di recupero",
      recovery_desc:
        "Annotala e conservala in un posto sicuro. È l'unico modo per rientrare nelle tue note se dimentichi la password — e non te la mostreremo di nuovo.",
      recovery_saved: "L'ho salvata",
      change_title: "Cambia password",
      change_desc:
        "Inserisci la password attuale e scegline una nuova. Le tue note restano cifrate e non vengono toccate, e i dispositivi già sbloccati continuano a funzionare — cambia solo la password. D'ora in poi ogni nuovo dispositivo userà la nuova password per sbloccare.",
      change_action: "Cambia password",
      change_success: "Password di crittografia cambiata",
      changePassphrase: "Cambia password",
      reset_title: "Reimposta la crittografia",
      reset_desc:
        "Usalo solo se hai perso sia la password sia la chiave di recupero. Elimina le note cifrate nel cloud e ricomincia da capo. Le note su questo dispositivo vengono mantenute e ricaricate con una nuova password.",
      reset_action: "Reimposta crittografia",
      resetVault: "Reimposta crittografia",
      passphrase_placeholder: "Password di crittografia",
      passphrase_confirm_placeholder: "Conferma password",
      current_passphrase_placeholder: "Password attuale",
      new_passphrase_placeholder: "Nuova password",
      recovery_key_placeholder: "Chiave di recupero",
      passphrase_too_short: "Usa almeno 8 caratteri",
      passphrase_mismatch: "Le password non coincidono",
      wrong_passphrase: "Password errata, riprova",
      wrong_recovery_key: "Chiave di recupero non valida",
      forgot_passphrase: "Hai dimenticato la password?",
      continue: "Continua",
      creating: "Attivazione della crittografia…",
      migrating: "Cifratura delle note…",
      unlocking: "Sblocco…",
      saving: "Salvataggio…",
      finishing: "Completamento…",
      uploading: "Cifratura e caricamento delle note…",
      resetting: "Reimpostazione…",
      error_generic: "Qualcosa è andato storto. Riprova.",
      verify_failed: "Impossibile verificare lo stato della crittografia. Controlla la connessione e riprova.",
      locked_prompt: "Le tue note sono bloccate — sbloccale nelle impostazioni Cloud per sincronizzare.",
      setup_prompt: "Configura la crittografia end-to-end nelle impostazioni Cloud per proteggere e sincronizzare le tue note.",
      setup_action: "Attiva la crittografia",
      setup_cta_hint:
        "Le tue note non sono ancora cifrate. Attiva la crittografia end-to-end per proteggerle — basta un momento.",
      locked_cta_title: "Sincronizzazione in pausa",
      locked_cta_hint:
        "Le tue note sono cifrate e bloccate su questo dispositivo, quindi la sincronizzazione cloud è sospesa. Inserisci la tua password di crittografia per sbloccarle e riprendere la sincronizzazione.",
      enable_hint: "La sincronizzazione cloud è cifrata end-to-end — solo tu puoi leggere le tue note, non noi e non Google.",
      prompt_title: "Sincronizzazione in pausa",
      prompt_desc:
        "Le tue note non si stanno sincronizzando. Completa la crittografia nelle impostazioni Cloud per riattivare il sync.",
      prompt_close: "Chiudi",
      prompt_go: "Vai a Cloud sync",
      backup_hint:
        "Consiglio: esporta un backup cifrato delle tue note prima di continuare. È facoltativo, ma è una rete di sicurezza nel caso qualcosa vada storto.",
      backup_action: "Backup rapido",
    },
  },
  synceddevices: {
    title: "Dispositivi Connessi",
    lastSync: "Ultima sincr.: ",
    error_fetching: "Errore durante il recupero dei dispositivi",
    upToDate: "Aggiornato",
    pending: "{{count}} in attesa",
    mostRecent: "Più recente",
  },
  createcategory: {
    title_create: "Crea Categoria",
    title_update: "Aggiorna Categoria",
    name_title: "Nome",
    name_placeholder: "Inserisci qui il nome della categoria...",
    icon_title: "Icona",
    suggested_title: "Suggeriti",
    notes_num: "Note: ",
  },
  organizecategory: {
    title: "Organizza",
    empty: "Nessuna categoria.\nTocca il pulsante + per crearne una.",
  },
  trashednotes: {
    title: "Note Cestinate",
    countdown: "Cancella in: {{days}} giorno/i, {{hours}} ora/e e {{minutes}} minuto/i",
    settings: {
      delete_all: "Cancella tutte",
      restore_all: "Ripristina tutte",
      delete_selected: "Cancella selezionate",
      restore_selected: "Ripristina selezionate",
    },
  },
  webhooks: {
    title: "Webhooks",
    addTextNote: "Aggiungi nota di testo",
    addTodoNote: "Aggiungi nota To-Do",
    addKanbanNote: "Aggiungi nota Kanban",
    addCodeNote: "Aggiungi nota Codice",
    updateNote: "Aggiorna nota",
    temporaryDeleteNote: "Elimina nota (temporanea)",
    deleteNote: "Elimina nota (definitiva)",
    restoreNote: "Ripristina nota",
    createCategory: "Crea categoria",
    deleteCategory: "Elimina categoria",
    updateCategory: "Aggiorna categoria",
    exportData: "Esporta dati",
    exporData: "Esporta dati",
    importData: "Importa dati",
    wipeData: "Cancella dati",
  },
  generalsettings: {
    title: "Impostazioni",
    basic: "Base",
    cloudsync: "Sincronizzazione Cloud",
    temporary_trash_lifespan: "Durata cestino temporaneo",
    days: "giorni",
    change_secret_code: "Cambia il codice segreto",
    enable_fingerprint: "Abilita impronta digitale",
    fingerprint_reason: "Sblocca le tue note",
    advanced: "Avanzate",
    show_hidden: "Mostra note nascoste",
    export_import_data: "Esporta/Importa dati",
    export_import_popup_title: "Frase segreta",
    export_import_placeholder_input: "Inserisci codice segreto...",
    export_popup_description:
      "Scrivi qui la tua frase segreta. Ricordati di salvarlo altrimenti non sarai in grado di recuperare le tue note.",
    import_popup_description: "Scrivi qui la tua frase segreta per importare le tue note.",
    webhooks: "Webhooks",
    voice_recognition: "Riconoscimento vocale",
    ai_assistant: "Assistente AI",
    note_creation: "Creazione nota",
    wipe_data: "Cancella dati",
    developer_options: "Opzioni sviluppatore",
    about: "Info",
    about_the_app: "Informazioni sull'app",
    about_the_developer: "Informazioni sullo sviluppatore",
    check_updates: "Controlla aggiornamenti",
    checking_updates: "Controllo...",
    update_available: "Aggiornamento disponibile",
    update_confirm: "Vuoi installarlo adesso?",
    no_updates: "Stai utilizzando l'ultima versione.",
    feedback_and_help: "Feedback e Assistenza",
    help: "Aiuto",
    changelog: "Registro delle modifiche",
    report: "Segnala un problema",
    suggest: "Consiglia a un amico",
  },
  info: {
    title: "Informazioni",
    fastmemo: "Fast Memo",
    app: "App",
    version: "Versione",
    libraries: "Librerie",
  },
  note_creation: {
    title: "Creazione nota",
    mode_section: "Modalità",
    default_type_section: "Tipo di nota predefinito",
    quick_note_section: "Nota rapida",
    quick_note_label: "Barra nota rapida",
    quick_note_description:
      "Mostra in fondo alla home una barra per scrivere e salvare al volo una nota di testo, senza aprire l'editor completo. Tocca, scrivi e invia.",
    mode: {
      simple: "Semplice",
      simple_description: "Il tap crea una nota di testo. Usa il menù per gli altri tipi.",
      smart: "Smart",
      smart_description: "Il tap crea sempre il tipo che scegli qui sotto.",
      adaptive: "Adattiva",
      adaptive_description: "Il tap crea lo stesso tipo dell'ultima nota.",
    },
  },
  aboutdeveloper: {
    title: "Su di me",
    freelance: "Sviluppatore Web Freelance",
    information: "Informazioni",
    developer: "Sviluppatore",
    website: "Sito web",
    openLink: "Apri link",
  },
  ai: {
    title: "Assistente AI",
    model: "Modello",
    status: "Stato",
    settings: "Impostazioni",
    enabled: "Abilitato",
    downloaded: "Scaricato",
    not_downloaded: "Non scaricato",
    downloading: "Download in corso...",
    download_model: "Scarica modello",
    cancel: "Annulla",
    delete_model: "Elimina modello",
    info: "L'assistente AI funziona interamente sul tuo dispositivo. Nessun dato viene inviato a server esterni. Il modello deve essere scaricato una volta (~400 MB) e verra' salvato localmente.",
    model_light: "Veloce, qualita' base. 3GB+ RAM richiesti.",
    model_powerful: "Buon equilibrio tra velocita' e qualita'. 4GB+ RAM richiesti.",
    model_advanced: "Alta qualita'. 6GB+ RAM richiesti.",
    model_pro: "Qualita' massima, vicino a un desktop. 8GB+ RAM richiesti.",
    model_unavailable: "RAM insufficiente su questo dispositivo",
    capabilities_title: "Cosa posso fare?",
    cap: {
      generate_title: "Genera un titolo dal contenuto della nota",
      summarize: "Riassumi una nota di testo in poche frasi",
      fix_grammar: "Correggi ortografia e grammatica",
      shorten: "Rendi un testo più breve e conciso",
      translate: "Traduci una nota nella lingua dell'app",
      suggest_items: "Suggerisci nuovi elementi per una checklist",
      suggest_category: "Suggerisci la categoria migliore per una nota",
      voice_cleanup: "Sistema il testo dettato con la punteggiatura",
      explain_code: "Spiega cosa fa il codice",
      add_comments: "Aggiungi commenti inline al codice",
    },
    unavailable_web: "L'Assistente AI e' disponibile solo su dispositivi mobili.",
    native_rebuild_needed: "L'Assistente AI richiede una rebuild nativa.\nEsegui: npx expo run:android",
    voice_only: "Solo voce",
    voice_only_hint: "Interagisci con l'assistente usando solo la voce",
    listening: "Sto ascoltando...",
    tap_to_speak: "Tocca il microfono per parlare",
    sending_soon: "Invio in corso...",
    placeholder: "Cosa vorresti fare?",
    processing: "Sto pensando...",
    feedback: {
      note_created: 'Nota "{{title}}" creata',
      property_toggled: "{{count}} nota/e aggiornata/e",
      note_deleted: "{{count}} nota/e spostata/e nel cestino",
      category_changed: "{{count}} nota/e spostata/e",
      done: "Fatto",
      note_renamed: 'Nota rinominata in "{{title}}"',
      items_added: "{{count}} elemento/i aggiunto/i",
      category_created: 'Categoria "{{name}}" creata',
      note_restored: "{{count}} nota/e ripristinata/e",
      category_switched: 'Passato a "{{name}}"',
      no_notes_found: "Nessuna nota trovata",
      category_not_found: "Categoria non trovata",
      not_todo_note: "Quella nota non e' una lista",
      category_exists: "La categoria esiste gia'",
      note_converted: 'Nota "{{title}}" convertita',
      notes_merged: 'Note unite in "{{title}}"',
      setting_changed: "Impostazione aggiornata",
      help_message:
        'Posso creare note, liste e board, eliminare, rinominare, convertire e unire note, e altro.\nProva: "Fammi una lista della spesa con latte e pane"\nVedi tutto in Impostazioni > Assistente AI.',
      same_type: "La nota e' gia' di quel tipo",
      not_understood: "Posso solo aiutarti con le note",
      error: "Qualcosa e' andato storto, riprova",
      voice_unavailable: "Voce non disponibile",
    },
    editor: {
      generate_title: "Genera titolo",
      summarize: "Riassumi",
      suggest_items: "Suggerisci elementi",
      suggest_category: "Suggerisci categoria",
      explain_code: "Spiega il codice",
      add_comments: "Aggiungi commenti",
      fix_grammar: "Correggi grammatica",
      shorten: "Accorcia",
      translate: "Traduci",
      min_model: "Minimo",
      before: "Prima",
      after: "Dopo",
      apply: "Applica",
      no_content: "Scrivi qualcosa prima",
      no_category_match: "Nessuna categoria corrispondente",
      error: "Impossibile generare, riprova",
    },
  },
  voicerecognition: {
    title: "Riconoscimento vocale",
    enabled: "Abilitato",
    interimResults: "Trascrizione in tempo reale",
    continuous: "Interruzione manuale",
    language: "Lingua",
    language_default: "Predefinita (sistema)",
    dictation: {
      listening: "In ascolto…",
      paused: "In pausa",
      hint: 'Parla pure. Di\' "virgola", "punto", "punto interrogativo" o "a capo" per la punteggiatura.',
      insert: "Inserisci",
      cancel: "Annulla",
      ai_cleanup: "Sistema con AI",
      processing: "Sto sistemando…",
    },
  },
  help: {
    title: "Aiuto",
    search_placeholder: "Come possiamo aiutarti?",
    no_results: "Nessun risultato. Prova con un'altra parola.",
    search_placeholders: [
      "Cerca o descrivi cosa ti serve…",
      "Come creo una nota?",
      "A cosa serve la barra strumenti?",
      "Come funziona la sincronizzazione cloud?",
      "Come recupero una nota eliminata?",
    ],
    ai_thinking: "Ricerca con l'AI…",
    ai_results: "Risultati AI · tocca per azzerare",
    ai_invite_title: "Non trovi quello che cerchi?",
    ai_invite_subtitle: "Descrivilo a parole tue e lascia che l'assistente AI trovi l'argomento giusto.",
    cat_notes: "Note",
    cat_editor: "Editor e formattazione",
    cat_categories: "Categorie",
    cat_trash: "Cestino",
    cat_cloud: "Sincronizzazione e crittografia",
    cat_data: "Sicurezza e dati",
    cat_settings: "Impostazioni",
    cat_more: "Altro e info",
    cat_ai: "Assistente AI",
    how_to_create_note: {
      title: "Come creo una nota?",
      text_1_0: "Tocca il pulsante",
      text_1_1: "in basso a destra nella schermata principale.",
      text_2_0: "Si apre una nuova pagina dove puoi aggiungere un titolo e scrivere la tua nota.",
      text_3_0: "Per salvarla basta tornare alla schermata principale.",
    },
    how_to_create_todo_note: {
      title: "Come creo una lista di cose da fare?",
      text_1_0: "Tocca il pulsante",
      text_1_1: "in basso a destra nella schermata principale.",
      text_2_0: "Si apre una nuova pagina dove puoi aggiungere un titolo e i tuoi elementi da fare.",
      text_3_0: "Trascina i sei puntini a destra di un elemento per spostarlo su o giù.",
      text_4_0: "Tocca la crocetta a destra per eliminare un elemento.",
      text_5_0: "I pulsanti in basso ti permettono di:",
      text_6_0: "• Aggiungi — aggiunge un nuovo elemento alla lista.",
      text_7_0:
        "• Cambia modalità — passa tra Lista (una classica checklist) e Step (un elenco numerato e sequenziale da completare in ordine).",
      text_8_0: "• Elimina tutto — rimuove tutti gli elementi della lista.",
      text_9_0: "Per salvarla basta tornare alla schermata principale.",
    },
    how_to_create_kanban_note: {
      title: "Come creo una bacheca Kanban?",
      text_1_0: "Tocca il pulsante",
      text_1_1: "in basso a destra nella schermata principale e scegli 'Kanban'.",
      text_2_0: "Si apre una bacheca con una colonna già pronta.",
      text_3_0: "• Aggiungere una colonna — tocca 'Aggiungi colonna' a destra (fino a 10).",
      text_4_0: "• Rinominare una colonna — modifica il testo nella sua intestazione.",
      text_5_0: "• Cambiare colore a una colonna — tocca il quadratino colorato nell'intestazione.",
      text_6_0: "• Aggiungere una card — tocca 'Aggiungi card' in fondo alla colonna.",
      text_7_0: "• Spostare una card — tienila premuta e trascinala in un'altra colonna.",
      text_8_0: "• Eliminare una card — tocca l'icona del cestino sulla card.",
      text_9_0: "• Eliminare una colonna — tocca l'icona del cestino nella sua intestazione.",
      text_10_0: "Per salvare la bacheca basta tornare alla schermata principale.",
    },
    how_to_create_code_note: {
      title: "Come creo una nota di codice?",
      text_1_0: "Tocca il pulsante",
      text_1_1: "in basso a destra nella schermata principale e scegli 'Codice'.",
      text_2_0: "Ottieni un vero editor di codice con evidenziazione della sintassi.",
      text_3_0:
        "• Schede — tieni più snippet in una sola nota; aggiungile, rinominale, eliminale o trascinale per riordinarle (fino a 6).",
      text_4_0:
        "• Linguaggio — tocca la barra del linguaggio per sceglierlo, oppure lascia che venga rilevato automaticamente.",
      text_5_0: "• Trova e sostituisci — tocca l'icona di ricerca in alto, come nelle note di testo.",
      text_6_0: "Per salvarla basta tornare alla schermata principale.",
    },
    how_to_edit_note: {
      title: "Come modifico una nota?",
      text_1_0: "Tocca semplicemente la nota nella schermata principale per aprirla e modificarla.",
    },
    how_to_delete_note: {
      title: "Come elimino una nota?",
      text_1_0: "Mentre visualizzi una nota, tocca",
      text_1_1: "in alto a destra.",
      text_2_0: "Si apre un menu: 'Elimina' è la prima voce.",
    },
    how_to_select_notes: {
      title: "Come seleziono più note insieme?",
      text_1_0: "Tieni premuta una nota per iniziare a selezionare.",
      text_2_0:
        "Si attiva la modalità selezione, dove puoi agire su più note insieme: eliminarle, oppure contrassegnarle come importanti, di sola lettura o bloccate.",
    },
    what_are_hidden_notes: {
      title: "Come funzionano le note nascoste?",
      text_1_0: "Apri il menu opzioni di una nota e tocca 'Nascondi' per toglierla dalla vista nella schermata principale.",
      text_2_0:
        "Per rivedere le note nascoste, attiva 'Mostra note nascoste' nelle impostazioni avanzate: ti verrà chiesto il codice segreto.",
    },
    what_toolbar_below: {
      title: "A cosa serve la barra in basso?",
      text_1_0: "Serve a formattare e arricchire il testo. Ecco cosa fanno i pulsanti:",
      text_2_0: "• Annulla / Ripeti — torna indietro o avanti tra le ultime modifiche.",
      text_3_0: "• Immagine — inserisci una foto dalla galleria.",
      text_4_0: "• Grassetto — rende il testo in grassetto.",
      text_5_0: "• Corsivo — rende il testo in corsivo.",
      text_6_0: "• Barrato — barra il testo selezionato.",
      text_7_0: "• Sottolineato — sottolinea il testo.",
      text_8_0: "• Pedice — abbassa leggermente il testo sotto la riga.",
      text_9_0: "• Apice — alza leggermente il testo sopra la riga.",
      text_10_0: "• Elenco puntato — crea un elenco puntato.",
      text_11_0: "• Elenco numerato — crea un elenco numerato.",
      text_12_0: "• Codice — racchiude il testo in un blocco di codice formattato.",
    },
    what_find_replace: {
      title: "Come trovo e sostituisco il testo?",
      text_1_0: "Mentre modifichi una nota di testo o di codice, tocca l'icona di ricerca in alto a destra.",
      text_2_0: "Scrivi cosa cerchi: le frecce ti spostano tra i risultati e ti mostrano quanti sono.",
      text_3_0: "Attiva 'Sostituisci' per cambiare il risultato corrente, oppure sostituiscili tutti in una volta.",
    },
    what_are_settings_note: {
      title: "Quali sono le opzioni di una nota?",
      text_1_0: "Apri una nota e tocca il menu ⋮ in alto a destra. Da lì puoi:",
      text_2_0: "• Elimina — sposta la nota nel cestino.",
      text_3_0: "• Importante — contrassegna la nota così risalta in alto.",
      text_4_0: "• Proteggi — blocca la nota dietro il tuo codice segreto o l'impronta.",
      text_5_0: "• Sola lettura — evita modifiche accidentali alla nota.",
      text_6_0: "• Nascondi — tiene la nota fuori dalla schermata principale finché non mostri le note nascoste.",
      text_7_0: "• Rendi offline — tiene la nota solo su questo dispositivo, senza sincronizzarla sul cloud.",
      text_8_0: "• Cambia categoria — sposta la nota in un'altra categoria.",
      text_9_0: "• Esporta (note di testo) — salva la nota come file .txt, Markdown o PDF.",
      text_10_0: "• Informazioni — vedi tipo, categoria e date della nota.",
    },
    how_create_category: {
      title: "Come creo una categoria?",
      text_1_0: "Nella schermata principale, tocca",
      text_1_1: "in alto a sinistra.",
      text_2_0: "Si apre la pagina 'Organizza'. Lì tocca",
      text_2_1: "in basso a destra.",
      text_3_0: "Nella pagina 'Crea categoria' dai un nome e scegli un'icona non ancora in uso.",
      text_4_0: "Quando hai finito, tocca",
      text_4_1: "in basso a destra per salvarla.",
    },
    how_edit_category: {
      title: "Come modifico una categoria?",
      text_1_0: "Nella schermata principale, tocca",
      text_1_1: "in alto a sinistra.",
      text_2_0:
        "Nella pagina 'Organizza' tocca la categoria che vuoi modificare: si apre la sua pagina di modifica, dove puoi rinominarla o scegliere una nuova icona.",
    },
    how_organize_categories: {
      title: "Come riordino le categorie?",
      text_1_0: "Nella schermata principale, tocca",
      text_1_1: "in alto a sinistra.",
      text_2_0: "Nella pagina 'Organizza' tocca",
      text_2_1: "per entrare in modalità ordinamento.",
      text_3_0: "Tocca una categoria per prenderla, poi toccane un'altra per posizionarla lì e cambiare l'ordine.",
      text_4_0: "Quando l'ordine ti soddisfa, tocca",
      text_4_1: "per salvarlo.",
      text_5_0: "Per annullare le modifiche, tocca",
      text_5_1: "in alto a destra.",
    },
    how_delete_category: {
      title: "Come elimino una categoria?",
      text_1_0: "Nella schermata principale, tieni premuta una categoria per entrare in modalità selezione.",
      text_2_0: "Poi tocca",
      text_2_1: "e scegli se eliminare la categoria insieme alle sue note, oppure conservare le note spostandole in 'Tutte'.",
    },
    what_are_trashed_notes: {
      title: "Cos'è il cestino?",
      text_1_0: "Quando elimini una nota non sparisce subito: prima finisce nel cestino.",
      text_2_0:
        "Le note vi restano 7 giorni, poi vengono eliminate definitivamente. Puoi cambiare la durata nelle impostazioni di base.",
    },
    how_restore_trashed_notes: {
      title: "Come ripristino le note eliminate?",
      text_1_0: "Apri la pagina 'Cestino' e tocca una nota: ti verrà chiesto se vuoi ripristinarla.",
      text_2_0: "Per ripristinarne più di una, tieni premuta una nota, seleziona quelle che vuoi e tocca",
      text_2_1: "in alto a destra.",
      text_3_0: "Nel menu che appare, scegli 'Ripristina'.",
      text_4_0: "Per riportarle tutte indietro in una volta, tocca",
      text_4_1: "in alto a destra.",
      text_5_0: "Nel menu che appare, scegli 'Ripristina tutte'.",
    },
    how_restore_delete_notes: {
      title: "Come elimino definitivamente le note dal cestino?",
      text_1_0:
        "Apri la pagina 'Cestino', tieni premuta una nota per entrare in modalità selezione e scegli quelle da rimuovere.",
      text_2_0: "Tocca",
      text_2_1: "in alto a destra.",
      text_3_0: "Nel menu che appare, scegli 'Elimina'.",
      text_4_0: "Per svuotare tutto il cestino in una volta, tocca",
      text_4_1: "in alto a destra.",
      text_5_0: "Nel menu che appare, scegli 'Elimina tutte'.",
    },
    what_cloud_sync: {
      title: "Cos'è la sincronizzazione Cloud?",
      text_1_0:
        "Puoi sincronizzare le tue note tra i dispositivi collegando il tuo progetto Google Firebase e attivando la sincronizzazione. Non esiste un server centrale di Fast Memo: i tuoi dati vivono solo nel tuo Firebase.",
      text_2_0:
        "Le tue note vengono cifrate end-to-end sul dispositivo prima di essere caricate, così nessuno tranne te può leggerle.",
      text_link: "Leggi la guida passo passo per configurare Google Firebase →",
    },
    what_encryption: {
      title: "Come vengono cifrate le mie note?",
      text_1_0:
        "Il Cloud Sync usa la crittografia end-to-end. Alla prima configurazione scegli una password di crittografia, e il dispositivo ne deriva la chiave che protegge le tue note.",
      text_2_0:
        "La chiave non lascia mai il dispositivo e non viene salvata nel cloud: anche chi avesse accesso al tuo Firebase non può leggere il contenuto delle note senza la tua password.",
      text_3_0:
        "Viene cifrato il contenuto delle note; titoli e date restano leggibili per permettere all'app di ordinarle e sincronizzarle.",
    },
    how_unlock_device: {
      title: "Perché devo sbloccare su ogni dispositivo?",
      text_1_0:
        "Ogni dispositivo sblocca la crittografia una volta inserendo la password. Dopodiché la chiave viene salvata in modo sicuro sul dispositivo (Keychain / Keystore), così non la reinserisci a ogni avvio.",
      text_2_0:
        "Se un dispositivo resta bloccato, la sincronizzazione su di esso è in pausa finché non sblocchi: questo evita che le note vengano salvate in modo illeggibile.",
    },
    forgot_password: {
      title: "Ho dimenticato la password di crittografia",
      text_1_0:
        "Quando configuri la crittografia ti viene mostrata una chiave di recupero, una sola volta. Conservala in un luogo sicuro.",
      text_2_0:
        "Nella schermata di sblocco scegli 'Password dimenticata', inserisci la chiave di recupero e imposta una nuova password. Nessuna nota viene persa.",
      text_3_0:
        "Se perdi sia la password sia la chiave di recupero, le note nel cloud non possono essere decifrate da nessuno: è il senso della crittografia end-to-end.",
    },
    reset_encryption: {
      title: "Cosa fa la reimpostazione della crittografia?",
      text_1_0: "La reimpostazione è l'ultima risorsa, per quando hai perso sia la password sia la chiave di recupero.",
      text_2_0:
        "Crea una nuova configurazione di crittografia dalle note presenti su questo dispositivo e sostituisce la copia nel cloud. Le vecchie note nel cloud non più decifrabili vengono rimosse.",
      text_3_0:
        "Le tue note locali vengono mantenute e ri-caricate, quindi questo dispositivo non perde nulla: ma gli altri dispositivi dovranno sbloccare di nuovo con la nuova password.",
    },
    quick_backup: {
      title: "Cos'è il Backup rapido?",
      text_1_0:
        "Nelle schermate di configurazione, sblocco e reimpostazione della crittografia trovi un pulsante opzionale 'Backup rapido'.",
      text_2_0:
        "Esporta un file delle tue note protetto da passphrase direttamente da questo dispositivo, indipendente dal cloud: una rete di sicurezza prima di una sincronizzazione importante o di una reimpostazione. Le note restano comunque sempre su questo dispositivo.",
    },
    what_secret_code: {
      title: "Cos'è il codice segreto?",
      text_1_0: "È il codice che hai impostato al primo avvio dell'app e ti serve per aprire le note che hai bloccato.",
      text_2_0: "Puoi cambiarlo quando vuoi dalle impostazioni di base.",
    },
    what_import_export: {
      title: "Cosa sono importa ed esporta?",
      text_1_0: "Ti permettono di salvare una copia dei tuoi dati, o di reimportarla, direttamente sul dispositivo.",
      text_2_0: "Quando esporti, viene creato un file nella cartella che scegli.",
      text_3_0: "Il file è sempre cifrato: per reimportarlo ti servirà la passphrase che hai impostato.",
    },
    how_export_note: {
      title: "Come esporto una singola nota?",
      text_1_0: "Apri una nota di testo, tocca il menu opzioni e scegli 'Esporta'.",
      text_2_0: "Poi scegli il formato che preferisci:",
      text_3_0: "• Testo semplice (.txt) — solo il testo, senza formattazione.",
      text_4_0: "• Markdown (.md) — mantiene titoli e formattazione di base.",
      text_5_0: "• PDF — un documento ordinato, pronto da condividere.",
      text_6_0: "Il file viene condiviso tramite il dispositivo, così puoi salvarlo o inviarlo dove vuoi.",
    },
    what_wipe_data: {
      title: "Cosa fa la cancellazione dei dati?",
      text_1_0: "Rimuove tutte le note e le categorie da questo dispositivo in un colpo solo.",
      text_2_0: "Ti verrà chiesta una conferma, perché l'operazione non è reversibile.",
      text_3_0: "Una volta confermata, tutto viene eliminato definitivamente.",
    },
    what_note_creation: {
      title: "A cosa serve l'impostazione di creazione nota?",
      text_1_0:
        "Decide cosa succede quando tocchi il pulsante [+] nella schermata principale. In Impostazioni → Creazione nota puoi scegliere:",
      text_2_0: "• Semplice — [+] crea una nota di testo; usa il menu per gli altri tipi.",
      text_3_0: "• Smart — [+] crea sempre il tipo che hai scelto come preferito.",
      text_4_0: "• Adattiva — [+] crea lo stesso tipo dell'ultima nota su cui hai lavorato.",
    },
    what_home_filters: {
      title: "Come funzionano i filtri della Home?",
      text_1_0: "Tocca l'icona dei filtri in alto nella schermata principale per cambiare come vengono mostrate le note.",
      text_2_0: "• Ordina per — ordina per data di creazione o di ultima modifica, in ordine crescente o decrescente.",
      text_3_0:
        "• Ricerca approfondita — cerca anche nel contenuto delle note e nelle liste, non solo nei titoli (prima ti chiede il codice segreto).",
    },
    what_language: {
      title: "Come cambio la lingua?",
      text_1_0: "Apri le impostazioni di base e tocca 'Lingua' per cambiarla.",
      text_2_0:
        "Puoi seguire automaticamente la lingua del dispositivo, oppure scegliere una delle sette disponibili: inglese, italiano, spagnolo, francese, tedesco, cinese e giapponese.",
    },
    what_version_check: {
      title: "L'app controlla gli aggiornamenti?",
      text_1_0: "Sì: quando apri Fast Memo controlla in background se è disponibile una nuova versione.",
      text_2_0:
        "Quando c'è un aggiornamento, una schermata 'Cosa c'è di nuovo?' ti mostra le novità. Puoi comunque controllare quando vuoi dalle impostazioni.",
    },
    what_report_problem: {
      title: "Come segnalo un problema?",
      text_1_0: "Vai in Impostazioni → Segnala un problema.",
      text_2_0:
        "Scegli un argomento, descrivi cosa è successo e, se vuoi, allega qualche screenshot e le info del dispositivo per aiutarci a capire.",
      text_3_0: "Puoi inviare una segnalazione al giorno.",
    },
    what_webhooks: {
      title: "Cosa sono i webhook?",
      text_1_0:
        "I webhook sono per utenti esperti: permettono a Fast Memo di avvisare un altro servizio ogni volta che succede qualcosa — una nota creata, modificata o eliminata, una categoria cambiata, dati esportati e così via.",
      text_2_0: "Ogni azione può richiamare un indirizzo web a tua scelta. Li configuri in Impostazioni → Webhook.",
    },
    what_platforms: {
      title: "Dove posso usare Fast Memo?",
      text_1_0: "Fast Memo funziona sia su mobile sia su desktop (Windows, macOS e Linux), oltre che in versione web.",
      text_2_0: "Collega lo stesso progetto Google Firebase su ogni dispositivo e le tue note restano sincronizzate ovunque.",
    },
    what_ai_assistant: {
      title: "Cos'è l'Assistente AI?",
      text_1_0:
        "Fast Memo include un Assistente AI self-hosted che funziona interamente sul tuo dispositivo. Nessun dato viene inviato a server esterni.",
      text_2_0: "Per configurarlo, vai in Impostazioni -> Assistente AI, scegli un modello e scaricalo.",
      text_3_0:
        "Una volta attivato, un bottone a forma di stella appare dentro ogni editor. Toccalo per accedere ad azioni smart come: genera titolo, riassumi, continua a scrivere, formatta testo, suggerisci elementi checklist o suggerisci categoria.",
      text_4_0: "L'AI funziona offline e supporta piu' lingue.",
    },
  },
  report: {
    title: "Segnala un problema",
    question: "Qual è l'argomento del problema?",
    topic: {
      crash: "Crash",
      notes: "Note",
      categories: "Categorie",
      cloud: "Cloud",
      webhooks: "Webhooks",
      export_import: "Esporta/Importa",
      translations: "Traduzioni",
      suggestions: "Suggerimenti",
      other: "Altro",
    },
    descriptionPlaceholder: "Descrivi in maniera dettagliata il problema (obbligatorio)",
    deviceInfoCheckbox: "Per una diagnosi più precisa, ti chiediamo cortesemente di fornirci i dettagli del dispositivo.",
    attachments: "Aggiungi Immagini",
    sendReport: "Invia segnalazione",
    sent_message_1: "Grazie per aver inviato la segnalazione.",
    sent_message_2: "Sarà possibile inviare un'altra segnalazione dal giorno:",

    attachments_limit: "Limite allegati:",
    size_limit: "Limite grandezza per immagine:",
    loading: "Caricamento in corso...",

    messages: {
      size: {
        title: "File troppo grande!",
        text: "Scegliere un file più piccolo, o comprimerlo.",
      },
      success: {
        title: "Successo!",
        text: "La segnalazione è stata inviata con successo.",
      },
      error: {
        title: "Errore!",
        text: "La segnalazione non è stata inviata.",
      },
      missing: {
        title: "Dati mancanti!",
        text: "Compilare gli argomenti e la descrizione del problema.",
      },
    },
  },

  /* popup */
  popup: {
    delete_category: "Vuoi eliminare questa categoria?\nPuoi SPOSTARE le note nella categoria 'TUTTE'.",
    restore_single_note: "Vuoi ripristinare questa nota?",
    restore_notes: "Vuoi ripristinare queste note?",
    delete_notes: "Vuoi eliminare queste note?",
    delete_notes_perma: "Vuoi eliminare queste note in modo permanente?",
    restore_all_notes: "Vuoi ripristinare TUTTE le note?",
    delete_all_notes_perma: "Vuoi eliminare definitivamente TUTTE le note?",
    select_one_option: "Seleziona un'opzione",
    passphrase_wrong: "La frase segreta inserita è errata.",
    are_you_sure_wipe: "Sei sicuro di voler cancellare i tuoi dati?\nPerderai tutte le note e le categorie create.",
    finish_organize_categories: "Finisci di organizzare le categorie o annulla le modifiche.",
    generic_success_description: "L'operazione è andata a buon fine.",
  },

  /* generic */
  All: "Tutte",
  delete_and_move: "Elimina e Sposta",
  delete_with_notes: "Elimina con le note",
  ok: "Ok",
  confirm: "Conferma",
  cancel: "Annulla",
  delete: "Cancella",
  restore: "Ripristina",
  warning: "Attenzione",
  error: "Errore",
  import: "Importa",
  export: "Esporta",
  retry: "Riprova",
  wipe: "Cancella tutto",
  wipeWithCloud: "Cancella + Cloud",
  loading: "Caricamento in corso...",

  developeroptions: {
    title: "Opzioni Sviluppatore",
    warning: "Queste opzioni potrebbero compromettere il Cloud Sync di note specifiche o influire sulle performance dell'app.",
    unlimited_text_space: "Spazio illimitato per testo",
    unlimited_text_space_desc: "Limite attuale: 1 MB",
    unlimited_kanban_columns: "Colonne Kanban illimitate",
    unlimited_kanban_columns_desc: "Limite attuale: 10 colonne",
    unlimited_trash_time: "Tempo cestino illimitato",
    unlimited_trash_time_desc: "Limite attuale: 30 giorni",
    change_app_icon: "Cambia icona app",
    change_app_icon_desc: "Prossimamente",
  },

  /* toast */
  disconnected: "Sei stato disconnesso dal Cloud",
  dataSynced: "Dati sincronizzati",
  noInternetConnection: "Nessuna connessione a internet",
  devicesLimitReached: "Limite dispositivi superato",
  noteLimitReached: "Limite nota raggiunto",
  developerModeActivated: "Modalita' sviluppatore attivata!",
  developerModeAlready: "La modalita' sviluppatore e' gia' attiva",
  developerModeTaps: "{{remaining}} tap per attivare la modalita' sviluppatore",

  empty_title: "(Senza titolo)",
};

export default it;
