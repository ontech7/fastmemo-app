const fr = {
  language: "fr",

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

    description_2_3_0: `• Ajout de la langue japonaise.
• Mise à jour des webhooks à la version BETA 2.0.
• Corrections diverses.`,

    description_2_2_0: `• Ajout de la possibilité de masquer les notes.
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
    toggleProtectedNote: "Insérez votre code secret",
    toggleProtectedSelectedNotes: "Insérez votre code secret",
    toggleGeneric: "Insérez votre code secret",
    error: "Le code que vous avez entré ne correspond pas. Essayer à nouveau.",
  },
  firstMemo: {
    title: "Bienvenue sur FastMemo! 🔊",
  },
  home: {
    notes: "Notes",
    search: "Chercher quelque chose...",
  },
  note: {
    title_placeholder: "Titre",
    description_placeholder: "Écrivez quelque chose ici...",
    no_items: "Il n'y a aucun élément.\nAjoutez-en un en appuyant sur le bouton en bas à droite.",
    characters: "caractères",
    completed: "complété",
    on: "sur",
    settings: {
      delete: "Supprimer",
      important: "Important",
      protect: "Protéger",
      readonly: "Lecture seulement",
      hide: "Cacher",
      changecategory: "Changer de catégorie",
      share: "Partager",
    },
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
    export_popup_description:
      "Écrivez votre mot de passe secret ici. Pensez à le sauvegarder sinon vous ne pourrez pas récupérer vos notes.",
    import_popup_description: "Écrivez votre mot de passe secret ici pour importer vos notes.",
    webhooks: "Webhooks",
    wipe_data: "Effacer les données",
    about: "À propos",
    about_the_app: "À propos de l'application",
    about_the_developer: "À propos du développeur",
    check_updates: "Vérifier les mises à jour",
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

  /* toast */
  disconnected: "Vous avez été déconnecté du Cloud",
  loading: "Chargement...",
  dataSynced: "Données synchronisées",
  noInternetConnection: "Pas de connexion Internet",
  devicesLimitReached: "Limite de périphériques dépassée",
  noteLimitReached: "Limite de notes atteinte",

  empty_title: "(Pas de titre)",
};

export default fr;
