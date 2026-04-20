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
      description_0_2_0: `• Possibilite de deplacer les colonnes kanban.
• Animations ameliorees.
• Corrections diverses.`,

      description_0_1_1: `• Synchronisation Cloud corrigée au démarrage de l'application.
• Les notes sont désormais correctement triées après chaque synchronisation.`,

      description_0_1_0: `• Première version de Fast Memo Desktop (BETA) avec toutes les fonctionnalités mobiles.`,
    },

    mobile: {
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
    step4: "Créez votre propre catégorie selon vos besoins.",
    step5: "Insérez un code secret pour masquer vos notes.",
    step6: "Synchronisez vos notes sur votre Google Firebase.",
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
    created: "Créé: ",
    updated: "Modifié: ",
    type: {
      todo: "Liste",
      kanban: "Kanban",
      text: "Texte",
    },
    settings: {
      delete: "Supprimer",
      important: "Important",
      protect: "Protéger",
      readonly: "Lecture seulement",
      hide: "Cacher",
      changecategory: "Changer de catégorie",
      share: "Partager",
      export: "Exporter",
      export_description: "Choisissez le format d'exportation",
      export_txt: "Texte brut (.txt)",
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
  },
  createcategory: {
    title_create: "Créer une Catégorie",
    title_update: "Mettre à jour la Catégorie",
    name_title: "Nom",
    name_placeholder: "Entrez le nom de la catégorie ici...",
    icon_title: "Icône",
    notes_num: "Notes: ",
  },
  organizecategory: {
    title: "Organiser",
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
  aboutdeveloper: {
    title: "Sur moi",
    freelance: "Développeur Web Indépendant",
    information: "Information",
    developer: "Développeur",
    website: "Site Internet",
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
    model_light: "Leger et rapide. Recommande pour la plupart des appareils.",
    model_powerful: "Plus precis et performant. Necessite plus de stockage et de RAM.",
    model_advanced: "Meilleure qualite. Pour les appareils avec 8Go+ de RAM.",
    capabilities_title: "Que puis-je faire?",
    cap: {
      generate_title: "Generer un titre a partir du contenu",
      summarize: "Resumer une note en quelques phrases",
      continue_writing: "Continuer a ecrire ou vous vous etes arrete",
      format_text: "Formater le texte avec titres, gras, listes, etc.",
      suggest_items: "Suggerer de nouveaux elements pour une liste",
      suggest_category: "Suggerer la meilleure categorie pour une note",
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
      continue_writing: "Continuer a ecrire",
      suggest_items: "Suggerer des elements",
      format_text: "Formater le texte",
      suggest_category: "Suggerer une categorie",
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
  },
  help: {
    title: "Aider",
    how_to_create_note: {
      title: "Comment puis-je créer une note?",
      text_1_0: "Vous pouvez créer une note en cliquant sur le bouton",
      text_1_1: "dans le coin inférieur droit de la page d'accueil.",
      text_2_0: "Il apparaîtra une nouvelle page où vous pourrez écrire un titre et une description à votre note.",
      text_3_0: "Vous pouvez le sauvegarder en revenant sur la page d'accueil.",
    },
    how_to_create_todo_note: {
      title: "Comment puis-je créer une note de tâche?",
      text_1_0: "Vous pouvez créer une note de tâche en cliquant sur",
      text_1_1: "bouton en bas à droite de la page d'accueil.",
      text_2_0:
        "Une nouvelle page apparaîtra sur laquelle vous pourrez écrire un titre et une liste de textes de tâches à faire sur votre note.",
      text_3_0: "En appuyant sur les 6 points à droite d'un élément, vous pourrez le déplacer de haut en bas.",
      text_4_0: "Le bouton croix à droite supprimera cet élément.",
      text_5_0: "Les boutons en bas sont: ",
      text_6_0: "• Ajouter: un nouvel élément de tâche sera ajouté à la liste.",
      text_7_0: "• Masquer/afficher coché: les éléments à faire seront masqués/affichés s'ils sont cochés.",
      text_8_0: "• Supprimer tout: cela supprimera toutes les tâches à faire présentes dans la note.",
      text_9_0: "Vous pouvez le sauvegarder en revenant sur la page d'accueil.",
    },
    how_to_create_kanban_note: {
      title: "Comment puis-je créer une note Kanban?",
      text_1_0: "Vous pouvez créer une note Kanban en cliquant sur le bouton",
      text_1_1: "dans le coin inférieur droit de la page d'accueil et en sélectionnant 'Kanban'.",
      text_2_0: "Une nouvelle page apparaîtra avec une colonne déjà créée.",
      text_3_0: "• Pour ajouter une colonne: cliquez sur le bouton 'Ajouter une colonne' à droite (maximum 5 colonnes).",
      text_4_0: "• Pour renommer une colonne: modifiez le texte dans l'en-tête de la colonne.",
      text_5_0: "• Pour changer la couleur d'une colonne: cliquez sur le carré coloré dans l'en-tête.",
      text_6_0: "• Pour ajouter une carte: cliquez sur 'Ajouter une carte' en bas de la colonne.",
      text_7_0: "• Pour déplacer une carte: appuyez longuement sur la carte et faites-la glisser vers une autre colonne.",
      text_8_0: "• Pour supprimer une carte: cliquez sur l'icône de la corbeille sur la carte.",
      text_9_0: "• Pour supprimer une colonne: cliquez sur l'icône de la corbeille dans l'en-tête de la colonne.",
      text_10_0: "Vous pouvez sauvegarder la note en revenant sur la page d'accueil.",
    },
    how_to_edit_note: {
      title: "Comment puis-je modifier une note?",
      text_1_0: "Vous pouvez modifier une note en la sélectionnant dans la page d'accueil",
    },
    how_to_delete_note: {
      title: "Comment puis-je supprimer une note?",
      text_1_0: "Vous pouvez supprimer une note en cliquant",
      text_1_1: "dans le coin supérieur droit, lors de l'affichage d'une note.",
      text_2_0: "Cela ouvrira un menu contextuel. La première option est ce que vous recherchez.",
    },
    how_to_select_notes: {
      title: "Comment puis-je sélectionner des notes?",
      text_1_0: "Vous pouvez sélectionner des notes en appuyant longuement sur une note.",
      text_2_0:
        "Vous passerez en 'mode édition', et il est possible d'effectuer diverses actions comme les supprimer, les mettre comme importantes, en lecture seule ou verrouillées.",
    },
    what_toolbar_below: {
      title: "Quelle est la barre d'outils ci-dessous?",
      text_1_0: "La barre d'outils peut enrichir votre texte de nombreuses façons.",
      text_2_0: "• Image: vous pouvez mettre et couper une image de votre galerie.",
      text_3_0: "• Gras: vous pouvez mettre votre texte en gras.",
      text_4_0: "• Italique: vous pouvez mettre votre texte en italique.",
      text_5_0: "• Souligné: vous pouvez souligner votre texte.",
      text_6_0: "• Sous-ensemble: vous pouvez mettre votre texte en bas par rapport à votre texte.",
      text_7_0: "• Superset: vous pouvez placer votre texte en première position par rapport à votre texte.",
      text_8_0: "• Liste à puces: vous pouvez créer une liste à puces.",
      text_9_0: "• Liste triée: vous pouvez créer une liste triée.",
      text_10_0: "• Code: vous pouvez créer un wrapper dans lequel vous pouvez écrire du code formaté.",
    },
    what_are_settings_note: {
      title: "Quels sont les paramètres d'une note?",
      text_1_0: "Les paramètres des notes sont:",
      text_2_0: "• Supprimer: vous pouvez supprimer la note actuelle.",
      text_3_0: "• Important: vous pouvez définir votre note comme importante",
      text_4_0:
        "• Protéger: vous pouvez verrouiller votre note. Vous aurez besoin d'un code ou de votre empreinte digitale si elle est activée.",
      text_5_0: "• Lecture seule: votre note ne peut pas être modifiée.",
      text_6_0: "• Changer de catégorie: vous pouvez changer la catégorie d'une note à une autre.",
      text_7_0: "• Partager: vous pouvez partager le texte de votre note avec une autre application sociale.",
    },
    how_create_category: {
      title: "Comment puis-je créer une catégorie?",
      text_1_0: "Vous pouvez créer une nouvelle catégorie en cliquant",
      text_1_1: "dans le coin supérieur gauche de la page d'accueil.",
      text_2_0: "Vous serez redirigé vers la page 'Organiser'. Dans le coin inférieur droit, vous devez cliquer",
      text_2_1: "",
      text_3_0:
        "Une fois de plus, vous serez redirigé vers la page 'Créer une catégorie'. Il vous sera demandé de créer un nom et de sélectionner une icône unique.",
      text_4_0: "Après avoir compilé le formulaire, le",
      text_4_1: "apparaîtra dans le coin inférieur droit. Vous devez cliquer dessus pour enregistrer votre nouvelle catégorie.",
    },
    how_edit_category: {
      title: "Comment puis-je modifier une catégorie?",
      text_1_0: "Vous pouvez modifier une catégorie en cliquant",
      text_1_1: "dans le coin supérieur gauche de la page d'accueil.",
      text_2_0:
        "Vous serez redirigé vers la page 'Organiser'. Vous devez sélectionner une catégorie et vous serez à nouveau redirigé vers la page 'Mettre à jour la catégorie'.",
    },
    how_organize_categories: {
      title: "Comment puis-je organiser mes catégories?",
      text_1_0: "Vous pouvez modifier une catégorie en cliquant",
      text_1_1: "dans le coin supérieur gauche de la page d'accueil.",
      text_2_0: "Vous allez être redirigé vers la page 'Organiser'. Vous devez cliquer",
      text_2_1: "pour passer en 'mode organisation'",
      text_3_0:
        "Lorsque vous cliquez sur une catégorie, il sera 'non numéroté'. Vous pouvez cliquer sur une autre catégorie pour changer l'ordre des catégories.",
      text_4_0: "Lorsque vous avez terminé, vous pouvez cliquer sur",
      text_4_1: "les modifications.",
      text_5_0: "Si vous souhaitez annuler vos modifications, vous pouvez cliquer",
      text_5_1: "",
    },
    how_delete_category: {
      title: "Comment puis-je supprimer une catégorie?",
      text_1_0:
        "Lorsque vous êtes sur la page d'accueil, vous pouvez appuyer longuement sur une catégorie, et vous passez en 'mode édition'.",
      text_2_0: "Si vous cliquez sur",
      text_2_1:
        "une fenêtre contextuelle apparaîtra, vous demandant si vous souhaitez supprimer la catégorie avec vos notes, ou simplement les transférer vers TOUTES les notes.",
    },
    what_are_trashed_notes: {
      title: "Quelles sont les notes supprimées?",
      text_1_0:
        "Lors de la suppression d'une note, elle ira dans la corbeille. C'est une corbeille où toutes les notes vont temporairement.",
      text_2_0:
        "Par défaut, ils ne durent que 7 jours, puis ils disparaissent. Vous pouvez modifier ce paramètre dans les paramètres de base.",
    },
    how_restore_trashed_notes: {
      title: "Comment puis-je restaurer des notes supprimées?",
      text_1_0:
        "Lorsque vous êtes sur la page 'Notes supprimées', vous pouvez sélectionner une note et une fenêtre contextuelle apparaîtra vous demandant si vous souhaitez restaurer cette note.",
      text_2_0:
        "Vous pouvez restaurer plusieurs notes en appuyant longuement sur une note et en sélectionnant les notes souhaitées. Cliquez",
      text_2_1: "dans le coin supérieur droit.",
      text_3_0: "Une fenêtre contextuelle apparaîtra et la deuxième option correspond à ce que vous recherchez.",
      text_4_0: "Vous pouvez également restaurer toutes les notes présentes dans la corbeille en cliquant sur",
      text_4_1: "dans le coin supérieur droit.",
      text_5_0: "Une fenêtre contextuelle apparaîtra et la deuxième option correspond à ce que vous recherchez.",
    },
    how_restore_delete_notes: {
      title: "Comment puis-je restaurer des notes supprimées?",
      text_1_0:
        "Lorsque vous êtes dans la page 'Notes à la corbeille', vous pouvez appuyer longuement sur une note pour passer en 'mode édition' et sélectionner les notes que vous souhaitez supprimer.",
      text_2_0: "Cliquez sur",
      text_2_1: "dans le coin supérieur droit.",
      text_3_0: "Une fenêtre contextuelle apparaîtra et la première option correspond à ce que vous recherchez.",
      text_4_0: "Vous pouvez également supprimer toutes les notes présentes dans le bac, en cliquant",
      text_4_1: "dans le coin supérieur droit.",
      text_5_0: "Une fenêtre contextuelle apparaîtra et la deuxième option correspond à ce que vous recherchez.",
    },
    what_cloud_sync: {
      title: "Qu'est-ce que Cloud-Sync?",
      text_1_0:
        "Il est possible de synchroniser vos notes en connectant votre compte Google Firebase et en activant le mode de synchronisation.",
      text_2_0: "Vous n'avez rien d'autre à faire. Vos notes seront stockées dans votre Google Firebase, cryptées.",
    },
    what_secret_code: {
      title: "Qu'est-ce qu'un code secret?",
      text_1_0:
        "Vos notes verrouillées nécessiteront un code secret que vous avez généré lors de la première ouverture de l'application.",
      text_2_0: "Vous pouvez le modifier depuis les paramètres de base.",
    },
    what_import_export: {
      title: "Qu'est-ce que l'import/export de données?",
      text_1_0: "Vous pouvez importer ou exporter des données localement.",
      text_2_0: "En les exportant, un fichier sera généré dans le dossier dans lequel vous souhaitez enregistrer.",
      text_3_0: "Il sera crypté par défaut. Vous aurez besoin d'une phrase secrète pour l'importer.",
    },
    what_wipe_data: {
      title: "Qu'est-ce que l'effacement des données?",
      text_1_0: "Vous pouvez effacer toutes les notes et catégories.",
      text_2_0: "Une popup apparaîtra afin de vous demander si vous êtes sûr de cette action.",
      text_3_0: "Ils seront définitivement supprimés.",
    },
    what_ai_assistant: {
      title: "Qu'est-ce que l'Assistant IA?",
      text_1_0:
        "Fast Memo inclut un Assistant IA self-hosted qui fonctionne entierement sur votre appareil. Aucune donnee n'est envoyee a des serveurs externes.",
      text_2_0: "Pour le configurer, allez dans Parametres -> Assistant IA, choisissez un modele et telechargez-le.",
      text_3_0:
        "Une fois active, un bouton etoile apparait dans chaque editeur. Appuyez dessus pour acceder a des actions intelligentes comme: generer un titre, resumer, continuer a ecrire, formater le texte, suggerer des elements ou suggerer une categorie.",
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
