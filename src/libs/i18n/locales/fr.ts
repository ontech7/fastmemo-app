const fr = {
  languageCode: "fr",
  languageName: "Français",

  date: {
    mon: "Lun",
    tue: "Mar",
    wed: "Mer",
    thu: "Jeu",
    fri: "Ven",
    sat: "Sam",
    sun: "Dim",
  },
  changelog: {
    title: "Quoi de neuf?",

    web: {
      description_1_1_1: `• Ajout des notes hors ligne : conservez une note uniquement sur cet appareil, sans la synchroniser sur le cloud.
• Reconnaissance vocale 2.0 : dictee vocale amelioree avec nettoyage automatique par IA.
• L'Assistant IA peut desormais suggerer une categorie a partir du titre de la note.
• Ajout d'annuler/retablir et du barre dans l'editeur de texte.
• Le deverrouillage sur ordinateur prend desormais en charge Touch ID et Windows Hello.
• Corrections diverses.`,

      description_1_0_0: `• Premiere version stable de Fast Memo Desktop (hors BETA).
• Nouveau design moderne dans toute l'app, avec la nouvelle police Geist, des surfaces glass et des degrades.
• Onboarding repense avec de nouvelles etapes d'introduction.
• Ajout des parametres de creation de note pour personnaliser les valeurs par defaut.
• Ajout du mode par etapes pour les notes To-Do.
• Corrections diverses.`,

      description_0_3_0: `• Ajout d'un nouveau type de note : Code, avec editeur integre, coloration syntaxique, onglets multiples et detection automatique du langage.
• Ajout de la fonction rechercher et remplacer dans les notes texte.
• Ajout de l'exportation de notes.
• Corrections diverses.`,

      description_0_2_0: `• Possibilite de deplacer les colonnes kanban.
• Animations ameliorees.
• Corrections diverses.`,

      description_0_1_1: `• Synchronisation Cloud corrigée au démarrage de l'application.
• Les notes sont désormais correctement triées après chaque synchronisation.`,

      description_0_1_0: `• Première version de Fast Memo Desktop (BETA) avec toutes les fonctionnalités mobiles.`,
    },

    mobile: {
      description_3_1_1: `• Ajout des notes hors ligne : conservez une note uniquement sur cet appareil, sans la synchroniser sur le cloud.
• Reconnaissance vocale 2.0 : dictee vocale amelioree avec nettoyage automatique par IA.
• L'Assistant IA peut desormais suggerer une categorie a partir du titre de la note.
• Ajout d'annuler/retablir et du barre dans l'editeur de texte.
• Corrections diverses.`,

      description_3_0_0: `• Nouveau design moderne dans toute l'app, avec la nouvelle police Geist, des surfaces glass et des degrades.
• Onboarding repense avec de nouvelles etapes d'introduction.
• Ajout des parametres de creation de note pour personnaliser les valeurs par defaut.
• Ajout du mode par etapes pour les notes To-Do.
• Icone de l'app et ecran de demarrage renouveles.
• Corrections diverses.`,

      description_2_9_1: `• Ajout d'un nouveau type de note : Code, avec editeur integre, coloration syntaxique, onglets multiples et detection automatique du langage.
• Ajout du modele Qwen 2.5 7B avec detection de la RAM de l'appareil. Nouvelles actions AI pour le code : Expliquer le code et Ajouter des commentaires.
• Ajout de la fonction rechercher et remplacer dans les notes texte.
• Ajout de l'exportation de notes.
• Corrections diverses.`,

      description_2_8_0: `• Assistant IA self-hosted (Qwen 2.5) avec des fonctions intelligentes pour les notes. Configurez-le dans Parametres -> Assistant IA.
• Possibilite de deplacer les colonnes kanban.
• Animations ameliorees.
• Corrections diverses.`,

      description_2_7_1: `• Synchronisation Cloud corrigée au démarrage de l'application.
• Les notes sont désormais correctement triées après chaque synchronisation.`,

      description_2_7_0: `• Correction du glisser-déposer Kanban sur mobile, tablette et bureau.
• Alignement des applications mobile et bureau.
• Lancement officiel de l'application de bureau.`,

      description_2_6_2: `• Ajout d’une note de type Kanban.
• Refonte de l’écran d’accueil lors de l’appui sur « + ».
• Le type de note est désormais affiché comme un badge en haut.
• Corrections diverses.`,

      description_2_5_3: `• Corrections diverses.`,

      description_2_5_2: `• Ajout de la possibilité de réorganiser les notes par date de création et date de mise à jour.
• Ajout de la possibilité de changer de langue directement depuis les paramètres.
• Refonte des modales.
• Corrections diverses.`,

      description_2_4_2: `• Structure interne de l’application revue et améliorée pour plus de rapidité et de stabilité.
• Ajout de la reconnaissance vocale pour la transcription des notes (texte et listes).
• Ajout de la fonctionnalité de recherche approfondie (texte et listes).
• Corrections diverses.`,

      description_2_3_0: `• Ajout de la langue japonaise.
• Mise à jour des webhooks à la version BETA 2.0.
• Corrections diverses.`,

      description_2_2_1: `• Ajout de la possibilité de masquer les notes.
• Ajout de la possibilité de signaler un problème dans Paramètres → Commentaires et Assistance.
• Corrections diverses.`,

      description_2_1_0: `• Ajout du nombre de lettres de note et de la taille maximale des notes.
• Ajout du nombre d'éléments dans la note ToDo.
• Ajout d'une limite maximale pour les appareils cloud (3).
• Corrections diverses.`,

      description_2_0_0: `• Ajout de Cloud Sync avec Google Firebase.
• Ajout de la gestion des Webhooks (pour utilisateur expert).
• Ajout d'options d'alignement à gauche et au centre pour les notes textuelles.
• Ajout d'un code secret pour certaines options.
• Modification de la taille de tous les éléments.
• Conception modifiée pour l'écran de code secret.
• Modification du style de la note To-Do.
• Corrections diverses.`,

      description_1_4_0: `• Ajout d'une note de type To-Do.
• Corrections diverses.`,

      description_1_3_0: `• Ajout de traductions pour l'italien, l'espagnol, le français, l'allemand et le chinois.
• Ajout de nouvelles icônes pour les catégories.
• Corrections diverses.`,

      description_1_2_1: `• Sortie en production.
• Notes ajoutées, notes temporaires, catégories, etc.
• Code secret ajouté.
• Corrections diverses.`,
    },
  },
  intro: {
    step1: "Ajoutez vos notes en un clic.",
    step2: "Enrichissez votre texte en utilisant la barre d'outils du bas.",
    step3: "Créer une liste de tâches pour gérer vos tâches.",
    step4: "Visualisez vos idées avec des tableaux Kanban.",
    step5: "Prenez note de vos snippets.",
    step6: "Créez votre propre catégorie selon vos besoins.",
    step7: "Insérez un code secret pour masquer vos notes.",
    step8: "Synchronisez vos notes sur Google Firebase.",
    title: "Qu'est-ce que Fast Memo?",
    continue: "Continue",
  },
  setupcode: {
    title: "Code Secret",
    firstCode_1: "Créez un code secret pour cacher vos notes.",
    firstCode_2: "Vous pourrez passer à l'empreinte digitale à partir des paramètres.",
    repeatCode: "Répétez votre code secret.",
    savedCode: "Votre code secret a été enregistré!",
    error: "Le code saisi ne correspond pas. Essayer à nouveau.",
  },
  secretcode: {
    title: "Code secret",
    oldCode: "Mettez votre ancien code secret.",
    newCode: "Mettez maintenant votre nouveau code secret.",
    repeatCode: "Répétez votre nouveau code secret.",
    savedCode: "Votre nouveau code secret a été enregistré !",
    unlockCode: "Insérez votre code secret",
    error: "Le code que vous avez entré ne correspond pas. Essayer à nouveau.",
  },
  firstMemo: {
    title: "Bienvenue sur FastMemo! 🔊",
  },
  home: {
    notes: "Notes",
    search: "Chercher quelque chose...",
    deepSearch: "Recherche approfondie (texte, listes…)",
    selected_count: "{{count}} sélectionnées",

    filters: {
      deepSearch: "Recherche approfondie",
      orderBy: "Trier par:",
      createdAt: "Date de création",
      updatedAt: "Date de mise à jour",
    },
  },
  note: {
    title_placeholder: "Titre",
    description_placeholder: "Écrivez quelque chose ici...",
    no_items: "Il n'y a aucun élément.\nAjoutez-en un en appuyant sur le bouton en bas à droite.",
    characters: "caractères",
    completed: "complété",
    on: "sur",
    mode_free: "Liste",
    mode_steps: "Étapes",
    ongoing: "En cours",
    created: "Créé: ",
    updated: "Modifié: ",
    type: {
      todo: "Liste",
      kanban: "Kanban",
      text: "Texte",
      code: "Code",
    },
    settings: {
      delete: "Supprimer",
      important: "Important",
      protect: "Protéger",
      readonly: "Lecture seulement",
      hide: "Cacher",
      make_offline: "Rendre hors ligne",
      sync_to_cloud: "Synchroniser avec le cloud",
      made_offline: "La note est maintenant hors ligne",
      synced_as_duplicate: "Synchronisée dans le cloud en tant que copie",
      changecategory: "Changer de catégorie",
      share: "Partager",
      export: "Exporter",
      export_description: "Choisissez le format d'exportation",
      export_txt: "Texte brut (.txt)",
      info: "Informations",
    },
    info: {
      title: "Informations",
      type: "Type",
      category: "Catégorie",
      created: "Créée",
      updated: "Modifiée",
      flags: "Indicateurs",
      no_flags: "Aucun",
      offline: "Hors ligne",
      close: "Fermer",
    },
    find_replace: {
      search_placeholder: "Rechercher...",
      replace_placeholder: "Remplacer par...",
      replace_short: "Rempl.",
      replace_one: "Remplacer",
      replace_all: "Tout",
    },
  },
  kanban: {
    add_column: "Ajouter une colonne",
    add_card: "Ajouter une carte",
    column_name_placeholder: "Nom de la colonne",
    delete_column: "Supprimer la colonne",
    move_to: "Déplacer vers",
    no_columns: "Aucune colonne.\nAjoutez-en une pour commencer.",
    no_cards: "Aucune carte",
    columns_count: "colonnes",
    cards_count: "cartes",
  },
  code: {
    add_tab: "Ajouter un onglet",
    tab_title_placeholder: "Nom du fichier",
    code_placeholder: "Ecrivez votre code ici...",
    max_tabs_reached: "Maximum de 6 onglets atteint",
    delete_tab: "Supprimer l'onglet",
    delete_tab_confirm: "Voulez-vous vraiment supprimer cet onglet ? Cette action est irréversible.",
    language: "Langage",
  },
  changecategory: {
    title: "Changer de Catégorie",
  },
  cloudsync: {
    title: "Cloud Sync",
    syncing_1: "Synchronisation en cours...",
    syncing_2: "Attendre la fin",
    enable: "Activer Cloud sync",
    save: "Enregistrer les paramètres",
    edit: "Modifier les paramètres",
    resync: "Resync les données",
    deleteDevices: "Gérer les appareils",
    handshakeFailed: "Échec de la tentative de connexion",
    handshakeFailedDesc: "Impossible de se connecter au serveur Firebase.",
  },
  synceddevices: {
    title: "Des appareils connectés",
    lastSync: "Dernière synch.: ",
    error_fetching: "Erreur lors de la récupération des appareils",
    upToDate: "À jour",
    pending: "{{count}} en attente",
    mostRecent: "Plus récent",
  },
  createcategory: {
    title_create: "Créer une Catégorie",
    title_update: "Mettre à jour la Catégorie",
    name_title: "Nom",
    name_placeholder: "Entrez le nom de la catégorie ici...",
    icon_title: "Icône",
    suggested_title: "Suggérés",
    notes_num: "Notes: ",
  },
  organizecategory: {
    title: "Organiser",
    empty: "Aucune catégorie pour l'instant.\nAppuyez sur le bouton + pour en créer une.",
  },
  trashednotes: {
    title: "Notes supprimées",
    countdown: "Supprimer en: {{days}} jours, {{hours}} heures e {{minutes}} minutes",
    settings: {
      delete_all: "Supprimer tout",
      restore_all: "Restaurer tout",
      delete_selected: "Supprimer sélectionnéee",
      restore_selected: "Restaurer sélectionnée",
    },
  },
  webhooks: {
    title: "Webhooks",
    addTextNote: "Ajouter une note textuelle",
    addTodoNote: "Ajouter une note de tâche",
    addKanbanNote: "Ajouter une note Kanban",
    addCodeNote: "Ajouter une note Code",
    updateNote: "Note de mise à jour",
    temporaryDeleteNote: "Note de suppression temporaire",
    deleteNote: "Supprimer la note",
    restoreNote: "Restaurer la note",
    createCategory: "Créer une catégorie",
    deleteCategory: "Supprimer la catégorie",
    updateCategory: "Mettre à jour la catégorie",
    exportData: "Exporter des données",
    exporData: "Exporter des données",
    importData: "Importer des données",
    wipeData: "Effacer les données",
  },
  generalsettings: {
    title: "Paramètres",
    basic: "Basique",
    cloudsync: "Cloud Sync",
    temporary_trash_lifespan: "Durée de la corbeille temporaire",
    days: "jours",
    change_secret_code: "Changez votre code secret",
    enable_fingerprint: "Activer l'empreinte digitale",
    fingerprint_reason: "Déverrouillez vos notes",
    advanced: "Avancé",
    show_hidden: "Afficher les notes masquées",
    export_import_data: "Exporter/Importer des données",
    export_import_popup_title: "Mot de passe secret",
    export_import_placeholder_input: "Entrez le code secret...",
    export_popup_description:
      "Écrivez votre mot de passe secret ici. Pensez à le sauvegarder sinon vous ne pourrez pas récupérer vos notes.",
    import_popup_description: "Écrivez votre mot de passe secret ici pour importer vos notes.",
    webhooks: "Webhooks",
    voice_recognition: "Reconnaissance vocale",
    ai_assistant: "Assistant IA",
    note_creation: "Création de note",
    wipe_data: "Effacer les données",
    developer_options: "Options développeur",
    about: "À propos",
    about_the_app: "À propos de l'application",
    about_the_developer: "À propos du développeur",
    check_updates: "Vérifier les mises à jour",
    checking_updates: "Vérification...",
    update_available: "Mise à jour disponible",
    update_confirm: "Voulez-vous l'installer maintenant?",
    no_updates: "Vous utilisez la dernière version.",
    feedback_and_help: "Commentaires et Aide",
    help: "Aider",
    changelog: "Journal des modifications",
    report: "Signaler un problème",
    suggest: "Recommander à un ami",
  },
  info: {
    title: "Information",
    fastmemo: "Fast Memo",
    app: "App",
    version: "Version",
    libraries: "Bibliothèques",
  },
  note_creation: {
    title: "Création de note",
    mode_section: "Mode",
    default_type_section: "Type de note par défaut",
    mode: {
      simple: "Simple",
      simple_description: "Appuyer crée une note texte. Utilisez le menu pour les autres types.",
      smart: "Smart",
      smart_description: "Appuyer crée toujours le type choisi ci-dessous.",
      adaptive: "Adaptatif",
      adaptive_description: "Appuyer crée le même type que votre dernière note.",
    },
  },
  aboutdeveloper: {
    title: "Sur moi",
    freelance: "Développeur Web Indépendant",
    information: "Information",
    developer: "Développeur",
    website: "Site Internet",
    openLink: "Ouvrir le lien",
  },
  ai: {
    title: "Assistant IA",
    model: "Modele",
    status: "Statut",
    settings: "Parametres",
    enabled: "Active",
    downloaded: "Telecharge",
    not_downloaded: "Non telecharge",
    downloading: "Telechargement...",
    download_model: "Telecharger le modele",
    cancel: "Annuler",
    delete_model: "Supprimer le modele",
    info: "L'assistant IA fonctionne entierement sur votre appareil. Aucune donnee n'est envoyee a des serveurs externes. Le modele doit etre telecharge une fois (~400 Mo) et sera stocke localement.",
    model_light: "Rapide, qualite de base. 3Go+ RAM requis.",
    model_powerful: "Bon equilibre vitesse/qualite. 4Go+ RAM requis.",
    model_advanced: "Haute qualite. 6Go+ RAM requis.",
    model_pro: "Qualite maximale, performances proches d'un PC. 8Go+ RAM requis.",
    model_unavailable: "RAM insuffisante sur cet appareil",
    capabilities_title: "Que puis-je faire?",
    cap: {
      generate_title: "Generer un titre a partir du contenu",
      summarize: "Resumer une note en quelques phrases",
      fix_grammar: "Corriger l'orthographe et la grammaire",
      shorten: "Rendre un texte plus court et concis",
      translate: "Traduire une note dans la langue de l'app",
      suggest_items: "Suggerer de nouveaux elements pour une liste",
      suggest_category: "Suggerer la meilleure categorie pour une note",
      voice_cleanup: "Nettoyer le texte dicté avec la ponctuation",
      explain_code: "Expliquer ce que fait le code",
      add_comments: "Ajouter des commentaires au code",
    },
    unavailable_web: "L'Assistant IA n'est disponible que sur les appareils mobiles.",
    native_rebuild_needed: "L'Assistant IA necessite une reconstruction native.\nExecutez: npx expo run:android",
    voice_only: "Voix uniquement",
    voice_only_hint: "Interagir avec l'assistant en utilisant uniquement votre voix",
    listening: "J'ecoute...",
    tap_to_speak: "Appuyez sur le micro pour parler",
    sending_soon: "Envoi...",
    placeholder: "Que souhaitez-vous faire?",
    processing: "Reflexion...",
    feedback: {
      note_created: 'Note "{{title}}" creee',
      property_toggled: "{{count}} note(s) mise(s) a jour",
      note_deleted: "{{count}} note(s) deplacee(s) vers la corbeille",
      category_changed: "{{count}} note(s) deplacee(s)",
      done: "Termine",
      note_renamed: 'Note renommee en "{{title}}"',
      items_added: "{{count}} element(s) ajoute(s)",
      category_created: 'Categorie "{{name}}" creee',
      note_restored: "{{count}} note(s) restauree(s)",
      category_switched: 'Passe a "{{name}}"',
      no_notes_found: "Aucune note correspondante trouvee",
      category_not_found: "Categorie non trouvee",
      not_todo_note: "Cette note n'est pas une liste",
      category_exists: "La categorie existe deja",
      note_converted: 'Note "{{title}}" convertie',
      notes_merged: 'Notes fusionnees dans "{{title}}"',
      setting_changed: "Parametre mis a jour",
      help_message:
        'Je peux creer des notes, listes et tableaux, supprimer, renommer, convertir et fusionner des notes.\nEssayez: "Fais une liste de courses avec lait et pain"\nVoir tout dans Parametres > Assistant IA.',
      same_type: "La note est deja de ce type",
      not_understood: "Je ne peux aider qu'avec les notes",
      error: "Un probleme est survenu, reessayez",
      voice_unavailable: "Voix non disponible",
    },
    editor: {
      generate_title: "Generer un titre",
      summarize: "Resumer",
      suggest_items: "Suggerer des elements",
      suggest_category: "Suggerer une categorie",
      explain_code: "Expliquer le code",
      add_comments: "Ajouter des commentaires",
      fix_grammar: "Corriger la grammaire",
      shorten: "Raccourcir",
      translate: "Traduire",
      min_model: "Minimum",
      before: "Avant",
      after: "Après",
      apply: "Appliquer",
      no_content: "Ecrivez quelque chose d'abord",
      no_category_match: "Aucune categorie correspondante",
      error: "Impossible de generer, reessayez",
    },
  },
  voicerecognition: {
    title: "Reconnaissance vocale",
    enabled: "Activé",
    interimResults: "Transcription en temps réel",
    continuous: "Arrêt manuel",
    language: "Langue",
    language_default: "Par défaut (système)",
    dictation: {
      listening: "À l'écoute…",
      paused: "En pause",
      hint: 'Parlez maintenant. Dites "virgule", "point", "point d\'interrogation" ou "à la ligne" pour ponctuer.',
      insert: "Insérer",
      cancel: "Annuler",
      ai_cleanup: "Nettoyer avec l'IA",
      processing: "Traitement…",
    },
  },
  help: {
    title: "Aide",
    search_placeholder: "Comment pouvons-nous vous aider ?",
    no_results: "Aucun résultat. Essayez un autre mot.",
    search_placeholders: [
      "Cherchez ou décrivez ce dont vous avez besoin…",
      "Comment créer une note ?",
      "À quoi sert la barre d'outils ?",
      "Comment fonctionne la synchronisation cloud ?",
      "Comment récupérer une note supprimée ?",
    ],
    ai_thinking: "Recherche avec l'IA…",
    ai_results: "Résultats IA · appuyez pour réinitialiser",
    ai_invite_title: "Vous ne trouvez pas ce que vous cherchez ?",
    ai_invite_subtitle: "Décrivez-le avec vos mots et laissez l'assistant IA trouver le bon sujet.",
    cat_notes: "Notes",
    cat_editor: "Éditeur et mise en forme",
    cat_categories: "Catégories",
    cat_trash: "Corbeille",
    cat_cloud: "Synchronisation cloud et chiffrement",
    cat_data: "Sécurité et données",
    cat_settings: "Paramètres",
    cat_more: "Plus et infos",
    cat_ai: "Assistant IA",
    how_to_create_note: {
      title: "Comment créer une note ?",
      text_1_0: "Appuyez sur le bouton",
      text_1_1: "dans le coin inférieur droit de la page d'accueil.",
      text_2_0: "Une nouvelle page s'ouvre où vous pouvez ajouter un titre et rédiger votre note.",
      text_3_0: "Pour l'enregistrer, il suffit de revenir à la page d'accueil.",
    },
    how_to_create_todo_note: {
      title: "Comment créer une liste de tâches ?",
      text_1_0: "Appuyez sur le bouton",
      text_1_1: "dans le coin inférieur droit de la page d'accueil.",
      text_2_0: "Une nouvelle page s'ouvre où vous pouvez ajouter un titre et vos tâches à faire.",
      text_3_0: "Faites glisser les six points à droite d'un élément pour le déplacer vers le haut ou le bas.",
      text_4_0: "Appuyez sur la croix à droite pour supprimer un élément.",
      text_5_0: "Les boutons en bas vous permettent de :",
      text_6_0: "• Ajouter — ajouter un nouvel élément à la liste.",
      text_7_0:
        "• Changer de mode — basculez entre Liste (une liste de tâches classique) et Étapes (une liste numérotée et séquentielle à compléter dans l'ordre).",
      text_8_0: "• Tout supprimer — supprimer tous les éléments de la liste.",
      text_9_0: "Pour l'enregistrer, il suffit de revenir à la page d'accueil.",
    },
    how_to_create_kanban_note: {
      title: "Comment créer un tableau Kanban ?",
      text_1_0: "Appuyez sur le bouton",
      text_1_1: "dans le coin inférieur droit de la page d'accueil et choisissez 'Kanban'.",
      text_2_0: "Un tableau s'ouvre avec une colonne prête à l'emploi.",
      text_3_0: "• Ajouter une colonne — appuyez sur 'Ajouter une colonne' à droite (jusqu'à 10).",
      text_4_0: "• Renommer une colonne — modifiez le texte dans son en-tête.",
      text_5_0: "• Changer la couleur d'une colonne — appuyez sur le carré coloré dans son en-tête.",
      text_6_0: "• Ajouter une carte — appuyez sur 'Ajouter une carte' en bas d'une colonne.",
      text_7_0: "• Déplacer une carte — appuyez longuement dessus, puis faites-la glisser vers une autre colonne.",
      text_8_0: "• Supprimer une carte — appuyez sur l'icône de corbeille sur la carte.",
      text_9_0: "• Supprimer une colonne — appuyez sur l'icône de corbeille dans son en-tête.",
      text_10_0: "Pour enregistrer le tableau, il suffit de revenir à la page d'accueil.",
    },
    how_to_create_code_note: {
      title: "Comment créer une note de code ?",
      text_1_0: "Appuyez sur le bouton",
      text_1_1: "dans le coin inférieur droit de la page d'accueil et choisissez 'Code'.",
      text_2_0: "Vous obtenez un véritable éditeur de code avec coloration syntaxique.",
      text_3_0:
        "• Onglets — gardez plusieurs extraits dans une seule note ; ajoutez-les, renommez-les, supprimez-les ou faites-les glisser pour les réorganiser (jusqu'à 6).",
      text_4_0: "• Langage — appuyez sur la barre de langage pour en choisir un, ou laissez-le être détecté automatiquement.",
      text_5_0: "• Rechercher et remplacer — appuyez sur l'icône de recherche en haut, comme dans une note de texte.",
      text_6_0: "Pour l'enregistrer, il suffit de revenir à la page d'accueil.",
    },
    how_to_edit_note: {
      title: "Comment modifier une note ?",
      text_1_0: "Appuyez simplement sur la note dans la page d'accueil pour l'ouvrir et apporter vos modifications.",
    },
    how_to_delete_note: {
      title: "Comment supprimer une note ?",
      text_1_0: "Lors de l'affichage d'une note, appuyez sur",
      text_1_1: "dans le coin supérieur droit.",
      text_2_0: "Un menu s'ouvre — 'Supprimer' est la première option.",
    },
    how_to_select_notes: {
      title: "Comment sélectionner plusieurs notes à la fois ?",
      text_1_0: "Appuyez longuement sur n'importe quelle note pour commencer la sélection.",
      text_2_0:
        "Cela active le mode sélection, où vous pouvez agir sur plusieurs notes en même temps — les supprimer, ou les marquer comme importantes, en lecture seule ou verrouillées.",
    },
    what_are_hidden_notes: {
      title: "Comment fonctionnent les notes masquées ?",
      text_1_0: "Ouvrez le menu d'options d'une note et appuyez sur 'Masquer' pour la dissimuler sur la page d'accueil.",
      text_2_0:
        "Pour revoir les notes masquées, activez 'Afficher les notes masquées' dans les paramètres avancés — votre code secret vous sera demandé.",
    },
    what_toolbar_below: {
      title: "Qu'est-ce que la barre d'outils en bas ?",
      text_1_0: "Elle vous permet de mettre en forme et d'enrichir votre texte. Voici ce que font les boutons :",
      text_2_0: "• Annuler / Rétablir — revenir en arrière ou en avant dans vos dernières modifications.",
      text_3_0: "• Image — insérer une image depuis votre galerie.",
      text_4_0: "• Gras — mettre le texte sélectionné en gras.",
      text_5_0: "• Italique — mettre le texte sélectionné en italique.",
      text_6_0: "• Barré — barrer le texte sélectionné.",
      text_7_0: "• Souligné — souligner le texte sélectionné.",
      text_8_0: "• Indice — abaisser légèrement le texte sous la ligne.",
      text_9_0: "• Exposant — élever légèrement le texte au-dessus de la ligne.",
      text_10_0: "• Liste à puces — démarrer une liste à puces.",
      text_11_0: "• Liste numérotée — démarrer une liste numérotée.",
      text_12_0: "• Code — entourer le texte d'un bloc de code formaté.",
    },
    what_find_replace: {
      title: "Comment rechercher et remplacer du texte ?",
      text_1_0:
        "Lors de l'édition d'une note de texte ou de code, appuyez sur l'icône de recherche dans le coin supérieur droit.",
      text_2_0: "Saisissez ce que vous cherchez : les flèches passent d'une occurrence à l'autre et indiquent leur nombre.",
      text_3_0: "Activez 'Remplacer' pour remplacer l'occurrence actuelle, ou remplacez toutes les occurrences d'un coup.",
    },
    what_are_settings_note: {
      title: "Quelles sont les options d'une note ?",
      text_1_0: "Ouvrez une note et appuyez sur le menu ⋮ dans le coin supérieur droit. De là, vous pouvez :",
      text_2_0: "• Supprimer — déplacer la note vers la corbeille.",
      text_3_0: "• Important — marquer la note pour qu'elle ressorte en haut.",
      text_4_0: "• Protéger — verrouiller la note derrière votre code secret ou votre empreinte digitale.",
      text_5_0: "• Lecture seule — empêcher la note d'être modifiée par accident.",
      text_6_0:
        "• Masquer — garder la note hors de la page d'accueil jusqu'à ce que vous choisissiez d'afficher les notes masquées.",
      text_7_0: "• Rendre hors ligne — garder la note uniquement sur cet appareil, jamais synchronisée vers le cloud.",
      text_8_0: "• Changer de catégorie — déplacer la note vers une autre catégorie.",
      text_9_0: "• Exporter (notes de texte) — enregistrer la note sous forme de fichier .txt, Markdown ou PDF.",
      text_10_0: "• Informations — voir le type, la catégorie et les dates de la note.",
    },
    how_create_category: {
      title: "Comment créer une catégorie ?",
      text_1_0: "Sur la page d'accueil, appuyez sur",
      text_1_1: "dans le coin supérieur gauche.",
      text_2_0: "Cela ouvre la page 'Organiser'. Là, appuyez sur",
      text_2_1: "dans le coin inférieur droit.",
      text_3_0: "Sur la page 'Créer une catégorie', donnez-lui un nom et choisissez une icône qui n'est pas déjà utilisée.",
      text_4_0: "Quand vous avez terminé, appuyez sur",
      text_4_1: "dans le coin inférieur droit pour l'enregistrer.",
    },
    how_edit_category: {
      title: "Comment modifier une catégorie ?",
      text_1_0: "Sur la page d'accueil, appuyez sur",
      text_1_1: "dans le coin supérieur gauche.",
      text_2_0:
        "Sur la page 'Organiser', appuyez sur la catégorie que vous souhaitez modifier — sa page d'édition s'ouvre, où vous pouvez la renommer ou choisir une nouvelle icône.",
    },
    how_organize_categories: {
      title: "Comment réorganiser mes catégories ?",
      text_1_0: "Sur la page d'accueil, appuyez sur",
      text_1_1: "dans le coin supérieur gauche.",
      text_2_0: "Sur la page 'Organiser', appuyez sur",
      text_2_1: "pour passer en mode organisation.",
      text_3_0: "Appuyez sur une catégorie pour la prendre, puis appuyez sur une autre pour l'y déposer et changer l'ordre.",
      text_4_0: "Quand l'ordre vous convient, appuyez sur",
      text_4_1: "pour l'enregistrer.",
      text_5_0: "Pour annuler vos modifications, appuyez sur",
      text_5_1: "dans le coin supérieur droit.",
    },
    how_delete_category: {
      title: "Comment supprimer une catégorie ?",
      text_1_0: "Sur la page d'accueil, appuyez longuement sur une catégorie pour passer en mode sélection.",
      text_2_0: "Puis appuyez sur",
      text_2_1:
        "et choisissez de supprimer la catégorie avec ses notes, ou de conserver les notes en les déplaçant vers 'Toutes'.",
    },
    what_are_trashed_notes: {
      title: "Qu'est-ce que la corbeille ?",
      text_1_0: "Lorsque vous supprimez une note, elle n'est pas perdue tout de suite — elle va d'abord dans la corbeille.",
      text_2_0:
        "Les notes y restent 7 jours, puis sont définitivement supprimées. Vous pouvez modifier leur durée de conservation dans les paramètres de base.",
    },
    how_restore_trashed_notes: {
      title: "Comment restaurer des notes supprimées ?",
      text_1_0: "Ouvrez la page 'Corbeille' et appuyez sur une note — il vous sera demandé si vous souhaitez la restaurer.",
      text_2_0:
        "Pour en restaurer plusieurs à la fois, appuyez longuement sur une note, sélectionnez celles que vous voulez, puis appuyez sur",
      text_2_1: "dans le coin supérieur droit.",
      text_3_0: "Dans le menu qui apparaît, choisissez 'Restaurer'.",
      text_4_0: "Pour tout récupérer d'un coup, appuyez sur",
      text_4_1: "dans le coin supérieur droit.",
      text_5_0: "Dans le menu qui apparaît, choisissez 'Tout restaurer'.",
    },
    how_restore_delete_notes: {
      title: "Comment supprimer définitivement des notes de la corbeille ?",
      text_1_0:
        "Ouvrez la page 'Corbeille', appuyez longuement sur une note pour passer en mode sélection, puis choisissez celles à supprimer.",
      text_2_0: "Appuyez sur",
      text_2_1: "dans le coin supérieur droit.",
      text_3_0: "Dans le menu qui apparaît, choisissez 'Supprimer'.",
      text_4_0: "Pour vider toute la corbeille d'un coup, appuyez sur",
      text_4_1: "dans le coin supérieur droit.",
      text_5_0: "Dans le menu qui apparaît, choisissez 'Tout supprimer'.",
    },
    what_cloud_sync: {
      title: "Qu'est-ce que la synchronisation cloud ?",
      text_1_0:
        "Vous pouvez synchroniser vos notes entre appareils en connectant votre propre projet Google Firebase et en activant la synchronisation. Il n'y a pas de serveur central Fast Memo — vos données vivent uniquement dans votre Firebase.",
      text_2_0:
        "Vos notes sont chiffrées de bout en bout sur votre appareil avant d'être envoyées, de sorte que personne d'autre que vous ne peut les lire.",
      text_link: "Lire le guide pas à pas pour configurer Google Firebase →",
    },
    what_encryption: {
      title: "Comment mes notes sont-elles chiffrées ?",
      text_1_0:
        "La synchronisation cloud utilise le chiffrement de bout en bout. Lors de la première configuration, vous choisissez un mot de passe de chiffrement, et votre appareil en dérive la clé qui protège vos notes.",
      text_2_0:
        "La clé ne quitte jamais votre appareil et n'est jamais stockée dans le cloud : même une personne ayant accès à votre Firebase ne peut pas lire le contenu de vos notes sans votre mot de passe.",
      text_3_0:
        "Le contenu des notes est chiffré ; les titres et les dates restent lisibles pour que l'application puisse les trier et les synchroniser.",
    },
    how_unlock_device: {
      title: "Pourquoi dois-je déverrouiller sur chaque appareil ?",
      text_1_0:
        "Chaque appareil déverrouille le chiffrement une fois en saisissant votre mot de passe. Ensuite, la clé est stockée en toute sécurité sur l'appareil (Keychain / Keystore), vous n'avez donc pas à la ressaisir à chaque lancement.",
      text_2_0:
        "Si un appareil reste verrouillé, la synchronisation y est suspendue jusqu'à ce que vous le déverrouilliez — cela empêche vos notes d'être enregistrées de façon illisible.",
    },
    forgot_password: {
      title: "J'ai oublié mon mot de passe de chiffrement",
      text_1_0:
        "Lorsque vous configurez le chiffrement, une clé de récupération vous est présentée une seule fois. Conservez-la en lieu sûr.",
      text_2_0:
        "Sur l'écran de déverrouillage, choisissez 'Mot de passe oublié', saisissez votre clé de récupération et définissez un nouveau mot de passe. Aucune note n'est perdue.",
      text_3_0:
        "Si vous perdez à la fois le mot de passe et la clé de récupération, vos notes dans le cloud ne peuvent être déchiffrées par personne — c'est tout l'intérêt du chiffrement de bout en bout.",
    },
    reset_encryption: {
      title: "Que fait la réinitialisation du chiffrement ?",
      text_1_0:
        "La réinitialisation est le dernier recours, lorsque le mot de passe et la clé de récupération sont tous deux perdus.",
      text_2_0:
        "Elle crée une nouvelle configuration de chiffrement à partir des notes actuellement présentes sur cet appareil et remplace la copie du cloud. Les anciennes notes du cloud qui ne peuvent plus être déchiffrées sont supprimées.",
      text_3_0:
        "Vos notes locales sont conservées et renvoyées, donc cet appareil ne perd rien — mais vos autres appareils devront se déverrouiller à nouveau avec le nouveau mot de passe.",
    },
    quick_backup: {
      title: "Qu'est-ce que la sauvegarde rapide ?",
      text_1_0:
        "Sur les écrans de configuration, de déverrouillage et de réinitialisation du chiffrement, vous trouverez un bouton facultatif 'Sauvegarde rapide'.",
      text_2_0:
        "Il exporte un fichier de vos notes protégé par une phrase secrète directement depuis cet appareil, indépendamment du cloud — un filet de sécurité avant une synchronisation importante ou une réinitialisation. Vos notes restent de toute façon toujours sur cet appareil.",
    },
    what_secret_code: {
      title: "Qu'est-ce que le code secret ?",
      text_1_0:
        "C'est le code que vous avez défini la première fois que vous avez ouvert l'application, et il vous sera nécessaire pour ouvrir toute note que vous avez verrouillée.",
      text_2_0: "Vous pouvez le modifier à tout moment depuis les paramètres de base.",
    },
    what_import_export: {
      title: "Qu'est-ce que l'import et l'export ?",
      text_1_0:
        "Ils vous permettent d'enregistrer une copie de vos données, ou de les restaurer, directement sur votre appareil.",
      text_2_0: "Lorsque vous exportez, un fichier est enregistré dans le dossier que vous choisissez.",
      text_3_0:
        "Le fichier est toujours chiffré — vous aurez besoin de la phrase secrète que vous avez définie pour l'importer à nouveau.",
    },
    how_export_note: {
      title: "Comment exporter une seule note ?",
      text_1_0: "Ouvrez une note de texte, appuyez sur le menu d'options et choisissez 'Exporter'.",
      text_2_0: "Puis choisissez le format souhaité :",
      text_3_0: "• Texte brut (.txt) — uniquement le texte, sans mise en forme.",
      text_4_0: "• Markdown (.md) — conserve les titres et la mise en forme de base.",
      text_5_0: "• PDF — un document soigné, prêt à partager.",
      text_6_0: "Le fichier est partagé via votre appareil, vous pouvez donc l'enregistrer ou l'envoyer où vous voulez.",
    },
    what_wipe_data: {
      title: "Que fait l'effacement des données ?",
      text_1_0: "Il supprime toutes vos notes et catégories de cet appareil d'un seul coup.",
      text_2_0: "Une confirmation vous sera d'abord demandée, car cette action est irréversible.",
      text_3_0: "Une fois confirmé, tout est supprimé définitivement.",
    },
    what_note_creation: {
      title: "Que fait le paramètre de création de note ?",
      text_1_0:
        "Il détermine ce qui se passe lorsque vous appuyez sur le bouton [+] de la page d'accueil. Dans Paramètres → Création de note, vous pouvez choisir :",
      text_2_0: "• Simple — [+] crée une note de texte ; utilisez le menu pour les autres types.",
      text_3_0: "• Intelligent — [+] crée toujours le type que vous avez choisi comme favori.",
      text_4_0: "• Adaptatif — [+] crée le même type que la dernière note sur laquelle vous avez travaillé.",
    },
    what_home_filters: {
      title: "Comment fonctionnent les filtres de l'accueil ?",
      text_1_0:
        "Appuyez sur l'icône de filtre en haut de la page d'accueil pour changer la façon dont vos notes sont affichées.",
      text_2_0: "• Trier par — trier par date de création ou dernière mise à jour, par ordre croissant ou décroissant.",
      text_3_0:
        "• Recherche approfondie — rechercher aussi dans le contenu des notes et des listes, pas seulement dans les titres (votre code secret est d'abord demandé).",
    },
    what_language: {
      title: "Comment changer la langue ?",
      text_1_0: "Ouvrez les paramètres de base et appuyez sur 'Langue' pour en changer.",
      text_2_0:
        "Vous pouvez suivre automatiquement la langue de votre appareil, ou en choisir une parmi les sept disponibles : anglais, italien, espagnol, français, allemand, chinois et japonais.",
    },
    what_version_check: {
      title: "L'application vérifie-t-elle les mises à jour ?",
      text_1_0: "Oui — quand vous ouvrez Fast Memo, elle vérifie discrètement si une nouvelle version est disponible.",
      text_2_0:
        "Lorsqu'une mise à jour est disponible, un écran 'Quoi de neuf ?' montre les changements. Vous pouvez aussi vérifier à tout moment depuis les paramètres.",
    },
    what_report_problem: {
      title: "Comment signaler un problème ?",
      text_1_0: "Allez dans Paramètres → Signaler un problème.",
      text_2_0:
        "Choisissez un sujet, décrivez ce qui s'est passé, et joignez éventuellement quelques captures d'écran et les infos de votre appareil pour nous aider à examiner le problème.",
      text_3_0: "Vous pouvez envoyer un signalement par jour.",
    },
    what_webhooks: {
      title: "Qu'est-ce que les webhooks ?",
      text_1_0:
        "Les webhooks sont destinés aux utilisateurs avancés : ils permettent à Fast Memo de notifier un autre service chaque fois qu'un événement se produit — une note créée, mise à jour ou supprimée, une catégorie modifiée, des données exportées, et ainsi de suite.",
      text_2_0: "Chaque action peut appeler une adresse web de votre choix. Vous les configurez dans Paramètres → Webhooks.",
    },
    what_platforms: {
      title: "Où puis-je utiliser Fast Memo ?",
      text_1_0:
        "Fast Memo fonctionne à la fois sur mobile et sur ordinateur (Windows, macOS et Linux), ainsi qu'en version web.",
      text_2_0: "Connectez le même projet Google Firebase sur chaque appareil et vos notes restent synchronisées partout.",
    },
    what_ai_assistant: {
      title: "Qu'est-ce que l'Assistant IA ?",
      text_1_0:
        "Fast Memo inclut un Assistant IA auto-hébergé qui fonctionne entièrement sur votre appareil. Aucune donnée n'est envoyée à des serveurs externes.",
      text_2_0: "Pour le configurer, allez dans Paramètres -> Assistant IA, choisissez un modèle et téléchargez-le.",
      text_3_0:
        "Une fois activé, un bouton étincelle apparaît dans chaque éditeur de note. Appuyez dessus pour accéder à des actions intelligentes comme : générer un titre, résumer, continuer à écrire, mettre en forme le texte, suggérer des éléments de liste ou suggérer une catégorie.",
      text_4_0: "L'IA fonctionne hors ligne et prend en charge plusieurs langues.",
    },
  },
  report: {
    title: "Signaler un Problème",
    question: "Quel est le sujet du problème ?",
    topic: {
      crash: "Crash",
      notes: "Notes",
      categories: "Catégories",
      cloud: "Nuage",
      webhooks: "Webhooks",
      export_import: "Exporter/Importer",
      translations: "Traductions",
      suggestions: "Suggestions",
      other: "Autre",
    },
    descriptionPlaceholder: "Veuillez décrire le problème en détail (obligatoire)",
    deviceInfoCheckbox: "Pour un diagnostic plus précis, veuillez nous fournir les détails de l'appareil.",
    attachments: "Ajouter des images",
    sendReport: "Envoyer le Rapport",

    sent_message_1: "Merci d'avoir soumis le rapport.",
    sent_message_2: "Un autre rapport peut être soumis à partir du jour :",

    attachments_limit: "Limite d'attachments :",
    size_limit: "Limite de taille par image :",
    loading: "Chargement...",

    messages: {
      size: {
        title: "Fichier trop volumineux !",
        text: "Choisissez un fichier plus petit ou compressez-le.",
      },
      success: {
        title: "Succès !",
        text: "Le rapport a été envoyé avec succès.",
      },
      error: {
        title: "Erreur !",
        text: "Le rapport n'a pas pu être envoyé.",
      },
      missing: {
        title: "Données Manquantes !",
        text: "Veuillez remplir le sujet et la description du problème.",
      },
    },
  },

  /* popup */
  popup: {
    delete_category: "Voulez-vous supprimer cette catégorie?\nVous pouvez déplacer les notes vers la catégorie 'TOUTES'",
    restore_single_note: "Voulez-vous restaurer cette note?",
    restore_notes: "Voulez-vous restaurer ces notes?",
    delete_notes: "Voulez-vous supprimer ces notes?",
    delete_notes_perma: "Voulez-vous supprimer définitivement ces notes?",
    restore_all_notes: "Voulez-vous restaurer TOUTES les notes?",
    delete_all_notes_perma: "Voulez-vous supprimer TOUTES les notes définitivement?",
    select_one_option: "Veuillez sélectionner une option",
    passphrase_wrong: "La phrase de passe que vous avez saisie est erronée.",
    are_you_sure_wipe: "Voulez-vous vraiment effacer vos données?\nVous perdrez toutes les notes et catégories créées.",
    finish_organize_categories: "Terminer pour organiser les catégories ou annuler vos modifications.",
    generic_success_description: "L'opération a réussi.",
  },

  /* generic */
  All: "Tous",
  delete_and_move: "Supprimer et Déplacer",
  delete_with_notes: "Supprimer avec des Notes",
  ok: "Ok",
  confirm: "Confirmation",
  cancel: "Annuler",
  delete: "Supprimer",
  restore: "Restaurer",
  warning: "Avertissement",
  error: "Erreur",
  import: "Importer",
  export: "Exporter",
  retry: "Recommencez",
  wipe: "Essuyez tout",
  wipeWithCloud: "Essuyez + Cloud",

  developeroptions: {
    title: "Options développeur",
    warning:
      "Ces options peuvent compromettre la synchronisation Cloud de certaines notes ou affecter les performances de l'app.",
    unlimited_text_space: "Espace texte illimité",
    unlimited_text_space_desc: "Limite actuelle : 1 Mo",
    unlimited_kanban_columns: "Colonnes Kanban illimitées",
    unlimited_kanban_columns_desc: "Limite actuelle : 10 colonnes",
    unlimited_trash_time: "Durée de corbeille illimitée",
    unlimited_trash_time_desc: "Limite actuelle : 30 jours",
    change_app_icon: "Changer l'icône de l'app",
    change_app_icon_desc: "Bientôt disponible",
  },

  /* toast */
  disconnected: "Vous avez été déconnecté du Cloud",
  loading: "Chargement...",
  dataSynced: "Données synchronisées",
  noInternetConnection: "Pas de connexion Internet",
  devicesLimitReached: "Limite de périphériques dépassée",
  noteLimitReached: "Limite de notes atteinte",
  developerModeActivated: "Mode développeur activé !",
  developerModeAlready: "Le mode développeur est déjà actif",
  developerModeTaps: "Encore {{remaining}} appui(s) pour activer le mode développeur",

  empty_title: "(Pas de titre)",
};

export default fr;
