const zh = {
  languageCode: "zh",
  languageName: "普通话",

  date: {
    mon: "周一",
    tue: "周二",
    wed: "周三",
    thu: "周四",
    fri: "星期五",
    sat: "周六",
    sun: "星期日",
  },
  changelog: {
    title: "什么是新的？",

    web: {
      description_1_1_1: `• 新增离线笔记：仅将笔记保存在本设备，不同步到云端。
• 语音识别 2.0：改进语音听写，支持 AI 自动整理文本。
• AI 助手现在可以根据笔记标题推荐分类。
• 文本编辑器新增撤销/重做和删除线。
• 桌面端解锁现已支持 Touch ID 和 Windows Hello。
• 其他修复。`,

      description_1_0_0: `• Fast Memo Desktop 首个稳定版本（已结束 BETA）。
• 全新现代化设计，全应用焕新，采用全新 Geist 字体、玻璃质感界面和渐变效果。
• 重新设计的引导流程，新增介绍步骤。
• 新增笔记创建设置，可自定义新笔记的默认选项。
• 为 To-Do 笔记新增分步模式。
• 其他修复。`,

      description_0_3_0: `• 新增代码笔记类型，内置代码编辑器，支持语法高亮、多标签页和语言自动检测。
• 文本笔记新增查找和替换功能。
• 新增笔记导出功能。
• 其他修复。`,

      description_0_2_0: `• 看板列现在可以移动了。
• 改进了动画效果。
• 各种修复。`,

      description_0_1_1: `• 修复了应用启动时的云同步问题。
• 每次同步后，笔记现在都会正确排序。`,

      description_0_1_0: `• Fast Memo Desktop 的第一个版本（BETA），具有所有移动功能。`,
    },

    mobile: {
      description_3_1_1: `• 新增离线笔记：仅将笔记保存在本设备，不同步到云端。
• 语音识别 2.0：改进语音听写，支持 AI 自动整理文本。
• AI 助手现在可以根据笔记标题推荐分类。
• 文本编辑器新增撤销/重做和删除线。
• 其他修复。`,

      description_3_0_0: `• 全新现代化设计，全应用焕新，采用全新 Geist 字体、玻璃质感界面和渐变效果。
• 重新设计的引导流程，新增介绍步骤。
• 新增笔记创建设置，可自定义新笔记的默认选项。
• 为 To-Do 笔记新增分步模式。
• 焕新应用图标和启动画面。
• 其他修复。`,

      description_2_9_1: `• 新增代码笔记类型，内置代码编辑器，支持语法高亮、多标签页和语言自动检测。
• 新增Qwen 2.5 7B模型，支持设备RAM检测。代码新AI功能：解释代码和添加注释。
• 文本笔记新增查找和替换功能。
• 新增笔记导出功能。
• 其他修复。`,

      description_2_8_0: `• 新增自托管AI助手（Qwen 2.5），为笔记提供智能功能。请在设置 -> AI助手中配置。
• 看板列现在可以移动了。
• 改进了动画效果。
• 各种修复。`,

      description_2_7_1: `• 修复了应用启动时的云同步问题。
• 每次同步后，笔记现在都会正确排序。`,

      description_2_7_0: `• 修复了在移动端、平板和桌面端的看板拖放功能。
• 对移动端和桌面端应用进行了统一。
• 桌面应用正式发布。`,

      description_2_6_2: `• 新增看板类型笔记。
• 重新设计主页在点击“+”时的界面。
• 笔记类型现在以顶部徽章显示。
• 各种修复。`,

      description_2_5_3: `• 各种修复。`,

      description_2_5_2: `• 新增按创建日期和更新日期重新排序笔记的功能。
• 新增直接从设置更改语言的功能。
• 重新设计了模态框。
• 各种修复。`,

      description_2_4_2: `• 优化并改进了应用的内部结构，使其更快更稳定。
• 添加了语音识别功能，用于转录笔记（文本和列表）。
• 新增深度搜索功能（文本和列表）。
• 各种修复。`,

      description_2_3_0: `• 添加了日语。
• 将Webhooks更新到BETA 2.0版本。
• 各种修复。`,

      description_2_2_1: `• 添加了隐藏笔记的功能。
• 添加了在设置 → 反馈和帮助中报告问题的功能。
• 其他修复。`,

      description_2_1_0: `• 添加了注释字母的数量和最大注释尺寸。
• 添加了待办事项注释中的项目数量。
• 添加了云设备的最大限制(3)。
• 其他修复。`,

      description_2_0_0: `• 添加了与Google Firebase 的云同步。
• 添加了Webhooks 管理（针对专家用户）。
• 添加了文本注释的左对齐和居中对齐选项。
• 更改了所有元素的大小。
• 为某些选项添加密码。
• 更改密码屏幕的设计。
• 更改了待办事项注释的样式。
• 其他修复。`,

      description_1_4_0: `• 添加了待办事项类型注释。
• 其他修复。`,

      description_1_3_0: `• 添加了意大利语、西班牙语、法语、德语和中文的翻译。
• 为类别添加了新图标。
• 其他修复。`,

      description_1_2_1: `• 在生产中发布。
• 添加注释、临时注释、类别等。
• 添加密码。
• 其他修复。`,
    },
  },
  intro: {
    step1: "一键添加笔记。",
    step2: "使用底部工具栏丰富您的文本。",
    step3: "创建待办事项列表来管理您的任务。",
    step4: "使用看板视图可视化您的想法。",
    step5: "记录您的代码片段。",
    step6: "根据您的需要创建您自己的类别。",
    step7: "输入密码来隐藏你的笔记。",
    step8: "在您的 Google Firebase 上同步您的笔记。",
    title: "什么是 Fast Memo?",
    continue: "继续",
  },
  setupcode: {
    title: "密码",
    firstCode_1: "创建密码以隐藏您的笔记。",
    firstCode_2: "您将能够从设置切换到指纹。",
    repeatCode: "重复你的密码。",
    savedCode: "您的密码已保存！",
    error: "输入的代码不匹配。再试一次。",
  },
  secretcode: {
    title: "密码",
    oldCode: "输入您的旧密码。",
    newCode: "现在输入您的新密码。",
    repeatCode: "重复您的新密码。",
    savedCode: "您的新密码已保存！",
    unlockCode: "插入您的密码",
    error: "您输入的代码不匹配。再试一次。",
  },
  firstMemo: {
    title: "欢迎使用 FastMemo! 🔊",
  },
  home: {
    notes: "笔记",
    search: "写一些东西...",
    deepSearch: "深度搜索（文本、列表等）",
    selected_count: "已选 {{count}}",

    filters: {
      deepSearch: "深度搜索",
      orderBy: "排序方式:",
      createdAt: "创建日期",
      updatedAt: "更新日期",
    },
  },
  note: {
    title_placeholder: "标题",
    description_placeholder: "在这里写点东西...",
    no_items: "没有项目。\n按右下角的按钮添加一个。",
    characters: "文本字符",
    completed: "完全的",
    on: "上に",
    mode_free: "列表",
    mode_steps: "步骤",
    ongoing: "进行中",
    created: "创建: ",
    updated: "修改: ",
    type: {
      todo: "列表",
      kanban: "看板",
      text: "文本",
      code: "代码",
    },
    settings: {
      delete: "删除",
      important: "重要的",
      protect: "保护",
      readonly: "只读",
      hide: "隐藏",
      make_offline: "设为离线",
      sync_to_cloud: "同步到云端",
      made_offline: "笔记现已离线",
      synced_as_duplicate: "已作为副本同步到云端",
      changecategory: "更改类别",
      share: "分享",
      export: "导出",
      export_description: "选择导出格式",
      export_txt: "纯文本 (.txt)",
      info: "信息",
    },
    info: {
      title: "信息",
      type: "类型",
      category: "类别",
      created: "创建时间",
      updated: "更新时间",
      flags: "标记",
      no_flags: "无",
      offline: "离线",
      close: "关闭",
    },
    find_replace: {
      search_placeholder: "搜索...",
      replace_placeholder: "替换为...",
      replace_short: "替换",
      replace_one: "替换",
      replace_all: "全部",
    },
  },
  kanban: {
    add_column: "添加列",
    add_card: "添加卡片",
    column_name_placeholder: "列名",
    delete_column: "删除列",
    move_to: "移动到",
    no_columns: "没有列。\n添加一个以开始。",
    no_cards: "没有卡片",
    columns_count: "列",
    cards_count: "卡片",
  },
  code: {
    add_tab: "添加标签",
    tab_title_placeholder: "文件名",
    code_placeholder: "在此输入代码...",
    max_tabs_reached: "最多6个标签",
    delete_tab: "删除标签",
    delete_tab_confirm: "确定要删除此标签吗？此操作无法撤销。",
    language: "语言",
  },
  changecategory: {
    title: "更改类别",
  },
  cloudsync: {
    title: "云同步",
    syncing_1: "同步进行中...",
    syncing_2: "等到完成",
    enable: "启用云同步",
    save: "保存设置",
    edit: "编辑设置",
    resync: "重新同步数据",
    deleteDevices: "管理设备",
    handshakeFailed: "连接尝试失败",
    handshakeFailedDesc: "无法连接到 Firebase 服务器。",
  },
  synceddevices: {
    title: "连接的设备",
    lastSync: "上次同步：",
    error_fetching: "获取设备时出错",
    upToDate: "已是最新",
    pending: "{{count}} 项待同步",
    mostRecent: "最新",
  },
  createcategory: {
    title_create: "创建类别",
    title_update: "更新类别",
    name_title: "姓名",
    name_placeholder: "在此处输入类别名称...",
    icon_title: "图标",
    suggested_title: "推荐",
    notes_num: "笔记: ",
  },
  organizecategory: {
    title: "组织",
    empty: "还没有类别。\n点击 + 按钮创建一个。",
  },
  trashednotes: {
    title: "垃圾笔记",
    countdown: "删除: {{days}} 乔尼, {{hours}} 矿石 e {{minutes}} 分钟",
    settings: {
      delete_all: "删除所有",
      restore_all: "恢复所有",
      delete_selected: "删除所选",
      restore_selected: "恢复选择",
    },
  },
  webhooks: {
    title: "网络钩子",
    addTextNote: "添加文本注释",
    addTodoNote: "添加待办事项",
    addKanbanNote: "添加看板���记",
    addCodeNote: "添加代码笔记",
    updateNote: "更新说明",
    temporaryDeleteNote: "临时删除笔记",
    deleteNote: "删除笔记",
    restoreNote: "恢复笔记",
    createCategory: "创建类别",
    deleteCategory: "删除类别",
    updateCategory: "更新类别",
    exportData: "导出数据",
    exporData: "导出数据",
    importData: "导入数据",
    wipeData: "擦除数据",
  },
  generalsettings: {
    title: "设置",
    basic: "基本的",
    cloudsync: "Cloud Sync",
    temporary_trash_lifespan: "临时垃圾持续时间",
    days: "天",
    change_secret_code: "更改密码",
    enable_fingerprint: "启用指纹",
    fingerprint_reason: "解锁你的笔记",
    advanced: "先进的",
    show_hidden: "显示隐藏的注释",
    export_import_data: "导出/导入数据",
    export_import_popup_title: "秘密密码",
    export_import_placeholder_input: "输入秘密代码...",
    export_popup_description: "在这里写下您的秘密密码。请记住保存它，否则您将无法恢复您的笔记。",
    import_popup_description: "在这里写下您的秘密密码以导入您的笔记。",
    webhooks: "网络钩子",
    voice_recognition: "语音识别",
    ai_assistant: "AI助手",
    note_creation: "创建笔记",
    wipe_data: "抹掉数据",
    developer_options: "开发者选项",
    about: "关于",
    about_the_app: "关于应用程序",
    about_the_developer: "关于开发商",
    check_updates: "检查更新",
    checking_updates: "检查中...",
    update_available: "有可用更新",
    update_confirm: "您想现在安装吗？",
    no_updates: "您正在使用最新版本。",
    feedback_and_help: "反馈和帮助",
    help: "帮助",
    changelog: "变更日志",
    report: "报告问题",
    suggest: "推荐给朋友",
  },
  info: {
    title: "信息",
    fastmemo: "Fast Memo",
    app: "应用程序",
    version: "版本",
    libraries: "图书馆",
  },
  note_creation: {
    title: "创建笔记",
    mode_section: "模式",
    default_type_section: "默认笔记类型",
    mode: {
      simple: "简单",
      simple_description: "点按创建文本笔记。使用菜单选择其他类型。",
      smart: "智能",
      smart_description: "点按始终创建下方所选类型。",
      adaptive: "自适应",
      adaptive_description: "点按创建与上一条笔记相同的类型。",
    },
  },
  aboutdeveloper: {
    title: "关于我",
    freelance: "自由网络开发人员",
    information: "信息",
    developer: "开发商",
    website: "网站",
    openLink: "打开链接",
  },
  ai: {
    title: "AI助手",
    model: "模型",
    status: "状态",
    settings: "设置",
    enabled: "已启用",
    downloaded: "已下载",
    not_downloaded: "未下载",
    downloading: "下载中...",
    download_model: "下载模型",
    cancel: "取消",
    delete_model: "删除模型",
    info: "AI助手完全在您的设备上运行。不会向外部服务器发送任何数据。模型需要下载一次（约400 MB）并将存储在本地。",
    model_light: "快速，基础质量。需要3GB以上RAM。",
    model_powerful: "速度与质量的平衡。需要4GB以上RAM。",
    model_advanced: "高质量。需要6GB以上RAM。",
    model_pro: "最高质量，接近桌面性能。需要8GB以上RAM。",
    model_unavailable: "此设备RAM不足",
    capabilities_title: "我能做什么？",
    cap: {
      generate_title: "根据笔记内容生成标题",
      summarize: "将文本笔记总结为几句话",
      fix_grammar: "修正拼写和语法",
      shorten: "让文本更简短精炼",
      translate: "将笔记翻译成应用语言",
      suggest_items: "为清单建议新项目",
      suggest_category: "为笔记建议最佳类别",
      voice_cleanup: "用标点整理口述文本",
      explain_code: "解释代码的作用",
      add_comments: "为代码添加注释",
    },
    unavailable_web: "AI助手仅在移动设备上可用。",
    native_rebuild_needed: "AI助手需要原生重建。\n运行: npx expo run:android",
    voice_only: "仅语音",
    voice_only_hint: "仅使用语音与助手交互",
    listening: "正在聆听...",
    tap_to_speak: "点击麦克风说话",
    sending_soon: "发送中...",
    placeholder: "你想做什么？",
    processing: "思考中...",
    feedback: {
      note_created: '笔记"{{title}}"已创建',
      property_toggled: "{{count}}条笔记已更新",
      note_deleted: "{{count}}条笔记已移至回收站",
      category_changed: "{{count}}条笔记已移动",
      done: "完成",
      note_renamed: '笔记已重命名为"{{title}}"',
      items_added: "已添加{{count}}个项目",
      category_created: '分类"{{name}}"已创建',
      note_restored: "已恢复{{count}}条笔记",
      category_switched: '已切换到"{{name}}"',
      no_notes_found: "未找到匹配的笔记",
      category_not_found: "未找到分类",
      not_todo_note: "该笔记不是清单",
      category_exists: "分类已存在",
      note_converted: '笔记"{{title}}"已转换',
      notes_merged: '笔记已合并为"{{title}}"',
      setting_changed: "设置已更新",
      help_message:
        '我可以创建笔记、清单和看板，删除、重命名、转换和合并笔记等。\n试试："创建一个包含牛奶和面包的购物清单"\n所有功能请查看设置 > AI助手。',
      same_type: "笔记已经是该类型",
      not_understood: "我只能帮助处理笔记",
      error: "出现问题，请重试",
      voice_unavailable: "语音不可用",
    },
    editor: {
      generate_title: "生成标题",
      summarize: "总结",
      suggest_items: "建议项目",
      suggest_category: "建议类别",
      explain_code: "解释代码",
      add_comments: "添加注释",
      fix_grammar: "修正语法",
      shorten: "缩短",
      translate: "翻译",
      min_model: "最低",
      before: "之前",
      after: "之后",
      apply: "应用",
      no_content: "请先写点内容",
      no_category_match: "未找到匹配的类别",
      error: "无法生成，请重试",
    },
  },
  voicerecognition: {
    title: "语音识别",
    enabled: "已启用",
    interimResults: "实时转录",
    continuous: "手动停止",
    language: "语言",
    language_default: "默认（系统）",
    dictation: {
      listening: "正在聆听…",
      paused: "已暂停",
      hint: "请开始说话。",
      insert: "插入",
      cancel: "取消",
      ai_cleanup: "用AI整理",
      processing: "处理中…",
    },
  },
  help: {
    title: "帮助",
    search_placeholder: "有什么可以帮您的？",
    no_results: "没有结果，请换个词试试。",
    search_placeholders: [
      "搜索或描述你的需求…",
      "如何创建笔记？",
      "工具栏有什么用？",
      "云同步如何工作？",
      "如何恢复已删除的笔记？",
    ],
    ai_thinking: "正在用 AI 搜索…",
    ai_results: "AI 结果 · 点按清除",
    ai_invite_title: "没找到你想要的？",
    ai_invite_subtitle: "用你自己的话描述，让 AI 助手帮你找到合适的主题。",
    cat_notes: "笔记",
    cat_editor: "编辑器与格式",
    cat_categories: "分类",
    cat_trash: "回收站",
    cat_cloud: "云同步与加密",
    cat_data: "安全与数据",
    cat_settings: "设置",
    cat_more: "更多与信息",
    cat_ai: "AI 助手",
    how_to_create_note: {
      title: "如何创建笔记？",
      text_1_0: "点击主页右下角的",
      text_1_1: "按钮。",
      text_2_0: "会打开一个新页面，您可以在其中添加标题并撰写笔记。",
      text_3_0: "只需返回主页即可保存。",
    },
    how_to_create_todo_note: {
      title: "如何创建待办清单？",
      text_1_0: "点击主页右下角的",
      text_1_1: "按钮。",
      text_2_0: "会打开一个新页面，您可以在其中添加标题和待办事项。",
      text_3_0: "拖动事项右侧的六个圆点，即可上下移动它。",
      text_4_0: "点击右侧的叉号可删除该事项。",
      text_5_0: "底部的按钮可以让您：",
      text_6_0: "• 添加 — 向清单中添加新事项。",
      text_7_0: "• 切换模式 — 在列表（经典的待办清单）和步骤（按顺序完成的带编号顺序列表）之间切换。",
      text_8_0: "• 全部删除 — 删除清单中的所有事项。",
      text_9_0: "只需返回主页即可保存。",
    },
    how_to_create_kanban_note: {
      title: "如何创建看板？",
      text_1_0: "点击主页右下角的",
      text_1_1: "按钮，然后选择「看板」。",
      text_2_0: "会打开一个看板，其中已有一列可供使用。",
      text_3_0: "• 添加列 — 点击右侧的「添加列」（最多 10 列）。",
      text_4_0: "• 重命名列 — 编辑列标题中的文本。",
      text_5_0: "• 更改列的颜色 — 点击列标题中的彩色方块。",
      text_6_0: "• 添加卡片 — 点击列底部的「添加卡片」。",
      text_7_0: "• 移动卡片 — 长按卡片，然后将其拖到另一列。",
      text_8_0: "• 删除卡片 — 点击卡片上的垃圾桶图标。",
      text_9_0: "• 删除列 — 点击列标题中的垃圾桶图标。",
      text_10_0: "只需返回主页即可保存看板。",
    },
    how_to_create_code_note: {
      title: "如何创建代码笔记？",
      text_1_0: "点击主页右下角的",
      text_1_1: "按钮，然后选择「代码」。",
      text_2_0: "您会获得一个带语法高亮的真正代码编辑器。",
      text_3_0: "• 标签页 — 在一条笔记中保存多个代码片段；可添加、重命名、删除或拖动排序（最多 6 个）。",
      text_4_0: "• 语言 — 点击语言栏选择一种语言，或让其自动检测。",
      text_5_0: "• 查找和替换 — 点击顶部的搜索图标，就像在文本笔记中一样。",
      text_6_0: "只需返回主页即可保存。",
    },
    how_to_edit_note: {
      title: "如何编辑笔记？",
      text_1_0: "只需在主页上点击笔记将其打开，即可进行修改。",
    },
    how_to_delete_note: {
      title: "如何删除笔记？",
      text_1_0: "查看笔记时，点击右上角的",
      text_1_1: "。",
      text_2_0: "会打开一个菜单 —「删除」是第一个选项。",
    },
    how_to_select_notes: {
      title: "如何一次选择多条笔记？",
      text_1_0: "长按任意一条笔记即可开始选择。",
      text_2_0: "这会开启选择模式，您可以对多条笔记一起操作 — 删除它们，或将其标记为重要、只读或锁定。",
    },
    what_are_hidden_notes: {
      title: "隐藏笔记是如何工作的？",
      text_1_0: "打开某条笔记的选项菜单，点击「隐藏」，即可将其从主页上隐藏起来。",
      text_2_0: "要再次查看隐藏的笔记，请在高级设置中开启「显示隐藏笔记」 — 您需要输入密码才能完成此操作。",
    },
    what_toolbar_below: {
      title: "底部的工具栏是什么？",
      text_1_0: "它可以让您格式化并丰富文本。各个按钮的作用如下：",
      text_2_0: "• 撤销/重做 — 后退或前进到您最近的更改。",
      text_3_0: "• 图片 — 从图库中插入一张图片。",
      text_4_0: "• 粗体 — 将所选文本设为粗体。",
      text_5_0: "• 斜体 — 将所选文本设为斜体。",
      text_6_0: "• 删除线 — 给所选文本添加删除线。",
      text_7_0: "• 下划线 — 给所选文本添加下划线。",
      text_8_0: "• 下标 — 将文本稍微下移到基线以下。",
      text_9_0: "• 上标 — 将文本稍微上移到基线以上。",
      text_10_0: "• 项目符号列表 — 开始一个项目符号列表。",
      text_11_0: "• 编号列表 — 开始一个编号列表。",
      text_12_0: "• 代码 — 将文本包裹在格式化的代码块中。",
    },
    what_find_replace: {
      title: "如何查找和替换文本？",
      text_1_0: "在编辑文本或代码笔记时，点击右上角的搜索图标。",
      text_2_0: "输入您要查找的内容：箭头可在匹配项之间跳转，并显示共有多少个。",
      text_3_0: "开启「替换」可替换当前匹配项，或一次性替换所有匹配项。",
    },
    what_are_settings_note: {
      title: "笔记选项有哪些？",
      text_1_0: "打开一条笔记，点击右上角的 ⋮ 菜单。您可以在那里：",
      text_2_0: "• 删除 — 将笔记移到回收站。",
      text_3_0: "• 重要 — 标记笔记，使其在顶部突出显示。",
      text_4_0: "• 保护 — 用密码或指纹锁定笔记。",
      text_5_0: "• 只读 — 防止笔记被意外编辑。",
      text_6_0: "• 隐藏 — 将笔记从主页上隐藏，直到您选择显示隐藏笔记。",
      text_7_0: "• 设为离线 — 让笔记只保存在本设备上，绝不同步到云端。",
      text_8_0: "• 更改分类 — 将笔记移到另一个分类。",
      text_9_0: "• 导出（文本笔记） — 将笔记保存为 .txt、Markdown 或 PDF 文件。",
      text_10_0: "• 信息 — 查看笔记的类型、分类和日期。",
    },
    how_create_category: {
      title: "如何创建分类？",
      text_1_0: "在主页上，点击左上角的",
      text_1_1: "。",
      text_2_0: "这会打开「整理」页面。在那里，点击右下角的",
      text_2_1: "。",
      text_3_0: "在「创建分类」页面，给它起个名字，并选择一个尚未使用的图标。",
      text_4_0: "完成后，点击右下角的",
      text_4_1: "即可保存。",
    },
    how_edit_category: {
      title: "如何编辑分类？",
      text_1_0: "在主页上，点击左上角的",
      text_1_1: "。",
      text_2_0: "在「整理」页面，点击您想修改的分类 — 会打开它的编辑页面，您可以在其中重命名或选择新图标。",
    },
    how_organize_categories: {
      title: "如何重新排列我的分类？",
      text_1_0: "在主页上，点击左上角的",
      text_1_1: "。",
      text_2_0: "在「整理」页面，点击",
      text_2_1: "进入整理模式。",
      text_3_0: "点击一个分类将其拿起，然后点击另一个分类把它放到那里，即可改变顺序。",
      text_4_0: "对顺序满意后，点击",
      text_4_1: "即可保存。",
      text_5_0: "若要放弃更改，请点击右上角的",
      text_5_1: "。",
    },
    how_delete_category: {
      title: "如何删除分类？",
      text_1_0: "在主页上，长按一个分类进入选择模式。",
      text_2_0: "然后点击",
      text_2_1: "并选择是将分类连同其笔记一起删除，还是将笔记移到「全部」中以保留它们。",
    },
    what_are_trashed_notes: {
      title: "回收站是什么？",
      text_1_0: "删除笔记时，它不会立即消失 — 而是先进入回收站。",
      text_2_0: "笔记会在那里保留 7 天，然后被永久删除。您可以在基本设置中更改保留时长。",
    },
    how_restore_trashed_notes: {
      title: "如何恢复已删除的笔记？",
      text_1_0: "打开「回收站」页面并点击一条笔记 — 系统会询问您是否要恢复它。",
      text_2_0: "若要一次恢复多条，请长按一条笔记，选中您想要的那些，然后点击右上角的",
      text_2_1: "。",
      text_3_0: "在出现的菜单中，选择「恢复」。",
      text_4_0: "若要一次性恢复全部，请点击右上角的",
      text_4_1: "。",
      text_5_0: "在出现的菜单中，选择「全部恢复」。",
    },
    how_restore_delete_notes: {
      title: "如何从回收站永久删除笔记？",
      text_1_0: "打开「回收站」页面，长按一条笔记进入选择模式，然后选中要删除的那些。",
      text_2_0: "点击右上角的",
      text_2_1: "。",
      text_3_0: "在出现的菜单中，选择「删除」。",
      text_4_0: "若要一次性清空整个回收站，请点击右上角的",
      text_4_1: "。",
      text_5_0: "在出现的菜单中，选择「全部删除」。",
    },
    what_cloud_sync: {
      title: "什么是云同步？",
      text_1_0:
        "您可以通过连接自己的 Google Firebase 项目并启用同步，在各设备间同步笔记。没有 Fast Memo 中央服务器——您的数据只存在于您自己的 Firebase 中。",
      text_2_0: "您的笔记在上传前会在设备上进行端到端加密，因此除您之外没有人能读取它们。",
      text_link: "阅读设置 Google Firebase 的分步指南 →",
    },
    what_encryption: {
      title: "我的笔记是如何加密的？",
      text_1_0: "云同步使用端到端加密。首次设置时您需要选择一个加密密码，设备会由此派生出保护笔记的密钥。",
      text_2_0:
        "该密钥永远不会离开您的设备，也不会存储在云端，因此即使有人能访问您的 Firebase，没有您的密码也无法读取笔记内容。",
      text_3_0: "笔记内容会被加密；标题和日期保持可读，以便应用进行排序和同步。",
    },
    how_unlock_device: {
      title: "为什么每台设备都需要解锁？",
      text_1_0:
        "每台设备通过输入密码解锁加密一次。之后密钥会安全地存储在设备上（Keychain / Keystore），因此您无需在每次启动时重新输入。",
      text_2_0: "如果某台设备保持锁定，该设备上的同步将暂停，直到您解锁——这可以防止笔记被保存为无法读取的内容。",
    },
    forgot_password: {
      title: "我忘记了加密密码",
      text_1_0: "设置加密时，系统会向您显示一个一次性恢复密钥。请妥善保管。",
      text_2_0: "在解锁界面选择「忘记密码」，输入您的恢复密钥并设置新密码。不会丢失任何笔记。",
      text_3_0: "如果您同时丢失了密码和恢复密钥，云端笔记将无法被任何人解密——这正是端到端加密的意义。",
    },
    reset_encryption: {
      title: "重置加密会做什么？",
      text_1_0: "重置是最后的手段，用于密码和恢复密钥都丢失的情况。",
      text_2_0: "它会根据本设备上当前的笔记创建一套全新的加密，并替换云端副本。无法再被解密的旧云端笔记将被删除。",
      text_3_0: "您的本地笔记会被保留并重新上传，因此本设备不会丢失任何内容——但您的其他设备需要使用新密码重新解锁。",
    },
    quick_backup: {
      title: "什么是快速备份？",
      text_1_0: "在加密的设置、解锁和重置界面中，您会看到一个可选的「快速备份」按钮。",
      text_2_0:
        "它会直接从本设备导出一个受口令保护的笔记文件，独立于云端——在大规模同步或重置之前提供额外保障。无论如何，您的笔记始终保留在本设备上。",
    },
    what_secret_code: {
      title: "什么是密码？",
      text_1_0: "这是您首次打开应用时设置的密码，打开任何已锁定的笔记时都需要它。",
      text_2_0: "您可以随时在基本设置中更改它。",
    },
    what_import_export: {
      title: "什么是导入和导出？",
      text_1_0: "它们可以让您就在本设备上保存一份数据副本，或将其恢复回来。",
      text_2_0: "导出时，文件会保存到您选择的文件夹中。",
      text_3_0: "该文件始终是加密的——再次导入时需要您设置的口令。",
    },
    how_export_note: {
      title: "如何导出单条笔记？",
      text_1_0: "打开一条文本笔记，点击选项菜单并选择「导出」。",
      text_2_0: "然后选择您想要的格式：",
      text_3_0: "• 纯文本（.txt） — 只有文本，不含格式。",
      text_4_0: "• Markdown（.md） — 保留标题和基本格式。",
      text_5_0: "• PDF — 一份整洁的文档，可随时分享。",
      text_6_0: "文件会通过您的设备进行分享，因此您可以随意保存或发送它。",
    },
    what_wipe_data: {
      title: "擦除数据会做什么？",
      text_1_0: "它会一次性从本设备上移除您所有的笔记和分类。",
      text_2_0: "由于此操作无法撤销，系统会先要求您确认。",
      text_3_0: "确认后，所有内容都将被永久删除。",
    },
    what_note_creation: {
      title: "笔记创建设置有什么作用？",
      text_1_0: "它决定您点击主页上的 [+] 按钮时会发生什么。在设置 → 笔记创建中，您可以选择：",
      text_2_0: "• 简单 — [+] 创建一条文本笔记；其他类型请使用菜单。",
      text_3_0: "• 智能 — [+] 始终创建您设为常用的那种类型。",
      text_4_0: "• 自适应 — [+] 创建与您上次操作的笔记相同的类型。",
    },
    what_home_filters: {
      title: "主页筛选器是如何工作的？",
      text_1_0: "点击主页顶部的筛选图标，可以更改笔记的显示方式。",
      text_2_0: "• 排序方式 — 按创建日期或最后更新时间排序，升序或降序。",
      text_3_0: "• 深度搜索 — 不仅搜索标题，还会搜索笔记内容和列表内部（首先会要求输入您的密码）。",
    },
    what_language: {
      title: "如何更改语言？",
      text_1_0: "打开基本设置，点击「语言」即可切换。",
      text_2_0: "您可以自动跟随设备的语言，或从可用的七种语言中选择一种：英语、意大利语、西班牙语、法语、德语、中文和日语。",
    },
    what_version_check: {
      title: "应用会检查更新吗？",
      text_1_0: "会的——当您打开 Fast Memo 时，它会悄悄检查是否有更新版本可用。",
      text_2_0: "有更新时，会显示一个「更新内容？」界面，告诉您有哪些变化。您也可以随时在设置中检查。",
    },
    what_report_problem: {
      title: "如何报告问题？",
      text_1_0: "前往设置 → 报告问题。",
      text_2_0: "选择一个主题，描述发生的情况，并可选择附上几张截图和您的设备信息，以帮助我们排查。",
      text_3_0: "每天可以提交一份报告。",
    },
    what_webhooks: {
      title: "什么是 Webhook？",
      text_1_0:
        "Webhook 面向高级用户：它们可以让 Fast Memo 在发生某些事件时通知另一个服务——例如创建、更新或删除笔记，更改分类，导出数据等等。",
      text_2_0: "每个操作都可以调用您指定的一个网址。您可以在设置 → Webhook 中进行设置。",
    },
    what_platforms: {
      title: "我可以在哪里使用 Fast Memo？",
      text_1_0: "Fast Memo 可在移动端和桌面端（Windows、macOS 和 Linux）使用，还有网页版。",
      text_2_0: "在每台设备上连接同一个 Google Firebase 项目，您的笔记就能在各处保持同步。",
    },
    what_ai_assistant: {
      title: "什么是 AI 助手？",
      text_1_0: "Fast Memo 包含一个完全在设备上运行的自托管 AI 助手。不会向外部服务器发送任何数据。",
      text_2_0: "要设置它，请前往设置 -> AI 助手，选择一个模型并下载。",
      text_3_0:
        "启用后，每个笔记编辑器中会出现一个星光按钮。点击它可以访问智能操作，如：生成标题、总结、继续写作、格式化文本、建议清单项目或建议分类。",
      text_4_0: "AI 可离线工作，并支持多种语言。",
    },
  },
  report: {
    title: "报告问题",
    question: "问题的主题是什么？",
    topic: {
      crash: "崩溃",
      notes: "笔记",
      categories: "分类",
      cloud: "云",
      webhooks: "Webhooks",
      export_import: "导出/导入",
      translations: "翻译",
      suggestions: "建议",
      other: "其他",
    },
    descriptionPlaceholder: "请详细描述问题（必填）",
    deviceInfoCheckbox: "为了更准确的诊断，请提供设备详细信息。",
    attachments: "添加图片",
    sendReport: "发送报告",

    sent_message_1: "感谢您提交报告。",
    sent_message_2: "从那天起可以提交另一份报告：",

    attachments_limit: "附件限制：",
    size_limit: "每张图片的大小限制：",
    loading: "加载中...",

    messages: {
      size: {
        title: "文件太大！",
        text: "选择较小的文件或压缩它。",
      },
      success: {
        title: "成功！",
        text: "报告已成功发送。",
      },
      error: {
        title: "错误！",
        text: "无法发送报告。",
      },
      missing: {
        title: "缺少数据！",
        text: "请填写问题的主题和描述。",
      },
    },
  },

  /* popup */
  popup: {
    delete_category: "你想删除这个类别吗？\n您可以将笔记移动到'全部'类别",
    restore_single_note: "你想恢复这个笔记吗？",
    restore_notes: "你想恢复那些笔记吗？",
    delete_notes: "你想删除那些笔记吗",
    delete_notes_perma: "你想永久删除那些笔记吗？",
    restore_all_notes: "你想恢复所有的笔记吗？",
    delete_all_notes_perma: "你想永久删除所有笔记吗？",
    select_one_option: "请选择一个选项",
    passphrase_wrong: "您输入的密码错误。",
    are_you_sure_wipe: "您确定要擦除数据吗？\n您将丢失所有创建的笔记和类别。",
    finish_organize_categories: "完成以组织类别或撤消更改。",
    generic_success_description: "操作成功。",
  },

  /* generic */
  All: "全部",
  delete_and_move: "删除和移动",
  delete_with_notes: "用笔记删除",
  ok: "好的",
  confirm: "他证实",
  cancel: "取消",
  delete: "删除",
  restore: "恢复",
  warning: "警告",
  error: "错误",
  import: "进口",
  export: "出口",
  retry: "重试",
  wipe: "全部擦除",
  wipeWithCloud: "擦除所有+云",
  loading: "加载中...",

  developeroptions: {
    title: "开发者选项",
    warning: "这些选项可能会影响特定笔记的云同步或应用性能。",
    unlimited_text_space: "无限文本空间",
    unlimited_text_space_desc: "当前限制：1 MB",
    unlimited_kanban_columns: "无限看板列",
    unlimited_kanban_columns_desc: "当前限制：10 列",
    unlimited_trash_time: "无限回收站时间",
    unlimited_trash_time_desc: "当前限制：30 天",
    change_app_icon: "更改应用图标",
    change_app_icon_desc: "即将推出",
  },

  /* toast */
  disconnected: "您已与 Cloud 断开连接",
  dataSynced: "数据已同步",
  noInternetConnection: "没有网络连接",
  devicesLimitReached: "超出设备限制",
  noteLimitReached: "已达到备注限制",
  developerModeActivated: "开发者模式已激活！",
  developerModeAlready: "开发者模式已处于活动状态",
  developerModeTaps: "还需点击 {{remaining}} 次以启用开发者模式",

  empty_title: "（无题）",
};

export default zh;
