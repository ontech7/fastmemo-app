const es = {
  languageCode: "es",
  languageName: "Español",

  date: {
    mon: "Lun",
    tue: "Mar",
    wed: "Mié",
    thu: "Jue",
    fri: "Vie",
    sat: "Sáb",
    sun: "Dom",
  },
  changelog: {
    title: "¿Qué hay de nuevo?",

    web: {
      description_0_1_1: `• Corregida la sincronización en la nube al iniciar la aplicación.
• Las notas ahora se ordenan correctamente después de cada sincronización.`,

      description_0_1_0: `• Lanzamiento inicial de Fast Memo Desktop (BETA) con todas las funciones móviles.`,
    },

    mobile: {
      description_2_7_1: `• Corregida la sincronización en la nube al iniciar la aplicación.
• Las notas ahora se ordenan correctamente después de cada sincronización.`,

      description_2_7_0: `• Corregido el arrastrar y soltar de Kanban en móvil, tablet y escritorio.
• Alineada la aplicación entre móvil y escritorio.
• Lanzamiento oficial de la aplicación de escritorio.`,

      description_2_6_2: `• Se agregó nota de tipo Kanban.
• Rediseño de la Home al presionar “+”.
• El tipo de nota ahora es una insignia en la parte superior.
• Varias correcciones.`,

      description_2_5_3: `• Varias correcciones.`,

      description_2_5_2: `• Se agregó la posibilidad de reordenar las notas por fecha de creación y fecha de actualización.
• Se agregó la posibilidad de cambiar el idioma directamente desde la configuración.
• Rediseño de las modales.
• Varias correcciones.`,

      description_2_4_2: `• Revisada y mejorada la estructura interna de la app para hacerla más rápida y estable.
• Se ha añadido el reconocimiento de voz para la transcripción de notas (texto y listas).
• Añadida la posibilidad de realizar búsquedas profundas (texto y listas).
• Varias correcciones.`,

      description_2_3_0: `• Añadido el idioma japonés.
• Actualizados los webhooks a la versión BETA 2.0.
• Correcciones varias.`,

      description_2_2_1: `• Se ha añadido la capacidad de ocultar notas.
• Se ha añadido la capacidad de informar un problema en Configuración → Comentarios y Asistencia.
• Correcciones varias.`,

      description_2_1_0: `• Se agregó número de letras de notas y tamaño máximo de nota.
• Se agregó un número de elementos en la nota de tareas pendientes.
• Límite máximo agregado para dispositivos en la nube (3).
• Correcciones varias.`,

      description_2_0_0: `• Se agregó Cloud Sync con Google Firebase.
• Añadida gestión de Webhooks (para usuarios expertos).
• Se agregaron opciones de alineación izquierda y central para notas de texto.
• Código secreto agregado para algunas opciones.
• Tamaño modificado de todos los elementos.
• Se cambió el diseño de la pantalla de código secreto.
• Cambió el estilo de la nota To-Do.
• Correcciones varias.`,

      description_1_4_0: `• Se agregó una nota de tipo To-Do.
• Correcciones varias.`,

      description_1_3_0: `• Se agregaron traducciones para italiano, español, francés, alemán y chino.
• Se agregaron nuevos íconos para categorías.
• Correcciones varias.`,

      description_1_2_1: `• Liberación en producción.
• Notas añadidas, notas temporales, categorías, etc.
• Código secreto añadido.
• Correcciones varias.`,
    },
  },
  intro: {
    step1: "Agrega tus notas con un clic.",
    step2: "Mejora tu texto usando la barra de herramientas inferior.",
    step3: "Crea una lista de tareas pendientes para administrar tus tareas.",
    step4: "Crea tu propia categoría según tus necesidades.",
    step5: "Inserta un código secreto para ocultar tus notas.",
    step6: "Sincroniza tus notas en tu Google Firebase.",
    title: "¿Qué es Fast Memo?",
    continue: "Continúa",
  },
  setupcode: {
    title: "Código Secreto",
    firstCode_1: "Crea un código secreto para ocultar tus notas.",
    firstCode_2: "Podrá cambiar a la huella digital desde la configuración.",
    repeatCode: "Repite tu código secreto.",
    savedCode: "¡Tu código secreto ha sido guardado!",
    error: "El código ingresado no coincide. Intentar otra vez.",
  },
  secretcode: {
    title: "Código Secreto",
    oldCode: "Pon tu antiguo código secreto.",
    newCode: "Ahora pon tu nuevo código secreto.",
    repeatCode: "Repite tu nuevo código secreto.",
    savedCode: "¡Tu nuevo código secreto ha sido guardado!",
    unlockCode: "Inserta tu código secreto",
    error: "El código que ingresaste no coincide. Intentar otra vez.",
  },
  firstMemo: {
    title: "¡Bienvenido a FastMemo! 🔊",
  },
  home: {
    notes: "Notas",
    search: "Buscar algo...",
    deepSearch: "Búsqueda profunda (texto, listas…)",

    filters: {
      deepSearch: "Búsqueda profunda",
      orderBy: "Ordenar por:",
      createdAt: "Fecha de creación",
      updatedAt: "Fecha de actualización",
    },
  },
  note: {
    title_placeholder: "Título",
    description_placeholder: "Escribe algo aqui...",
    no_items: "No hay elementos.\nAgregue uno presionando el botón inferior derecho.",
    characters: "caracteres",
    completati: "terminado",
    on: "de",
    created: "Creado: ",
    updated: "Modificado: ",
    type: {
      todo: "Lista",
      kanban: "Kanban",
      text: "Texto",
    },
    settings: {
      delete: "Borrar",
      important: "Importante",
      protect: "Proteger",
      readonly: "Solo lectura",
      hide: "Esconder",
      changecategory: "Cambiar categoría",
      share: "Compartir",
    },
  },
  kanban: {
    add_column: "Agregar columna",
    add_card: "Agregar tarjeta",
    column_name_placeholder: "Nombre de columna",
    delete_column: "Eliminar columna",
    move_to: "Mover a",
    no_columns: "No hay columnas.\nAgregue una para comenzar.",
    no_cards: "Sin tarjetas",
    columns_count: "columnas",
    cards_count: "tarjetas",
  },
  changecategory: {
    title: "Cambiar Categoría",
  },
  cloudsync: {
    title: "Cloud Sync",
    syncing_1: "Sincronización en curso...",
    syncing_2: "Espera hasta que termine",
    enable: "Habilitar Cloud sync",
    save: "Guardar ajustes",
    edit: "Editar ajustes",
    resync: "Resincronizar datos",
    deleteDevices: "Administrar dispositivos",
    handshakeFailed: "Error en el intento de conexión",
    handshakeFailedDesc: "No se pudo conectar al servidor de Firebase.",
  },
  synceddevices: {
    title: "Dispositivos conectados",
    lastSync: "Última sinc.: ",
    error_fetching: "Error al obtener dispositivos",
  },
  createcategory: {
    title_create: "Crear Categoría",
    title_update: "Actualizar Categoría",
    name_title: "Nombre",
    name_placeholder: "Ingrese el nombre de la categoría aquí...",
    icon_title: "Icono",
    notes_num: "Nota: ",
  },
  organizecategory: {
    title: "Organizar",
  },
  trashednotes: {
    title: "Notas Desechadas",
    countdown: "Eliminar en: {{days}} días, {{hours}} horas e {{minutes}} minutos",
    settings: {
      delete_all: "Eliminar todos",
      restore_all: "Restaura todos",
      delete_selected: "Eliminar seleccionada",
      restore_selected: "Restaurar seleccionada",
    },
  },
  webhooks: {
    título: "Webhooks",
    addTextNote: "Agregar nota de texto",
    addTodoNote: "Agregar Nota Todo",
    addKanbanNote: "Agregar Nota Kanban",
    updateNote: "Nota de actualización",
    temporaryDeleteNote: "Nota de borrado temporal",
    deleteNote: "Borrar nota",
    restoreNote: "Restaurar nota",
    createCategory: "Crear Categoría",
    deleteCategory: "Borrar Categoría",
    updateCategory: "Actualizar Categoría",
    exportData: "Exportar datos",
    exporData: "Exportar datos",
    importData: "Importar datos",
    wipeData: "Borrar datos",
  },
  generalsettings: {
    title: "Ajustes",
    basic: "Básico",
    cloudsync: "Cloud Sync",
    temporary_trash_lifespan: "Duración temporal de la basura",
    days: "días",
    change_secret_code: "Cambia tu código secreto",
    enable_fingerprint: "Habilitar huella digital",
    advanced: "Avanzado",
    show_hidden: "Mostrar notas ocultas",
    export_import_data: "Exportar/Importar datos",
    export_import_popup_title: "Frase de contraseña secreta",
    export_import_placeholder_input: "Introduce el código secreto...",
    export_popup_description:
      "Escribe tu contraseña secreta aquí. Recuerda guardarlo, de lo contrario no podrás recuperar tus notas.",
    import_popup_description: "Escriba su contraseña secreta aquí para importar sus notas.",
    webhooks: "Webhooks",
    voice_recognition: "Reconocimiento de voz",
    ai_assistant: "Asistente IA",
    wipe_data: "Borrar información",
    about: "Acerca de",
    about_the_app: "Acerca de la aplicación",
    about_the_developer: "Sobre el desarrollador",
    check_updates: "Revisa actualizaciones",
    checking_updates: "Comprobando...",
    update_available: "Actualización disponible",
    update_confirm: "¿Quieres instalarlo ahora?",
    no_updates: "Estás usando la última versión.",
    feedback_and_help: "Comentarios y Ayuda",
    help: "Ayuda",
    changelog: "Registro de cambios",
    report: "Informar de un problema",
    suggest: "Recomendar a un amigo",
  },
  info: {
    title: "Información",
    fastmemo: "Fast Memo",
    app: "App",
    version: "Versión",
    libraries: "Bibliotecas",
  },
  aboutdeveloper: {
    title: "Acerca de mí",
    freelance: "Desarrollador web independiente",
    information: "Información",
    developer: "Desarrollador",
    website: "Sitio web",
  },
  ai: {
    title: "Asistente IA",
    model: "Modelo",
    status: "Estado",
    settings: "Configuracion",
    enabled: "Activado",
    downloaded: "Descargado",
    not_downloaded: "No descargado",
    downloading: "Descargando...",
    download_model: "Descargar modelo",
    cancel: "Cancelar",
    delete_model: "Eliminar modelo",
    info: "El asistente de IA funciona completamente en tu dispositivo. No se envian datos a servidores externos. El modelo debe descargarse una vez (~400 MB) y se almacenara localmente.",
    model_light: "Ligero y rapido. Recomendado para la mayoria de dispositivos.",
    model_powerful: "Mas preciso y capaz. Requiere mas almacenamiento y RAM.",
    model_advanced: "Mejor calidad. Para dispositivos con 8GB+ de RAM.",
    capabilities_title: "Que puedo hacer?",
    cap: {
      create_note: 'Crear nota de texto — "Crea una nota sobre..."',
      create_todo: 'Crear lista — "Haz una lista de compras con..."',
      create_kanban: 'Crear tablero kanban — "Crea un flujo de trabajo con..."',
      delete_note: 'Eliminar nota — "Elimina la nota Reunion"',
      toggle_property: 'Importante/Solo lectura/Oculta/Protegida — "Marca Reunion como importante"',
      change_category: 'Mover a categoria — "Mueve Reunion a Trabajo"',
      rename_note: 'Renombrar nota — "Renombra Reunion a Standup"',
      add_todo_items: 'Agregar elementos a lista — "Agrega leche a la lista de compras"',
      summarize_note: 'Resumir nota — "Resume la nota Reunion"',
      convert_note: 'Convertir tipo de nota — "Convierte Reunion en lista"',
      merge_notes: 'Fusionar notas — "Fusiona Reunion y Apuntes"',
      create_category: 'Crear categoria — "Crea una categoria Trabajo"',
      restore_note: 'Restaurar de papelera — "Restaura la nota Reunion"',
      switch_category: 'Cambiar categoria — "Ve a Trabajo" o "Muestra todas las notas"',
      change_setting: 'Cambiar configuracion — "Activa el reconocimiento de voz"',
    },
    unavailable_web: "El Asistente IA solo esta disponible en dispositivos moviles.",
    native_rebuild_needed: "El Asistente IA requiere una reconstruccion nativa.\nEjecuta: npx expo run:android",
    voice_only: "Solo voz",
    voice_only_hint: "Interactua con el asistente usando solo tu voz",
    listening: "Escuchando...",
    tap_to_speak: "Toca el microfono para hablar",
    sending_soon: "Enviando...",
    placeholder: "Que te gustaria hacer?",
    processing: "Pensando...",
    feedback: {
      note_created: 'Nota "{{title}}" creada',
      property_toggled: "{{count}} nota(s) actualizada(s)",
      note_deleted: "{{count}} nota(s) movida(s) a la papelera",
      category_changed: "{{count}} nota(s) movida(s)",
      done: "Hecho",
      note_renamed: 'Nota renombrada a "{{title}}"',
      items_added: "{{count}} elemento(s) agregado(s)",
      category_created: 'Categoria "{{name}}" creada',
      note_restored: "{{count}} nota(s) restaurada(s)",
      category_switched: 'Cambiado a "{{name}}"',
      no_notes_found: "No se encontraron notas",
      category_not_found: "Categoria no encontrada",
      not_todo_note: "Esa nota no es una lista",
      category_exists: "La categoria ya existe",
      note_converted: 'Nota "{{title}}" convertida',
      notes_merged: 'Notas fusionadas en "{{title}}"',
      setting_changed: "Configuracion actualizada",
      help_message:
        'Puedo crear notas, listas y tableros, eliminar, renombrar, convertir y fusionar notas, y mas.\nPrueba: "Haz una lista de compras con leche y pan"\nVe todas las funciones en Configuracion > Asistente IA.',
      same_type: "La nota ya es de ese tipo",
      not_understood: "Solo puedo ayudar con las notas",
      error: "Algo salio mal, intenta de nuevo",
      voice_unavailable: "Voz no disponible",
    },
  },
  voicerecognition: {
    title: "Reconocimiento de voz",
    enabled: "Activado",
    interimResults: "Transcripción en tiempo real",
    continuous: "Parada manual",
    language: "Idioma",
    language_default: "Predeterminado (sistema)",
  },
  help: {
    title: "Ayuda",
    how_to_create_note: {
      title: "¿Cómo puedo crear una nota?",
      text_1_0: "Puede crear una nota haciendo clic en el botón",
      text_1_1: "en la esquina inferior derecha de la página de inicio.",
      text_2_0: "Aparecerá una nueva página donde puede escribir un título y una descripción para su nota.",
      text_3_0: "Puede guardarlo volviendo a la página de inicio.",
    },
    how_to_create_todo_note: {
      title: "¿Cómo puedo crear una nota de tareas pendientes?",
      text_1_0: "Puedes crear una nota de Tarea haciendo clic en",
      text_1_1: "botón en la esquina inferior derecha de la página de inicio.",
      text_2_0:
        "Aparecerá una nueva página donde puedes escribir un título y una lista de textos de tareas pendientes en tu nota.",
      text_3_0: "Al presionar los 6 puntos a la derecha de un elemento, podrás moverlo hacia arriba y hacia abajo.",
      text_4_0: "El botón de cruz a la derecha eliminará ese elemento.",
      text_5_0: "Los botones en la parte inferior son: ",
      text_6_0: "• Agregar: se agregará una nueva tarea a la lista.",
      text_7_0: "• Ocultar/Mostrar marcados: ocultará/mostrará las tareas pendientes si están marcados.",
      text_8_0: "• Eliminar todo: eliminará todos los elementos pendientes presentes en la nota.",
      text_9_0: "Puedes guardarlo volviendo a la página de inicio.",
    },
    how_to_create_kanban_note: {
      title: "¿Cómo puedo crear una nota Kanban?",
      text_1_0: "Puedes crear una nota Kanban haciendo clic en el botón",
      text_1_1: "en la esquina inferior derecha de la página de inicio y seleccionando 'Kanban'.",
      text_2_0: "Aparecerá una nueva página con una columna ya creada.",
      text_3_0: "• Para agregar una columna: haz clic en el botón 'Agregar columna' a la derecha (máximo 5 columnas).",
      text_4_0: "• Para renombrar una columna: edita el texto en el encabezado de la columna.",
      text_5_0: "• Para cambiar el color de una columna: haz clic en el cuadrado de color en el encabezado.",
      text_6_0: "• Para agregar una tarjeta: haz clic en 'Agregar tarjeta' en la parte inferior de la columna.",
      text_7_0: "• Para mover una tarjeta: mantén presionada la tarjeta y arrástrala a otra columna.",
      text_8_0: "• Para eliminar una tarjeta: haz clic en el icono de la papelera en la tarjeta.",
      text_9_0: "• Para eliminar una columna: haz clic en el icono de la papelera en el encabezado de la columna.",
      text_10_0: "Puedes guardar la nota volviendo a la página de inicio.",
    },
    how_to_edit_note: {
      title: "¿Cómo puedo editar una nota?",
      text_1_0: "Puedes editar una nota seleccionándola en la página de inicio",
    },
    how_to_delete_note: {
      title: "¿Cómo puedo eliminar una nota?",
      text_1_0: "Puedes eliminar una nota haciendo clic",
      text_1_1: "en la esquina superior derecha, al ver una nota.",
      text_2_0: "Se abrirá un menú emergente. La primera opción es lo que estás buscando.",
    },
    how_to_select_notes: {
      title: "¿Cómo puedo seleccionar algunas notas?",
      text_1_0: "Puedes seleccionar notas manteniendo presionada una nota.",
      text_2_0:
        "Irás al 'modo de edición', y es posible realizar varias acciones como borrar, ponerlos como importantes, de solo lectura o bloqueados.",
    },
    what_toolbar_below: {
      title: "¿Qué es esa barra de herramientas debajo?",
      text_1_0: "La barra de herramientas puede enriquecer tu texto de muchas maneras.",
      text_2_0: "• Imagen: puedes poner y cortar una imagen de tu Galería.",
      text_3_0: "• Negrita: puedes poner tu texto en negrita.",
      text_4_0: "• Cursiva: puedes poner tu texto en cursiva.",
      text_5_0: "• Subrayado: puedes subrayar tu texto.",
      text_6_0: "• Subconjunto: puedes poner tu texto en una posición inferior en relación con tu texto.",
      text_7_0: "• Superconjunto: puedes poner tu texto en una posición superior en relación con tu texto.",
      text_8_0: "• Lista de viñetas: puedes crear una lista de viñetas.",
      text_9_0: "• Lista ordenada: puedes crear una lista ordenada.",
      text_10_0: "• Código: puedes crear un envoltorio donde puedes escribir código formateado.",
    },
    what_are_settings_note: {
      title: "¿Cuáles son los ajustes para una nota?",
      text_1_0: "La configuración de las notas es:",
      text_2_0: "• Eliminar: puedes eliminar la nota actual.",
      text_3_0: "• Importante: puedes configurar tu nota como importante",
      text_4_0: "• Proteger: puedes bloquear tu nota. Necesitarás un código o tu huella digital si está activado.",
      text_5_0: "• Solo lectura: tu nota no se puede modificar.",
      text_6_0: "• Cambiar categoría: puedes cambiar la categoría de una nota a otra.",
      text_7_0: "• Compartir: puede compartir el texto de su nota en otra aplicación social.",
    },
    how_create_category: {
      title: "¿Cómo puedo crear una categoría?",
      text_1_0: "Puedes crear una nueva categoría haciendo clic",
      text_1_1: "en la esquina superior izquierda de la página de inicio.",
      text_2_0: "Serás redirigido a la página 'Organizar'. En la esquina inferior derecha, debes hacer clic",
      texto_2_1: "",
      text_3_0:
        "Una vez más serás redirigido a la página 'Crear categoría'. Se te pedirá que crees un nombre y selecciones un ícono único.",
      text_4_0: "Después de compilar el formulario, el",
      text_4_1: "aparecerá en la esquina inferior derecha. Debes hacer clic en él para guardar tu nueva categoría.",
    },
    how_edit_category: {
      title: "¿Cómo puedo editar una categoría?",
      text_1_0: "Puedes editar una categoría haciendo clic",
      text_1_1: "en la esquina superior izquierda de la página de inicio.",
      text_2_0:
        "Serás redirigido a la página 'Organizar'. Debes seleccionar una categoría y serás redirigido una vez más a la página 'Actualizar categoría'.",
    },
    how_organize_categories: {
      title: "¿Cómo puedo organizar mis categorías?",
      text_1_0: "Puedes editar una categoría haciendo clic",
      text_1_1: "en la esquina superior izquierda de la página de inicio.",
      text_2_0: "Serás redirigido a la página 'Organizar'. Debes hacer clic",
      text_2_1: "para ir al 'modo organizar'",
      text_3_0:
        "Al hacer clic en una categoría, aparecerá 'no numerado'. Puedes hacer clic en otra categoría para cambiar el orden de las categorías.",
      text_4_0: "Cuando termines, puedes hacer clic en",
      text_4_1: "los cambios.",
      text_5_0: "Si desea deshacer los cambios, puede hacer clic en",
      texto_5_1: "",
    },
    how_delete_category: {
      title: "¿Cómo puedo eliminar una categoría?",
      text_1_0: "Cuando estás en la página de inicio, puedes mantener presionada una categoría y entrar en 'modo de edición'.",
      text_2_0: "Si haces clic en",
      text_2_1:
        "Aparecerá una ventana emergente que le preguntará si desea eliminar la categoría junto con sus notas o simplemente transferirlas a TODAS las notas.",
    },
    what_are_trashed_notes: {
      title: "¿Qué son las notas desechadas?",
      text_1_0: "Al eliminar una nota, irá a la papelera. Es un contenedor donde todas las notas van temporalmente.",
      text_2_0:
        "De manera predeterminada, durarán solo 7 días y luego desaparecerán. Puedes cambiar esta configuración desde la configuración básica.",
    },
    how_restore_trashed_notes: {
      title: "¿Cómo puedo restaurar las notas desechadas?",
      text_1_0:
        "Cuando estés en la página de 'Notas descartadas', puedes seleccionar una nota y aparecerá una ventana emergente preguntándote si deseas restaurar esa nota.",
      text_2_0:
        "Puede restaurar varias notas manteniendo presionada una nota y seleccionando las notas que desee. Haga clic en",
      text_2_1: "en la esquina superior derecha.",
      text_3_0: "Aparecerá una ventana emergente y la segunda opción es lo que estás buscando.",
      text_4_0: "También puedes restaurar todas las notas presentes en la papelera, haciendo clic en",
      text_4_1: "en la esquina superior derecha.",
      text_5_0: "Aparecerá una ventana emergente y la segunda opción es lo que estás buscando.",
    },
    how_restore_delete_notes: {
      title: "¿Cómo puedo restaurar las notas borradas?",
      text_1_0:
        "Cuando estés en la página de 'Notas descartadas', puedes mantener presionada una nota, accederás al 'modo de edición' y seleccionar las notas que deseas eliminar.",
      text_2_0: "Haz clic en",
      text_2_1: "en la esquina superior derecha.",
      text_3_0: "Aparecerá una ventana emergente y la primera opción es lo que estás buscando.",
      text_4_0: "También puedes eliminar todas las notas presentes en la papelera, haciendo clic en",
      text_4_1: "en la esquina superior derecha.",
      text_5_0: "Aparecerá una ventana emergente y la segunda opción es lo que estás buscando.",
    },
    what_cloud_sync: {
      title: "¿Qué es la sincronización en la nube?",
      text_1_0:
        "Es posible sincronizar tus notas conectando tu cuenta de Google Firebase y habilitando el modo de sincronización.",
      text_2_0: "No necesitas hacer nada más. Tus notas se almacenarán en tu Google Firebase, cifradas.",
    },
    what_secret_code: {
      title: "¿Qué es un código secreto?",
      text_1_0: "Tus notas bloqueadas requerirán un código secreto que generaste al abrir la aplicación por primera vez.",
      text_2_0: "Puedes cambiarlo desde la configuración básica.",
    },
    what_import_export: {
      title: "¿Qué son los datos de importación/exportación?",
      text_1_0: "Puedes importar o exportar datos localmente.",
      text_2_0: "Al exportarlos, se generará un archivo en la carpeta en la que deseas guardar.",
      text_3_0: "Se cifrará de forma predeterminada. Necesitarás una frase de contraseña para importarlo.",
    },
    what_wipe_data: {
      title: "¿Qué es Borrar datos?",
      text_1_0: "Puedes borrar todas las notas y categorías.",
      text_2_0: "Aparecerá una ventana emergente para preguntarte si estás seguro de esta acción.",
      text_3_0: "Se eliminarán de forma permanente.",
    },
  },
  report: {
    title: "Informar un Problema",
    question: "¿Cuál es el tema del problema?",
    topic: {
      crash: "Crash",
      notes: "Notas",
      categories: "Categorías",
      cloud: "Nube",
      webhooks: "Webhooks",
      export_import: "Exportar/Importar",
      translations: "Traducciones",
      suggestions: "Sugerencias",
      other: "Otro",
    },
    descriptionPlaceholder: "Por favor, describa el problema en detalle (obligatorio)",
    deviceInfoCheckbox: "Para un diagnóstico más preciso, por favor proporciónenos detalles del dispositivo.",
    attachments: "Añadir imágenes",
    sendReport: "Enviar Reporte",

    sent_message_1: "Gracias por enviar el informe.",
    sent_message_2: "Se puede enviar otro informe a partir del día:",

    attachments_limit: "Límite de adjuntos:",
    size_limit: "Límite de tamaño por imagen:",
    loading: "Cargando...",

    messages: {
      size: {
        title: "¡Archivo demasiado grande!",
        text: "Elija un archivo más pequeño o comprímalo.",
      },
      success: {
        title: "¡Éxito!",
        text: "El reporte ha sido enviado exitosamente.",
      },
      error: {
        title: "¡Error!",
        text: "No se pudo enviar el reporte.",
      },
      missing: {
        title: "¡Datos Faltantes!",
        text: "Por favor complete el tema y la descripción del problema.",
      },
    },
  },

  /* popup */
  popup: {
    delete_category: "¿Quieres eliminar esta categoría?\nPuedes MOVER notas a la categoría 'TODAS'",
    restore_single_note: "¿Quieres restaurar este Note?",
    restore_notes: "¿Quieres restaurar esas Notas?",
    delete_notes: "¿Quieres eliminar esas Notas?",
    delete_notes_perma: "¿Quieres eliminar esas notas de forma permanente?",
    restore_all_notes: "¿Quieres restaurar TODAS las notas?",
    delete_all_notes_perma: "¿Quieres eliminar TODAS las notas de forma permanente?",
    select_one_option: "Por favor selecciona una opcion",
    passphrase_wrong: "La contraseña que ingresaste es incorrecta.",
    are_you_sure_wipe: "¿Estás seguro de que quieres borrar tus datos?\nPerderás todas las notas y categorías creadas.",
    finish_organize_categories: "Finalice para organizar categorías o deshacer sus cambios.",
    generic_success_description: "La operación fue exitosa.",
  },

  /* generic */
  All: "Todo",
  delete_and_move: "Eliminar y Mover",
  delete_with_notes: "Eliminar con Notas",
  ok: "Ok",
  confirm: "Confirma",
  cancel: "Cancelar",
  delete: "Borrar",
  restore: "Restaurar",
  warning: "Advertencia",
  error: "Error",
  import: "Importar",
  export: "Exportar",
  retry: "Rever",
  wipe: "Borrar todo",
  wipeWithCloud: "Borrar + Cloud",
  loading: "Cargando...",

  /* toast */
  disconnected: "Te han desconectado de la nube",
  dataSynced: "Datos sincronizados",
  noInternetConnection: "Sin conexión a Internet",
  devicesLimitReached: "Límite de dispositivos excedido",
  noteLimitReached: "Límite de notas alcanzado",

  empty_title: "(Sin título)",
};

export default es;
