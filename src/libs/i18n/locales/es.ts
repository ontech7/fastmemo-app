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
      description_1_1_1: `• Agregadas las notas sin conexion: manten una nota solo en este dispositivo, sin sincronizarla en la nube.
• Reconocimiento de voz 2.0: dictado por voz mejorado con limpieza automatica mediante IA.
• El Asistente IA ahora puede sugerir una categoria a partir del titulo de la nota.
• Agregados deshacer/rehacer y tachado en el editor de texto.
• El desbloqueo en el escritorio ahora admite Touch ID y Windows Hello.
• Correcciones varias.`,

      description_1_0_0: `• Primera version estable de Fast Memo Desktop (fuera de BETA).
• Nuevo diseno moderno en toda la app, con la nueva fuente Geist, superficies glass y degradados.
• Rediseno del onboarding con nuevos pasos introductorios.
• Agregados ajustes de creacion de notas para personalizar los valores predeterminados.
• Agregado modo por pasos para las notas To-Do.
• Correcciones varias.`,

      description_0_3_0: `• Agregado nuevo tipo de nota: Codigo, con editor integrado, resaltado de sintaxis, pestanas multiples y deteccion automatica del lenguaje.
• Agregada funcion buscar y reemplazar en notas de texto.
• Agregada exportacion de notas.
• Correcciones varias.`,

      description_0_2_0: `• Posibilidad de mover columnas kanban.
• Animaciones mejoradas.
• Correcciones varias.`,

      description_0_1_1: `• Corregida la sincronización en la nube al iniciar la aplicación.
• Las notas ahora se ordenan correctamente después de cada sincronización.`,

      description_0_1_0: `• Lanzamiento inicial de Fast Memo Desktop (BETA) con todas las funciones móviles.`,
    },

    mobile: {
      description_3_1_1: `• Agregadas las notas sin conexion: manten una nota solo en este dispositivo, sin sincronizarla en la nube.
• Reconocimiento de voz 2.0: dictado por voz mejorado con limpieza automatica mediante IA.
• El Asistente IA ahora puede sugerir una categoria a partir del titulo de la nota.
• Agregados deshacer/rehacer y tachado en el editor de texto.
• Correcciones varias.`,

      description_3_0_0: `• Nuevo diseno moderno en toda la app, con la nueva fuente Geist, superficies glass y degradados.
• Rediseno del onboarding con nuevos pasos introductorios.
• Agregados ajustes de creacion de notas para personalizar los valores predeterminados.
• Agregado modo por pasos para las notas To-Do.
• Icono de la app y pantalla de inicio renovados.
• Correcciones varias.`,

      description_2_9_1: `• Agregado nuevo tipo de nota: Codigo, con editor integrado, resaltado de sintaxis, pestanas multiples y deteccion automatica del lenguaje.
• Agregado modelo Qwen 2.5 7B con deteccion de RAM del dispositivo. Nuevas acciones AI para codigo: Explicar codigo y Agregar comentarios.
• Agregada funcion buscar y reemplazar en notas de texto.
• Agregada exportacion de notas.
• Correcciones varias.`,

      description_2_8_0: `• Asistente IA self-hosted (Qwen 2.5) con funciones inteligentes para notas. Configuralo en Ajustes -> Asistente IA.
• Posibilidad de mover columnas kanban.
• Animaciones mejoradas.
• Correcciones varias.`,

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
    step4: "Visualiza tus ideas con tableros Kanban.",
    step5: "Toma nota de tus snippets.",
    step6: "Crea tu propia categoría según tus necesidades.",
    step7: "Inserta un código secreto para ocultar tus notas.",
    step8: "Sincroniza tus notas en Google Firebase.",
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
    selected_count: "{{count}} seleccionadas",

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
    mode_free: "Lista",
    mode_steps: "Pasos",
    ongoing: "En curso",
    created: "Creado: ",
    updated: "Modificado: ",
    type: {
      todo: "Lista",
      kanban: "Kanban",
      text: "Texto",
      code: "Codigo",
    },
    settings: {
      delete: "Borrar",
      important: "Importante",
      protect: "Proteger",
      readonly: "Solo lectura",
      hide: "Esconder",
      make_offline: "Hacer sin conexión",
      sync_to_cloud: "Sincronizar en la nube",
      made_offline: "La nota ahora está sin conexión",
      synced_as_duplicate: "Sincronizada en la nube como copia",
      changecategory: "Cambiar categoría",
      share: "Compartir",
      export: "Exportar",
      export_description: "Elige el formato de exportación",
      export_txt: "Texto plano (.txt)",
      info: "Información",
    },
    info: {
      title: "Información",
      type: "Tipo",
      category: "Categoría",
      created: "Creada",
      updated: "Actualizada",
      flags: "Indicadores",
      no_flags: "Ninguno",
      offline: "Sin conexión",
      close: "Cerrar",
    },
    find_replace: {
      search_placeholder: "Buscar...",
      replace_placeholder: "Reemplazar con...",
      replace_short: "Reemp.",
      replace_one: "Reemplazar",
      replace_all: "Todo",
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
  code: {
    add_tab: "Agregar pestaña",
    tab_title_placeholder: "Nombre del archivo",
    code_placeholder: "Escribe tu codigo aqui...",
    max_tabs_reached: "Maximo de 6 pestañas alcanzado",
    delete_tab: "Eliminar pestaña",
    delete_tab_confirm: "¿Seguro que quieres eliminar esta pestaña? No se puede deshacer.",
    language: "Lenguaje",
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
    upToDate: "Actualizado",
    pending: "{{count}} pendientes",
    mostRecent: "Más reciente",
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
    addCodeNote: "Agregar Nota de Codigo",
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
    fingerprint_reason: "Desbloquea tus notas",
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
    note_creation: "Creación de nota",
    wipe_data: "Borrar información",
    developer_options: "Opciones de desarrollador",
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
  note_creation: {
    title: "Creación de nota",
    mode_section: "Modo",
    default_type_section: "Tipo de nota predeterminado",
    mode: {
      simple: "Simple",
      simple_description: "Tocar crea una nota de texto. Usa el menú para otros tipos.",
      smart: "Smart",
      smart_description: "Tocar siempre crea el tipo que elijas abajo.",
      adaptive: "Adaptativa",
      adaptive_description: "Tocar crea el mismo tipo que tu última nota.",
    },
  },
  aboutdeveloper: {
    title: "Acerca de mí",
    freelance: "Desarrollador web independiente",
    information: "Información",
    developer: "Desarrollador",
    website: "Sitio web",
    openLink: "Abrir enlace",
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
    model_light: "Rapido, calidad basica. 3GB+ RAM requeridos.",
    model_powerful: "Buen equilibrio entre velocidad y calidad. 4GB+ RAM requeridos.",
    model_advanced: "Alta calidad. 6GB+ RAM requeridos.",
    model_pro: "Maxima calidad, rendimiento cercano a desktop. 8GB+ RAM requeridos.",
    model_unavailable: "RAM insuficiente en este dispositivo",
    capabilities_title: "Que puedo hacer?",
    cap: {
      generate_title: "Generar un titulo a partir del contenido",
      summarize: "Resumir una nota de texto en pocas frases",
      fix_grammar: "Corregir ortografía y gramática",
      shorten: "Hacer un texto más corto y conciso",
      translate: "Traducir una nota al idioma de la app",
      suggest_items: "Sugerir nuevos elementos para una lista",
      suggest_category: "Sugerir la mejor categoria para una nota",
      voice_cleanup: "Limpiar el texto dictado con puntuación",
      explain_code: "Explicar que hace el codigo",
      add_comments: "Agregar comentarios al codigo",
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
    editor: {
      generate_title: "Generar titulo",
      summarize: "Resumir",
      suggest_items: "Sugerir elementos",
      suggest_category: "Sugerir categoria",
      explain_code: "Explicar codigo",
      add_comments: "Agregar comentarios",
      fix_grammar: "Corregir gramática",
      shorten: "Acortar",
      translate: "Traducir",
      min_model: "Minimo",
      before: "Antes",
      after: "Después",
      apply: "Aplicar",
      no_content: "Escribe algo primero",
      no_category_match: "No se encontro una categoria",
      error: "No se pudo generar, intenta de nuevo",
    },
  },
  voicerecognition: {
    title: "Reconocimiento de voz",
    enabled: "Activado",
    interimResults: "Transcripción en tiempo real",
    continuous: "Parada manual",
    language: "Idioma",
    language_default: "Predeterminado (sistema)",
    dictation: {
      listening: "Escuchando…",
      paused: "En pausa",
      hint: 'Habla ahora. Di "coma", "punto", "interrogación" o "nueva línea" para puntuar.',
      insert: "Insertar",
      cancel: "Cancelar",
      ai_cleanup: "Mejorar con IA",
      processing: "Procesando…",
    },
  },
  help: {
    title: "Ayuda",
    search_placeholder: "¿Cómo podemos ayudarte?",
    no_results: "Sin resultados. Prueba con otra palabra.",
    search_placeholders: [
      "Busca o describe lo que necesitas…",
      "¿Cómo creo una nota?",
      "¿Para qué sirve la barra de herramientas?",
      "¿Cómo funciona la sincronización en la nube?",
      "¿Cómo recupero una nota eliminada?",
    ],
    ai_thinking: "Buscando con IA…",
    ai_results: "Resultados de IA · toca para borrar",
    ai_invite_title: "¿No encuentras lo que buscas?",
    ai_invite_subtitle: "Descríbelo con tus palabras y deja que el asistente de IA encuentre el tema adecuado.",
    cat_notes: "Notas",
    cat_editor: "Editor y formato",
    cat_categories: "Categorías",
    cat_trash: "Papelera",
    cat_cloud: "Sincronización en la nube y cifrado",
    cat_data: "Seguridad y datos",
    cat_settings: "Ajustes",
    cat_more: "Más e información",
    cat_ai: "Asistente de IA",
    how_to_create_note: {
      title: "¿Cómo creo una nota?",
      text_1_0: "Toca el botón",
      text_1_1: "en la esquina inferior derecha de la pantalla de inicio.",
      text_2_0: "Se abre una nueva página donde puedes añadir un título y escribir tu nota.",
      text_3_0: "Para guardarla, basta con volver a la pantalla de inicio.",
    },
    how_to_create_todo_note: {
      title: "¿Cómo creo una lista de tareas?",
      text_1_0: "Toca el botón",
      text_1_1: "en la esquina inferior derecha de la pantalla de inicio.",
      text_2_0: "Se abre una nueva página donde puedes añadir un título y los elementos de tu lista de tareas.",
      text_3_0: "Arrastra los seis puntos a la derecha de un elemento para moverlo hacia arriba o hacia abajo.",
      text_4_0: "Toca la cruz a la derecha para eliminar un elemento.",
      text_5_0: "Los botones de la parte inferior te permiten:",
      text_6_0: "• Añadir: agregar un nuevo elemento a la lista.",
      text_7_0:
        "• Cambiar modo: alterna entre Lista (una lista de tareas clásica) y Pasos (una lista numerada y secuencial que completas en orden).",
      text_8_0: "• Eliminar todo: quitar todos los elementos de la lista.",
      text_9_0: "Para guardarla, basta con volver a la pantalla de inicio.",
    },
    how_to_create_kanban_note: {
      title: "¿Cómo creo un tablero Kanban?",
      text_1_0: "Toca el botón",
      text_1_1: "en la esquina inferior derecha de la pantalla de inicio y elige 'Kanban'.",
      text_2_0: "Se abre un tablero con una columna lista para usar.",
      text_3_0: "• Añadir una columna: toca 'Añadir columna' a la derecha (hasta 10).",
      text_4_0: "• Renombrar una columna: edita el texto en su encabezado.",
      text_5_0: "• Cambiar el color de una columna: toca el cuadrado de color en su encabezado.",
      text_6_0: "• Añadir una tarjeta: toca 'Añadir tarjeta' en la parte inferior de una columna.",
      text_7_0: "• Mover una tarjeta: mantenla presionada y arrástrala a otra columna.",
      text_8_0: "• Eliminar una tarjeta: toca el icono de la papelera en la tarjeta.",
      text_9_0: "• Eliminar una columna: toca el icono de la papelera en su encabezado.",
      text_10_0: "Para guardar el tablero, basta con volver a la pantalla de inicio.",
    },
    how_to_create_code_note: {
      title: "¿Cómo creo una nota de código?",
      text_1_0: "Toca el botón",
      text_1_1: "en la esquina inferior derecha de la pantalla de inicio y elige 'Código'.",
      text_2_0: "Obtienes un editor de código real con resaltado de sintaxis.",
      text_3_0:
        "• Pestañas: mantén varios fragmentos en una sola nota; añádelos, renómbralos, elimínalos o arrástralos para reordenarlos (hasta 6).",
      text_4_0: "• Lenguaje: toca la barra de lenguaje para elegir uno, o deja que se detecte automáticamente.",
      text_5_0: "• Buscar y reemplazar: toca el icono de búsqueda en la parte superior, igual que en una nota de texto.",
      text_6_0: "Para guardarla, basta con volver a la pantalla de inicio.",
    },
    how_to_edit_note: {
      title: "¿Cómo edito una nota?",
      text_1_0: "Solo toca la nota en la pantalla de inicio para abrirla y hacer tus cambios.",
    },
    how_to_delete_note: {
      title: "¿Cómo elimino una nota?",
      text_1_0: "Mientras ves una nota, toca",
      text_1_1: "en la esquina superior derecha.",
      text_2_0: "Se abre un menú; 'Eliminar' es la primera opción.",
    },
    how_to_select_notes: {
      title: "¿Cómo selecciono varias notas a la vez?",
      text_1_0: "Mantén presionada cualquier nota para empezar a seleccionar.",
      text_2_0:
        "Esto activa el modo de selección, donde puedes actuar sobre varias notas a la vez: eliminarlas, o marcarlas como importantes, de solo lectura o bloqueadas.",
    },
    what_are_hidden_notes: {
      title: "¿Cómo funcionan las notas ocultas?",
      text_1_0: "Abre el menú de opciones de una nota y toca 'Ocultar' para que no aparezca en la pantalla de inicio.",
      text_2_0:
        "Para volver a ver las notas ocultas, activa 'Mostrar notas ocultas' en los ajustes avanzados; necesitarás tu código secreto para hacerlo.",
    },
    what_toolbar_below: {
      title: "¿Qué es la barra de herramientas de abajo?",
      text_1_0: "Te permite dar formato y enriquecer tu texto. Esto es lo que hacen los botones:",
      text_2_0: "• Deshacer / Rehacer: retrocede o avanza por tus últimos cambios.",
      text_3_0: "• Imagen: inserta una imagen desde tu galería.",
      text_4_0: "• Negrita: pon en negrita el texto seleccionado.",
      text_5_0: "• Cursiva: pon en cursiva el texto seleccionado.",
      text_6_0: "• Tachado: tacha el texto seleccionado.",
      text_7_0: "• Subrayado: subraya el texto seleccionado.",
      text_8_0: "• Subíndice: baja el texto ligeramente por debajo de la línea.",
      text_9_0: "• Superíndice: sube el texto ligeramente por encima de la línea.",
      text_10_0: "• Lista de viñetas: inicia una lista con viñetas.",
      text_11_0: "• Lista numerada: inicia una lista numerada.",
      text_12_0: "• Código: envuelve el texto en un bloque de código con formato.",
    },
    what_find_replace: {
      title: "¿Cómo busco y reemplazo texto?",
      text_1_0: "Mientras editas una nota de texto o de código, toca el icono de búsqueda en la esquina superior derecha.",
      text_2_0: "Escribe lo que buscas: las flechas saltan entre las coincidencias y muestran cuántas hay.",
      text_3_0: "Activa 'Reemplazar' para cambiar la coincidencia actual, o reemplaza todas las coincidencias a la vez.",
    },
    what_are_settings_note: {
      title: "¿Cuáles son las opciones de una nota?",
      text_1_0: "Abre una nota y toca el menú ⋮ en la esquina superior derecha. Desde ahí puedes:",
      text_2_0: "• Eliminar: mueve la nota a la papelera.",
      text_3_0: "• Importante: marca la nota para que destaque arriba.",
      text_4_0: "• Proteger: bloquea la nota tras tu código secreto o huella digital.",
      text_5_0: "• Solo lectura: evita que la nota se edite por accidente.",
      text_6_0: "• Ocultar: mantén la nota fuera de la pantalla de inicio hasta que decidas mostrar las notas ocultas.",
      text_7_0: "• Hacer sin conexión: mantén la nota solo en este dispositivo, sin sincronizarla nunca con la nube.",
      text_8_0: "• Cambiar categoría: mueve la nota a otra categoría.",
      text_9_0: "• Exportar (notas de texto): guarda la nota como archivo .txt, Markdown o PDF.",
      text_10_0: "• Información: consulta el tipo, la categoría y las fechas de la nota.",
    },
    how_create_category: {
      title: "¿Cómo creo una categoría?",
      text_1_0: "En la pantalla de inicio, toca",
      text_1_1: "en la esquina superior izquierda.",
      text_2_0: "Esto abre la página 'Organizar'. Allí, toca",
      text_2_1: "en la esquina inferior derecha.",
      text_3_0: "En la página 'Crear categoría', dale un nombre y elige un icono que no esté ya en uso.",
      text_4_0: "Cuando termines, toca",
      text_4_1: "en la esquina inferior derecha para guardarla.",
    },
    how_edit_category: {
      title: "¿Cómo edito una categoría?",
      text_1_0: "En la pantalla de inicio, toca",
      text_1_1: "en la esquina superior izquierda.",
      text_2_0:
        "En la página 'Organizar', toca la categoría que quieras cambiar; se abre su página de edición, donde puedes renombrarla o elegir un nuevo icono.",
    },
    how_organize_categories: {
      title: "¿Cómo reordeno mis categorías?",
      text_1_0: "En la pantalla de inicio, toca",
      text_1_1: "en la esquina superior izquierda.",
      text_2_0: "En la página 'Organizar', toca",
      text_2_1: "para entrar en el modo organizar.",
      text_3_0: "Toca una categoría para tomarla, luego toca otra para soltarla ahí y cambiar el orden.",
      text_4_0: "Cuando estés satisfecho con el orden, toca",
      text_4_1: "para guardarlo.",
      text_5_0: "Para descartar tus cambios, toca",
      text_5_1: "en la esquina superior derecha.",
    },
    how_delete_category: {
      title: "¿Cómo elimino una categoría?",
      text_1_0: "En la pantalla de inicio, mantén presionada una categoría para entrar en el modo de selección.",
      text_2_0: "Luego toca",
      text_2_1: "y elige si quieres eliminar la categoría junto con sus notas, o conservar las notas moviéndolas a 'Todas'.",
    },
    what_are_trashed_notes: {
      title: "¿Qué es la papelera?",
      text_1_0: "Cuando eliminas una nota no desaparece de inmediato: primero va a la papelera.",
      text_2_0:
        "Las notas permanecen ahí 7 días y luego se eliminan definitivamente. Puedes cambiar cuánto tiempo se conservan en los ajustes básicos.",
    },
    how_restore_trashed_notes: {
      title: "¿Cómo restauro notas eliminadas?",
      text_1_0: "Abre la página 'Papelera' y toca una nota; se te preguntará si quieres restaurarla.",
      text_2_0: "Para restaurar varias a la vez, mantén presionada una nota, selecciona las que quieras y luego toca",
      text_2_1: "en la esquina superior derecha.",
      text_3_0: "En el menú que aparece, elige 'Restaurar'.",
      text_4_0: "Para recuperarlo todo a la vez, toca",
      text_4_1: "en la esquina superior derecha.",
      text_5_0: "En el menú que aparece, elige 'Restaurar todo'.",
    },
    how_restore_delete_notes: {
      title: "¿Cómo elimino notas de la papelera de forma permanente?",
      text_1_0:
        "Abre la página 'Papelera', mantén presionada una nota para entrar en el modo de selección y luego elige las que quieras quitar.",
      text_2_0: "Toca",
      text_2_1: "en la esquina superior derecha.",
      text_3_0: "En el menú que aparece, elige 'Eliminar'.",
      text_4_0: "Para vaciar toda la papelera a la vez, toca",
      text_4_1: "en la esquina superior derecha.",
      text_5_0: "En el menú que aparece, elige 'Eliminar todo'.",
    },
    what_cloud_sync: {
      title: "¿Qué es la sincronización en la nube?",
      text_1_0:
        "Puedes sincronizar tus notas entre dispositivos conectando tu propio proyecto de Google Firebase y activando la sincronización. No hay un servidor central de Fast Memo: tus datos viven solo en tu Firebase.",
      text_2_0:
        "Tus notas se cifran de extremo a extremo en tu dispositivo antes de subirse, así nadie más que tú puede leerlas.",
      text_link: "Lee la guía paso a paso para configurar Google Firebase →",
    },
    what_encryption: {
      title: "¿Cómo se cifran mis notas?",
      text_1_0:
        "La sincronización en la nube usa cifrado de extremo a extremo. La primera vez que la configuras eliges una contraseña de cifrado, y tu dispositivo deriva de ella la clave que protege tus notas.",
      text_2_0:
        "La clave nunca sale de tu dispositivo y nunca se guarda en la nube, así que ni siquiera alguien con acceso a tu Firebase puede leer el contenido de tus notas sin tu contraseña.",
      text_3_0:
        "Se cifra el contenido de las notas; los títulos y las fechas permanecen legibles para que la app pueda ordenarlas y sincronizarlas.",
    },
    how_unlock_device: {
      title: "¿Por qué tengo que desbloquear en cada dispositivo?",
      text_1_0:
        "Cada dispositivo desbloquea el cifrado una vez introduciendo tu contraseña. Después, la clave se almacena de forma segura en el dispositivo (Keychain / Keystore), así no tienes que volver a introducirla en cada inicio.",
      text_2_0:
        "Si un dispositivo permanece bloqueado, la sincronización se pausa en él hasta que lo desbloquees, evitando que tus notas se guarden de forma ilegible.",
    },
    forgot_password: {
      title: "Olvidé mi contraseña de cifrado",
      text_1_0:
        "Cuando configuras el cifrado se te muestra una clave de recuperación una sola vez. Guárdala en un lugar seguro.",
      text_2_0:
        "En la pantalla de desbloqueo elige 'Olvidé la contraseña', introduce tu clave de recuperación y establece una nueva contraseña. No se pierde ninguna nota.",
      text_3_0:
        "Si pierdes tanto la contraseña como la clave de recuperación, nadie puede descifrar tus notas en la nube: ese es el sentido del cifrado de extremo a extremo.",
    },
    reset_encryption: {
      title: "¿Qué hace restablecer el cifrado?",
      text_1_0:
        "Restablecer es el último recurso, para cuando se han perdido tanto la contraseña como la clave de recuperación.",
      text_2_0:
        "Crea una configuración de cifrado nueva a partir de las notas que hay actualmente en este dispositivo y reemplaza la copia de la nube. Las notas antiguas de la nube que ya no se pueden descifrar se eliminan.",
      text_3_0:
        "Tus notas locales se conservan y se vuelven a subir, así que este dispositivo no pierde nada, pero tus otros dispositivos tendrán que desbloquear de nuevo con la nueva contraseña.",
    },
    quick_backup: {
      title: "¿Qué es la copia de seguridad rápida?",
      text_1_0:
        "En las pantallas de configuración, desbloqueo y restablecimiento del cifrado encontrarás un botón opcional de 'Copia de seguridad rápida'.",
      text_2_0:
        "Exporta un archivo de tus notas protegido con una frase de contraseña directamente desde este dispositivo, independiente de la nube: una red de seguridad antes de una sincronización importante o un restablecimiento. Tus notas siempre permanecen en este dispositivo de todos modos.",
    },
    what_secret_code: {
      title: "¿Qué es el código secreto?",
      text_1_0:
        "Es el código que estableciste la primera vez que abriste la app, y lo necesitarás para abrir cualquier nota que hayas bloqueado.",
      text_2_0: "Puedes cambiarlo en cualquier momento desde los ajustes básicos.",
    },
    what_import_export: {
      title: "¿Qué son importar y exportar?",
      text_1_0: "Te permiten guardar una copia de tus datos, o recuperarla, aquí mismo en tu dispositivo.",
      text_2_0: "Cuando exportas, se guarda un archivo en la carpeta que elijas.",
      text_3_0:
        "El archivo siempre está cifrado: necesitarás la frase de contraseña que estableciste para volver a importarlo.",
    },
    how_export_note: {
      title: "¿Cómo exporto una sola nota?",
      text_1_0: "Abre una nota de texto, toca el menú de opciones y elige 'Exportar'.",
      text_2_0: "Luego elige el formato que quieras:",
      text_3_0: "• Texto sin formato (.txt): solo el texto, sin formato.",
      text_4_0: "• Markdown (.md): conserva los encabezados y el formato básico.",
      text_5_0: "• PDF: un documento ordenado, listo para compartir.",
      text_6_0: "El archivo se comparte a través de tu dispositivo, así que puedes guardarlo o enviarlo donde quieras.",
    },
    what_wipe_data: {
      title: "¿Qué hace borrar los datos?",
      text_1_0: "Elimina todas tus notas y categorías de este dispositivo de una sola vez.",
      text_2_0: "Primero se te pedirá confirmar, ya que esto no se puede deshacer.",
      text_3_0: "Una vez confirmado, todo se elimina de forma permanente.",
    },
    what_note_creation: {
      title: "¿Qué hace el ajuste de creación de notas?",
      text_1_0:
        "Decide qué ocurre cuando tocas el botón [+] en la pantalla de inicio. En Ajustes → Creación de notas puedes elegir:",
      text_2_0: "• Simple: [+] crea una nota de texto; usa el menú para los demás tipos.",
      text_3_0: "• Inteligente: [+] siempre crea el tipo que elegiste como favorito.",
      text_4_0: "• Adaptativo: [+] crea el mismo tipo que la última nota en la que trabajaste.",
    },
    what_home_filters: {
      title: "¿Cómo funcionan los filtros de la pantalla de inicio?",
      text_1_0:
        "Toca el icono de filtro en la parte superior de la pantalla de inicio para cambiar cómo se muestran tus notas.",
      text_2_0: "• Ordenar por: ordena por fecha de creación o última actualización, de forma ascendente o descendente.",
      text_3_0:
        "• Búsqueda profunda: busca también dentro del contenido de las notas y las listas, no solo en los títulos (pide tu código secreto primero).",
    },
    what_language: {
      title: "¿Cómo cambio el idioma?",
      text_1_0: "Abre los ajustes básicos y toca 'Idioma' para cambiarlo.",
      text_2_0:
        "Puedes seguir automáticamente el idioma de tu dispositivo, o elegir uno de los siete disponibles: inglés, italiano, español, francés, alemán, chino y japonés.",
    },
    what_version_check: {
      title: "¿La app busca actualizaciones?",
      text_1_0: "Sí: cuando abres Fast Memo comprueba discretamente si hay una versión más reciente disponible.",
      text_2_0:
        "Cuando hay una actualización, una pantalla '¿Qué hay de nuevo?' muestra lo que cambió. También puedes comprobarlo en cualquier momento desde los ajustes.",
    },
    what_report_problem: {
      title: "¿Cómo informo de un problema?",
      text_1_0: "Ve a Ajustes → Informar de un problema.",
      text_2_0:
        "Elige un tema, describe lo que pasó y, opcionalmente, adjunta algunas capturas de pantalla y la información de tu dispositivo para ayudarnos a investigarlo.",
      text_3_0: "Puedes enviar un informe al día.",
    },
    what_webhooks: {
      title: "¿Qué son los webhooks?",
      text_1_0:
        "Los webhooks son para usuarios avanzados: permiten que Fast Memo notifique a otro servicio cada vez que ocurre algo: una nota creada, actualizada o eliminada, una categoría cambiada, datos exportados, etc.",
      text_2_0: "Cada acción puede llamar a una dirección web de tu elección. Los configuras en Ajustes → Webhooks.",
    },
    what_platforms: {
      title: "¿Dónde puedo usar Fast Memo?",
      text_1_0: "Fast Memo funciona tanto en móvil como en escritorio (Windows, macOS y Linux), además de una versión web.",
      text_2_0:
        "Conecta el mismo proyecto de Google Firebase en cada dispositivo y tus notas se mantienen sincronizadas en todas partes.",
    },
    what_ai_assistant: {
      title: "¿Qué es el Asistente de IA?",
      text_1_0:
        "Fast Memo incluye un Asistente de IA autoalojado que se ejecuta enteramente en tu dispositivo. No se envía ningún dato a servidores externos.",
      text_2_0: "Para configurarlo, ve a Ajustes -> Asistente de IA, elige un modelo y descárgalo.",
      text_3_0:
        "Una vez activado, aparece un botón con un destello dentro de cada editor de notas. Tócalo para acceder a acciones inteligentes como: generar un título, resumir, continuar escribiendo, dar formato al texto, sugerir elementos de lista o sugerir una categoría.",
      text_4_0: "La IA funciona sin conexión y admite varios idiomas.",
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

  developeroptions: {
    title: "Opciones de desarrollador",
    warning:
      "Estas opciones pueden comprometer la sincronización en la nube de notas específicas o afectar el rendimiento de la app.",
    unlimited_text_space: "Espacio de texto ilimitado",
    unlimited_text_space_desc: "Límite actual: 1 MB",
    unlimited_kanban_columns: "Columnas Kanban ilimitadas",
    unlimited_kanban_columns_desc: "Límite actual: 10 columnas",
    unlimited_trash_time: "Tiempo de papelera ilimitado",
    unlimited_trash_time_desc: "Límite actual: 30 días",
    change_app_icon: "Cambiar icono de la app",
    change_app_icon_desc: "Próximamente",
  },

  /* toast */
  disconnected: "Te han desconectado de la nube",
  dataSynced: "Datos sincronizados",
  noInternetConnection: "Sin conexión a Internet",
  devicesLimitReached: "Límite de dispositivos excedido",
  noteLimitReached: "Límite de notas alcanzado",
  developerModeActivated: "Modo desarrollador activado!",
  developerModeAlready: "El modo desarrollador ya está activo",
  developerModeTaps: "{{remaining}} toque(s) para activar el modo desarrollador",

  empty_title: "(Sin título)",
};

export default es;
