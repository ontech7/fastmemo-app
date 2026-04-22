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
      description_2_9_0: `• Aggiunta nuova tipologia di nota: Codice, con editor integrato, syntax highlighting, tab multiple e rilevamento automatico del linguaggio.
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
    step4: "Crea la tua categoria in base alle tue esigenze.",
    step5: "Inserisci un codice segreto per nascondere le tue note.",
    step6: "Sincronizza le tue note su Google Firebase.",
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
    deepSearch: "Ricerca approfondita (testo, liste…)",

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
      changecategory: "Cambia Categoria",
      share: "Condividi",
      export: "Esporta",
      export_description: "Scegli il formato di esportazione",
      export_txt: "Testo semplice (.txt)",
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
    deleteDevices: "Gestisci dispositivi",
    handshakeFailed: "Tentativo di connessione fallito",
    handshakeFailedDesc: "Non è stato possibile connettersi al server di Firebase.",
  },
  synceddevices: {
    title: "Dispositivi Connessi",
    lastSync: "Ultima sincr.: ",
    error_fetching: "Errore durante il recupero dei dispositivi",
  },
  createcategory: {
    title_create: "Crea Categoria",
    title_update: "Aggiorna Categoria",
    name_title: "Nome",
    name_placeholder: "Inserisci qui il nome della categoria...",
    icon_title: "Icona",
    notes_num: "Note: ",
  },
  organizecategory: {
    title: "Organizza",
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
  aboutdeveloper: {
    title: "Su di me",
    freelance: "Sviluppatore Web Freelance",
    information: "Informazioni",
    developer: "Sviluppatore",
    website: "Sito web",
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
      continue_writing: "Continua a scrivere da dove ti sei fermato",
      format_text: "Formatta il testo con titoli, grassetto, elenchi, ecc.",
      suggest_items: "Suggerisci nuovi elementi per una checklist",
      suggest_category: "Suggerisci la categoria migliore per una nota",
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
      continue_writing: "Continua a scrivere",
      suggest_items: "Suggerisci elementi",
      format_text: "Formatta testo",
      suggest_category: "Suggerisci categoria",
      explain_code: "Spiega il codice",
      add_comments: "Aggiungi commenti",
      min_model: "Minimo",
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
  },
  help: {
    title: "Aiuto",
    how_to_create_note: {
      title: "Come posso creare una nota?",
      text_1_0: "Puoi creare una nota facendo clic sul pulsante",
      text_1_1: "nell'angolo in basso a destra della pagina principale.",
      text_2_0: "Apparirà una nuova pagina in cui puoi scrivere un titolo e una descrizione alla tua nota.",
      text_3_0: "Puoi salvarlo tornando nella Home page.",
    },
    how_to_create_todo_note: {
      title: "Come posso creare una nota To-Do?",
      text_1_0: "Puoi creare una nota To-Do facendo clic su",
      text_1_1: "pulsante nell'angolo in basso a destra della Home page.",
      text_2_0: "Apparirà una nuova pagina in cui puoi scrivere un titolo e un elenco di testi da fare alla tua nota.",
      text_3_0: "Premendo i 6 punti a destra di un elemento, potrai spostarlo su e giù.",
      text_4_0: "Il pulsante con la croce sulla destra eliminerà quell'elemento.",
      text_5_0: "I pulsanti in basso sono: ",
      text_6_0: "• Aggiungi: un nuovo elemento To-Do verrà aggiunto all'elenco.",
      text_7_0: "• Nascondi/Scopri selezionato: nasconderà/scoprirà gli elementi To-Do se sono selezionati.",
      text_8_0: "• Elimina tutto: rimuoverà tutte le cose da fare presenti nella nota.",
      text_9_0: "Puoi salvarlo tornando alla Home page.",
    },
    how_to_create_kanban_note: {
      title: "Come posso creare una nota Kanban?",
      text_1_0: "Puoi creare una nota Kanban facendo clic sul pulsante",
      text_1_1: "nell'angolo in basso a destra della Home page e selezionando 'Kanban'.",
      text_2_0: "Apparirà una nuova pagina con una colonna già creata.",
      text_3_0: "• Per aggiungere una colonna: fai clic sul pulsante 'Aggiungi colonna' sulla destra (massimo 10 colonne).",
      text_4_0: "• Per rinominare una colonna: modifica il testo nell'intestazione della colonna.",
      text_5_0: "• Per cambiare il colore di una colonna: fai clic sul quadratino colorato nell'intestazione.",
      text_6_0: "• Per aggiungere una card: fai clic su 'Aggiungi card' in fondo alla colonna.",
      text_7_0: "• Per spostare una card: tieni premuta la card e trascinala in un'altra colonna.",
      text_8_0: "• Per eliminare una card: fai clic sull'icona del cestino sulla card.",
      text_9_0: "• Per eliminare una colonna: fai clic sull'icona del cestino nell'intestazione della colonna.",
      text_10_0: "Puoi salvare la nota tornando alla Home page.",
    },
    how_to_edit_note: {
      title: "Come posso modificare una nota?",
      text_1_0: "Puoi modificare una nota selezionandola nella Home page",
    },
    how_to_delete_note: {
      title: "Come posso eliminare una nota?",
      text_1_0: "Puoi eliminare una nota facendo clic",
      text_1_1: "nell'angolo in alto a destra, durante la visualizzazione di una nota.",
      text_2_0: "Si aprirà un menu popup. La prima opzione è quella che stai cercando.",
    },
    how_to_select_notes: {
      title: "Come posso selezionare alcune note?",
      text_1_0: "Puoi selezionare le note premendo a lungo una nota.",
      text_2_0:
        "Andrai in 'modalità modifica', ed è possibile eseguire varie azioni come eliminarle, metterle come importanti, di sola lettura o bloccate.",
    },
    what_toolbar_below: {
      title: "Cos'è quella barra degli strumenti qui sotto?",
      text_1_0: "La barra degli strumenti può arricchire il tuo testo in molti modi.",
      text_2_0: "• Immagine: puoi inserire e ritagliare un'immagine dalla tua Galleria.",
      text_3_0: "• Grassetto: puoi mettere in grassetto il tuo testo.",
      text_4_0: "• Corsivo: puoi mettere in corsivo il tuo testo.",
      text_5_0: "• Sottolineato: puoi mettere in sottolineato il tuo testo.",
      text_6_0: "• Sottoinsieme: puoi mettere il tuo testo in una posizione inferiore rispetto al tuo testo.",
      text_7_0: "• Superset: puoi mettere il tuo testo in una posizione superiore rispetto al tuo testo.",
      text_8_0: "• Elenco puntato: puoi creare un elenco puntato.",
      text_9_0: "• Elenco ordinato: puoi creare un elenco ordinato.",
      text_10_0: "• Codice: puoi creare un wrapper dove scrivere codice formattato.",
    },
    what_are_settings_note: {
      title: "Quali sono le impostazioni per una nota?",
      text_1_0: "Le impostazioni per le note sono:",
      text_2_0: "• Elimina: puoi eliminare la nota corrente.",
      text_3_0: "• Importante: puoi impostare la tua nota come importante",
      text_4_0: "• Proteggi: puoi bloccare la tua nota. Avrai bisogno di un codice o della tua impronta digitale se attivata.",
      text_5_0: "• Sola lettura: la tua nota non può essere modificata.",
      text_6_0: "• Cambia categoria: puoi cambiare la categoria di una nota in un'altra.",
      text_7_0: "• Condividi: puoi condividere il testo della tua nota su un'altra applicazione social.",
    },
    how_create_category: {
      title: "Come posso creare una categoria?",
      text_1_0: "Puoi creare una nuova categoria facendo clic",
      text_1_1: "nell'angolo in alto a sinistra nella Home page.",
      text_2_0: "Verrai reindirizzato alla pagina 'Organizza'. Nell'angolo in basso a destra devi fare clic",
      testo_2_1: "",
      text_3_0:
        "Ancora una volta verrai reindirizzato alla pagina 'Crea categoria'. Ti verrà chiesto di creare un nome e selezionare un'icona univoca.",
      text_4_0: "Dopo aver compilato il modulo, il",
      text_4_1: "apparirà nell'angolo in basso a destra. Devi fare clic per salvare la tua nuova categoria.",
    },
    how_edit_category: {
      title: "Come posso modificare una categoria?",
      text_1_0: "Puoi modificare una categoria facendo clic",
      text_1_1: "nell'angolo in alto a sinistra nella Home page.",
      text_2_0:
        "Verrai reindirizzato alla pagina 'Organizza'. Devi selezionare una categoria e verrai reindirizzato ancora una volta alla pagina 'Aggiorna categoria'.",
    },
    how_organize_categories: {
      title: "Come posso organizzare le mie categorie?",
      text_1_0: "Puoi modificare una categoria facendo clic",
      text_1_1: "nell'angolo in alto a sinistra nella Home page.",
      text_2_0: "Verrai reindirizzato alla pagina 'Organizza'. Devi fare clic",
      text_2_1: "per andare in 'modalità organizzazione'",
      text_3_0:
        "Quando fai clic su una categoria, sarà 'non numerato'. Puoi fare clic su un'altra categoria per modificare l'ordine delle categorie.",
      text_4_0: "Quando hai finito, puoi fare clic su",
      text_4_1: "i cambiamenti.",
      text_5_0: "Se vuoi annullare le modifiche, puoi fare clic",
      text_5_1: "",
    },
    how_delete_category: {
      title: "Come posso eliminare una categoria?",
      text_1_0: "Quando sei nella Home page, puoi premere a lungo su una categoria e andare in 'modalità modifica'.",
      text_2_0: "Se fai clic su",
      text_2_1:
        "apparirà un popup che ti chiederà se desideri eliminare la categoria insieme alle tue note o semplicemente trasferirle a TUTTE le note.",
    },
    what_are_trashed_notes: {
      title: "Cosa sono le note cestinate?",
      text_1_0: "Quando elimini una nota, andrà nelle note cestinate. È un cestino dove tutte le note vanno temporaneamente.",
      text_2_0:
        "Per impostazione predefinita, dureranno solo 7 giorni, poi scompariranno. Puoi modificare questa impostazione dalle Impostazioni di base.",
    },
    how_restore_trashed_notes: {
      title: "Come posso ripristinare le note cestinate?",
      text_1_0:
        "Quando sei nella pagina 'Note cestinate', puoi selezionare una nota e apparirà un popup che ti chiederà se vuoi ripristinare quella nota.",
      text_2_0: "Puoi ripristinare più note premendo a lungo una nota e selezionando le note desiderate. Fai clic su",
      text_2_1: "nell'angolo in alto a destra.",
      text_3_0: "Apparirà un popup e la seconda opzione è quella che stai cercando.",
      text_4_0: "Puoi anche ripristinare tutte le note presenti nel cestino, facendo clic",
      text_4_1: "nell'angolo in alto a destra.",
      text_5_0: "Apparirà un popup e la seconda opzione è quella che stai cercando.",
    },
    how_restore_delete_notes: {
      title: "Come posso ripristinare le note eliminate?",
      text_1_0:
        "Quando sei nella pagina 'Note cestinate', puoi premere a lungo una nota per entrare in 'modalità modifica' e selezionare le note che vuoi eliminare.",
      text_2_0: "Fai clic su",
      text_2_1: "nell'angolo in alto a destra.",
      text_3_0: "Apparirà un popup e la prima opzione è quella che stai cercando.",
      text_4_0: "Puoi anche eliminare tutte le note presenti nel cestino, facendo clic",
      text_4_1: "nell'angolo in alto a destra.",
      text_5_0: "Apparirà un popup e la seconda opzione è quella che stai cercando.",
    },
    what_cloud_sync: {
      title: "Cos'è sincronizzazione Cloud?",
      text_1_0:
        "È possibile sincronizzare le tue note collegando il tuo account Google Firebase e attivando la modalità di sincronizzazione.",
      text_2_0: "Non devi fare nient'altro. Le tue note verranno archiviate in Google Firebase, criptate.",
    },
    what_secret_code: {
      title: "Cos'è un codice segreto?",
      text_1_0: "Le tue note bloccate richiedono un codice segreto che hai generato quando apri l'app per la prima volta.",
      text_2_0: "Puoi cambiarlo dalle impostazioni di base.",
    },
    what_import_export: {
      title: "Cos'è Esporta/Importa dati?",
      text_1_0: "Puoi importare o esportare i dati in locale.",
      text_2_0: "Esportandoli, verrà generato un file nella cartella in cui vuoi salvarli.",
      text_3_0: "Sarà crittografato per impostazione predefinita. Avrai bisogno di una frase segreta per importarlo.",
    },
    what_wipe_data: {
      title: "Cos'è Cancella dati?",
      text_1_0: "Puoi cancellare tutte le note e le categorie.",
      text_2_0: "Apparirà un popup per chiederti se sei sicuro di questa azione.",
      text_3_0: "Verranno eliminati definitivamente.",
    },
    what_ai_assistant: {
      title: "Cos'e' l'Assistente AI?",
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

  /* banner */
  banner: {
    update_available: "Nuova versione disponibile!",
    update_available_cta: "Aggiorna",
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
