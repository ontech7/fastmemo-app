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

    description_2_6_1: `• 新增看板类型笔记。
• 重新设计主页在点击“+”时的界面。
• 笔记类型现在以顶部徽章显示。`,

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

    description_2_2_0: `• 添加了隐藏笔记的功能。
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
  intro: {
    step1: "一键添加笔记。",
    step2: "使用底部工具栏丰富您的文本。",
    step3: "创建待办事项列表来管理您的任务。",
    step4: "根据您的需要创建您自己的类别。",
    step5: "输入密码来隐藏你的笔记。",
    step6: "在您的 Google Firebase 上同步您的笔记。",
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
    toggleProtectedNote: "插入您的密码",
    toggleProtectedSelectedNotes: "插入您的密码",
    toggleGeneric: "插入您的密码",
    error: "您输入的代码不匹配。再试一次。",
  },
  firstMemo: {
    title: "欢迎使用 FastMemo! 🔊",
  },
  home: {
    notes: "笔记",
    search: "写一些东西...",
    deepSearch: "深度搜索（文本、列表等）",

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
    created: "创建: ",
    updated: "修改: ",
    type: {
      todo: "列表",
      kanban: "看板",
      text: "文本",
    },
    settings: {
      delete: "删除",
      important: "重要的",
      protect: "保护",
      readonly: "只读",
      hide: "隐藏",
      changecategory: "更改类别",
      share: "分享",
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
  },
  createcategory: {
    title_create: "创建类别",
    title_update: "更新类别",
    name_title: "姓名",
    name_placeholder: "在此处输入类别名称...",
    icon_title: "图标",
    notes_num: "笔记: ",
  },
  organizecategory: {
    title: "组织",
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
    addKanbanNote: "添加看板笔记",
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
    advanced: "先进的",
    show_hidden: "显示隐藏的注释",
    export_import_data: "导出/导入数据",
    export_import_popup_title: "秘密密码",
    export_import_placeholder_input: "输入秘密代码...",
    export_popup_description: "在这里写下您的秘密密码。请记住保存它，否则您将无法恢复您的笔记。",
    import_popup_description: "在这里写下您的秘密密码以导入您的笔记。",
    webhooks: "网络钩子",
    voice_recognition: "语音识别",
    wipe_data: "抹掉数据",
    about: "关于",
    about_the_app: "关于应用程序",
    about_the_developer: "关于开发商",
    check_updates: "检查更新",
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
  aboutdeveloper: {
    title: "关于我",
    freelance: "自由网络开发人员",
    information: "信息",
    developer: "开发商",
    website: "网站",
  },
  voicerecognition: {
    title: "语音识别",
    enabled: "已启用",
    interimResults: "实时转录",
    continuous: "手动停止",
    language: "语言",
    language_default: "默认（系统）",
  },
  help: {
    title: "帮助",
    how_to_create_note: {
      title: "如何创建笔记？",
      text_1_0: "您可以通过点击主页右下角的",
      text_1_1: "按钮来创建笔记。",
      text_2_0: "它将弹出一个新页面，您可以在其中为您的笔记写上标题和描述。",
      text_3_0: "您可以通过返回主页来保存它。",
    },
    how_to_create_todo_note: {
      title: "如何创建待办事项？",
      text_1_0: "您可以通过点击创建待办事项",
      text_1_1: "主页右下角的按钮。",
      text_2_0: "它将弹出一个新页面，您可以在其中为您的笔记写上标题和待办事项文本列表。",
      text_3_0: "通过按下项目右侧的 6 个点，您将能够上下移动它。",
      text_4_0: "右边的十字按钮将删除该项目。",
      text_5_0: "底部的按钮是：",
      text_6_0: "• 添加：一个新的待办事项将被添加到列表中。",
      text_7_0: "• 隐藏/取消隐藏勾选：如果勾选，将隐藏/取消隐藏待办事项。",
      text_8_0: "• 全部删除：它将删除笔记中存在的所有待办事项。",
      text_9_0: "您可以通过返回主页来保存它。",
    },
    how_to_edit_note: {
      title: "如何编辑笔记？",
      text_1_0: "您可以通过在主页中选择笔记来编辑它",
    },
    how_to_delete_note: {
      title: "如何删除笔记？",
      text_1_0: "您可以通过点击删除笔记",
      text_1_1: "在右上角，查看笔记时。",
      text_2_0: "它将打开一个弹出菜单。第一个选项就是您要查找的内容。",
    },
    how_to_select_notes: {
      title: "如何选择一些笔记？",
      text_1_0: "您可以通过长按一个音符来选择音符。",
      text_2_0: "您将进入'编辑模式'，可以执行各种操作，例如删除、将它们设为重要、只读或锁定。",
    },
    what_toolbar_below: {
      title: "下面那个工具栏是什么？",
      text_1_0: "工具栏可以通过多种方式丰富您的文本。",
      text_2_0: "• 图片: 您可以从图库中放置和剪切图片。",
      text_3_0: "• 粗体: 您可以将文本设为粗体。",
      text_4_0: "• 斜体: 您可以将文本设置为斜体。",
      text_5_0: "• 下划线: 您可以在文本中添加下划线。",
      text_6_0: "• 子集: 您可以将文本放在相对于文本的底部位置。",
      text_7_0: "• 超集: 您可以将文本放在相对于文本的顶部位置。",
      text_8_0: "• 项目符号列表: 您可以创建项目符号列表。",
      text_9_0: "• 有序列表: 您可以创建一个有序列表。",
      text_10_0: "• 代码: 您可以创建一个包装器，您可以在其中编写格式化代码。",
    },
    what_are_settings_note: {
      title: "笔记的设置是什么？",
      text_1_0: "笔记的设置是: ",
      text_2_0: "• 删除: 您可以删除当前笔记。",
      text_3_0: "• 重要: 您可以将您的笔记设置为重要",
      text_4_0: "• 保护: 您可以锁定您的笔记。如果激活，您需要密码或指纹。",
      text_5_0: "• 只读: 您的笔记无法修改。",
      text_6_0: "• 更改类别: 您可以将笔记的类别更改为另一个类别。",
      text_7_0: "• 分享: 您可以将笔记的文本分享到另一个社交应用程序。",
    },
    how_create_category: {
      title: "如何创建分类？",
      text_1_0: "您可以通过点击创建一个新类别",
      text_1_1: "在主页的左上角。",
      text_2_0: "您将被重定向到'组织'页面。在右下角您需要点击",
      文本_2_1: "",
      text_3_0: "您将再次被重定向到'创建类别'页面。您将被要求创建一个名称并选择一个独特的图标。",
      text_4_0: "编译表单后，",
      text_4_1: "会出现在右下角。你必须点击它来保存你的新类别。",
    },
    how_edit_category: {
      title: "如何编辑分类？",
      text_1_0: "您可以通过点击编辑类别",
      text_1_1: "在主页的左上角。",
      text_2_0: "您将被重定向到'组织'页面。您需要选择一个类别，然后您将被再次重定向到'更新类别'页面。",
    },
    how_organize_categories: {
      title: "如何组织我的分类？",
      text_1_0: "您可以通过点击编辑类别",
      text_1_1: "在主页的左上角。",
      text_2_0: "您将被重定向到'组织'页面。您需要点击",
      text_2_1: "进入'组织模式'",
      text_3_0: "当点击一个分类时，他会'不编号'。您可以点击另一个分类来改变分类的顺序。",
      text_4_0: "完成后，您可以点击",
      text_4_1: "变化。",
      text_5_0: "如果你想撤销你的更改，你可以点击",
      text_5_1: "",
    },
    how_delete_category: {
      title: "如何删除分类？",
      text_1_0: "在主页中，您可以长按一个类别，然后进入'编辑模式'。",
      text_2_0: "如果你点击",
      text_2_1: "将出现一个弹出窗口，询问您是否要将类别与您的笔记一起删除，或者只是将它们转移到所有笔记。",
    },
    what_are_trashed_notes: {
      title: "什么是垃圾笔记？",
      text_1_0: "当删除一个笔记时，它会进入垃圾箱。这是一个所有笔记暂时存放的垃圾箱。",
      text_2_0: "默认情况下它们只会持续 7 天，然后就会消失。您可以从基本设置中更改此设置。",
    },
    how_restore_trashed_notes: {
      title: "如何恢复被删除的笔记？",
      text_1_0: "在'已删除的笔记'页面中，您可以选择一个笔记，然后会出现一个弹出窗口，询问您是否要恢复该笔记。",
      text_2_0: "您可以通过长按一个笔记来恢复多个笔记，并选择您想要的笔记。点击",
      text_2_1: "在右上角。",
      text_3_0: "会出现弹窗，第二个选项就是你要找的。",
      text_4_0: "您还可以通过单击恢复垃圾箱中存在的所有笔记",
      text_4_1: "在右上角。",
      text_5_0: "会出现一个弹窗，第二个选项就是你要找的。",
    },
    how_restore_delete_notes: {
      title: "如何恢复删除的笔记？",
      text_1_0: "在'已删除笔记'页面中，您可以长按要进入'编辑模式'的笔记，然后选择要删除的笔记。",
      text_2_0: "点击",
      text_2_1: "在右上角。",
      text_3_0: "会出现一个弹窗，第一个选项就是你要找的。",
      text_4_0: "您也可以通过点击删除垃圾箱中的所有笔记",
      text_4_1: "在右上角。",
      text_5_0: "会出现一个弹窗，第二个选项就是你要找的。",
    },
    what_cloud_sync: {
      title: "什么是云同步？",
      text_1_0: "可以通过连接您的 Google Firebase 帐户并启用同步模式来同步您的笔记。",
      text_2_0: "您无需执行任何其他操作。您的笔记将加密存储在您的 Google Firebase 中。",
    },
    what_secret_code: {
      title: "什么是密码？",
      text_1_0: "您锁定的笔记将需要您在首次打开应用程序时生成的密码。",
      text_2_0: "您可以从基本设置中更改它。",
    },
    what_import_export: {
      title: "什么是导入/导出数据？",
      text_1_0: "您可以在本地导入或导出数据。",
      text_2_0: "通过导出它们，将在您要保存的文件夹中生成一个文件。",
      text_3_0: "默认情况下它会被加密。您需要一个密码才能导入它。",
    },
    what_wipe_data: {
      title: "什么是擦除数据？",
      text_1_0: "你可以擦除所有的笔记和类别。",
      text_2_0: "将出现一个弹出窗口，询问您是否确定要执行此操作。",
      text_3_0: "它们将被永久删除。",
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

  /* toast */
  disconnected: "您已与 Cloud 断开连接",
  dataSynced: "数据已同步",
  noInternetConnection: "没有网络连接",
  devicesLimitReached: "超出设备限制",
  noteLimitReached: "已达到备注限制",

  empty_title: "（无题）",
};

export default zh;
