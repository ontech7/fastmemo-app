const ja = {
  languageCode: "ja",
  languageName: "日本語",

  date: {
    mon: "月曜日",
    tue: "火曜日",
    wed: "水曜日",
    thu: "木曜日",
    fri: "金曜日",
    sat: "土曜日",
    sun: "日曜日",
  },
  changelog: {
    title: "新着情報",

    web: {
      description_0_1_0: `• Fast Memo Desktop（BETA）の初期リリース。モバイルのすべての機能を備えています。`,
    },

    mobile: {
      description_2_7_0: `• モバイル・タブレット・デスクトップでのカンバンのドラッグ＆ドロップを修正。
    • モバイル版とデスクトップ版のアプリを整合。
    • デスクトップアプリを正式リリース。`,

      description_2_6_2: `• カンバンタイプのノートを追加。
• 「+」を押したときのホームのデザインを再設計。
• ノートのタイプは上部のバッジとして表示されるように再設計。
• 各種修正。`,

      description_2_5_3: `• 各種修正。`,

      description_2_5_2: `• ノートを作成日と更新日で並べ替える機能を追加。
• 設定から直接言語を変更する機能を追加。
• モーダルをリニューアル。
• 各種修正。`,

      description_2_4_2: `• アプリの内部構造を見直し、速度と安定性を向上しました。
• ノートの文字起こし（テキストとリスト）用の音声認識を追加しました。
• 詳細検索機能（テキストおよびリスト）を追加しました。
• その他の修正。`,

      description_2_3_0: `• 日本語を追加しました。
• WebhookをBETAバージョン2.0に更新しました。
• その他の修正。`,

      description_2_2_1: `• メモを非表示にする機能を追加しました。
• 設定→フィードバックとアシスタンスから問題を報告する機能を追加しました。
• その他の修正。`,

      description_2_1_0: `• メモの文字数と最大メモサイズを追加しました。
• ToDoメモの項目数を追加しました。
• クラウドデバイスの最大制限（3）を追加しました。
• その他の修正。`,

      description_2_0_0: `• Google Firebaseとのクラウド同期を追加しました。
• Webhooks管理（上級者向け）を追加しました。
• テキストメモの左揃えと中央揃えのオプションを追加しました。
• 一部のオプションのための秘密コードを追加しました。
• すべての要素のサイズを変更しました。
• 秘密コード画面のデザインを変更しました。
• ToDoメモのスタイルを変更しました。
• その他の修正。`,

      description_1_4_0: `• ToDoタイプのメモを追加しました。
• その他の修正。`,

      description_1_3_0: `• イタリア語、スペイン語、フランス語、ドイツ語、中国語の翻訳を追加しました。
• カテゴリ用の新しいアイコンを追加しました。
• その他の修正。`,

      description_1_2_1: `• 本番リリース。
• ノート、一時的なノート、カテゴリなどを追加しました。
• 秘密コードを追加しました。
• その他の修正。`,
    },
  },
  intro: {
    step1: "1クリックでメモを追加します。",
    step2: "下部ツールバーを使用してテキストを充実させます。",
    step3: "タスクを管理するためのToDoリストを作成します。",
    step4: "必要に応じて独自のカテゴリを作成します。",
    step5: "メモを非表示にするための秘密コードを挿入します。",
    step6: "Google Firebaseでメモを同期します。",
    title: "Fast Memoとは？",
    continue: "続行",
  },
  setupcode: {
    title: "秘密コード",
    firstCode_1: "メモを非表示にするための秘密コードを作成します。",
    firstCode_2: "設定から指紋に切り替えることができます。",
    repeatCode: "秘密コードを再入力してください。",
    savedCode: "秘密コードが保存されました！",
    error: "入力したコードが一致しません。もう一度やり直してください。",
  },
  secretcode: {
    title: "秘密コード",
    oldCode: "古い秘密コードを入力してください。",
    newCode: "新しい秘密コードを入力してください。",
    repeatCode: "新しい秘密コードを再入力してください。",
    savedCode: "新しい秘密コードが保存されました！",
    unlockCode: "秘密コードを入力してください。",
    error: "入力したコードが一致しません。もう一度やり直してください。",
  },
  firstMemo: {
    title: "Fast Memoへようこそ！ 🔊",
  },
  home: {
    notes: "メモ",
    search: "何かを検索...",
    deepSearch: "詳細検索（テキスト、リストなど）",

    filters: {
      deepSearch: "詳細検索",
      orderBy: "並び替え:",
      createdAt: "作成日",
      updatedAt: "更新日",
    },
  },
  note: {
    title_placeholder: "タイトル",
    description_placeholder: "ここに何かを書いてください...",
    no_items: "アイテムはありません。\n右下のボタンを押して1つ追加してください。",
    characters: "文字",
    completed: "完了",
    on: "オン",
    created: "作成: ",
    updated: "更新: ",
    type: {
      todo: "リスト",
      kanban: "カンバン",
      text: "テキスト",
    },
    settings: {
      delete: "削除",
      important: "重要",
      protect: "保護",
      readonly: "読み取り専用",
      hide: "非表示",
      changecategory: "カテゴリを変更",
      share: "共有",
    },
  },
  kanban: {
    add_column: "列を追加",
    add_card: "カードを追加",
    column_name_placeholder: "列名",
    delete_column: "列を削除",
    move_to: "移動先",
    no_columns: "列がありません。\n追加して開始してください。",
    no_cards: "カードがありません",
    columns_count: "列",
    cards_count: "カード",
  },
  changecategory: {
    title: "カテゴリーの変更",
  },
  cloudsync: {
    title: "クラウド同期",
    syncing_1: "同期中...",
    syncing_2: "完了までお待ちください",
    enable: "クラウド同期を有効にする",
    save: "設定を保存",
    edit: "設定を編集",
    resync: "データを再同期",
    deleteDevices: "デバイスを管理",
    handshakeFailed: "接続試行に失敗しました",
    handshakeFailedDesc: "Firebaseサーバーに接続できませんでした。",
  },
  synceddevices: {
    title: "同期済みデバイス",
    lastSync: "最終同期: ",
    error_fetching: "デバイスの取得エラー",
  },
  createcategory: {
    title_create: "カテゴリーを作成",
    title_update: "カテゴリーを更新",
    name_title: "名前",
    name_placeholder: "ここにカテゴリー名を入力してください...",
    icon_title: "アイコン",
    notes_num: "ノート数: ",
  },
  organizecategory: {
    title: "整理",
  },
  trashednotes: {
    title: "削除されたノート",
    countdown: "削除まで: {{days}} 日間、{{hours}} 時間、{{minutes}} 分",
    settings: {
      delete_all: "すべて削除",
      restore_all: "すべて復元",
      delete_selected: "選択したものを削除",
      restore_selected: "選択したものを復元",
    },
  },
  webhooks: {
    title: "Webhooks",
    addTextNote: "テキストノートを追加",
    addTodoNote: "ToDoノートを追加",
    addKanbanNote: "カンバンノートを追加",
    updateNote: "ノートを更新",
    temporaryDeleteNote: "一時的にノートを削除",
    deleteNote: "ノートを削除",
    restoreNote: "ノートを復元",
    createCategory: "カテゴリーを作成",
    deleteCategory: "カテゴリーを削除",
    updateCategory: "カテゴリーを更新",
    exportData: "データをエクスポート",
    exporData: "データをエクスポート",
    importData: "データをインポート",
    wipeData: "データを削除",
  },
  generalsettings: {
    title: "設定",
    basic: "基本",
    cloudsync: "クラウド同期",
    temporary_trash_lifespan: "一時的なごみ箱の寿命",
    days: "日数",
    change_secret_code: "秘密のコードを変更",
    enable_fingerprint: "指紋認証を有効にする",
    advanced: "高度",
    show_hidden: "隠しノートを表示",
    export_import_data: "データのエクスポート/インポート",
    export_import_popup_title: "秘密のパスフレーズ",
    export_import_placeholder_input: "秘密のコードを入力してください...",
    export_popup_description: "ここに秘密のパスフレーズを入力してください。保存しないと、ノートを回復できなくなります。",
    import_popup_description: "ここに秘密のパスフレーズを入力してください。ノートをインポートするには保存してください。",
    webhooks: "Webhooks",
    voice_recognition: "音声認識",
    wipe_data: "データを削除",
    about: "について",
    about_the_app: "アプリについて",
    about_the_developer: "開発者について",
    check_updates: "更新を確認",
    feedback_and_help: "フィードバックとヘルプ",
    help: "ヘルプ",
    changelog: "変更履歴",
    report: "問題を報告",
    suggest: "友達に勧める",
  },
  info: {
    title: "情報",
    fastmemo: "Fast Memo",
    app: "アプリ",
    version: "バージョン",
    libraries: "ライブラリ",
  },
  aboutdeveloper: {
    title: "私について",
    freelance: "フリーランスウェブ開発者",
    information: "情報",
    developer: "開発者",
    website: "ウェブサイト",
  },
  voicerecognition: {
    title: "音声認識",
    enabled: "有効",
    interimResults: "リアルタイム文字起こし",
    continuous: "手動停止",
    language: "言語",
    language_default: "デフォルト（システム）",
  },
  help: {
    title: "ヘルプ",
    how_to_create_note: {
      title: "ノートを作成する方法",
      text_1_0: "ホームページの右下隅にある",
      text_1_1: "ボタンをクリックすることでノートを作成できます。",
      text_2_0: "新しいページが表示され、そこでノートのタイトルと説明を書くことができます。",
      text_3_0: "ホームページに戻って保存できます。",
    },
    how_to_create_todo_note: {
      title: "ToDoノートを作成する方法",
      text_1_0: "ホームページの右下隅にある",
      text_1_1: "ボタンをクリックすることでToDoノートを作成できます。",
      text_2_0: "新しいページが表示され、そこでノートのタイトルとToDoリストを書くことができます。",
      text_3_0: "アイテムの右側の6つのドットを押すと、それを上下に移動できます。",
      text_4_0: "右側のクロスボタンでそのアイテムを削除できます。",
      text_5_0: "ボトムのボタンは次のとおりです：",
      text_6_0: "• 追加：リストに新しいToDoアイテムが追加されます。",
      text_7_0: "• チェック済みの非表示/表示：チェック済みのToDoアイテムが非表示/表示されます。",
      text_8_0: "• 全て削除：ノートに含まれるすべてのToDoアイテムが削除されます。",
      text_9_0: "ホームページに戻って保存できます。",
    },
    how_to_edit_note: {
      title: "ノートを編集する方法",
      text_1_0: "ホームページでノートを選択することで編集できます。",
    },
    how_to_delete_note: {
      title: "ノートを削除する方法",
      text_1_0: "ノートを削除するには",
      text_1_1: "をクリックします。",
      text_2_0: "右上隅にあると、ノートを表示するときにポップアップメニューが開きます。最初のオプションが必要なものです。",
    },
    how_to_select_notes: {
      title: "ノートを選択する方法",
      text_1_0: "ノートを長押しすることでノートを選択できます。",
      text_2_0: " '編集モード'に移行し、重要な操作や読み取り専用、ロックなどのさまざまなアクションが可能です。",
    },
    what_toolbar_below: {
      title: "下のツールバーは何ですか？",
      text_1_0: "ツールバーはさまざまな方法でテキストを豊かにします。",
      text_2_0: "• 画像：ギャラリーから画像を挿入および切り取ることができます。",
      text_3_0: "• 太字：テキストを太字にできます。",
      text_4_0: "• イタリック：テキストを斜体にできます。",
      text_5_0: "• 下線：テキストに下線を引くことができます。",
      text_6_0: "• 下付き文字：テキストをテキストに対して下に配置できます。",
      text_7_0: "• 上付き文字：テキストをテキストに対して上に配置できます。",
      text_8_0: "• 箇条書きリスト：箇条書きリストを作成できます。",
      text_9_0: "• 番号付きリスト：番号付きリストを作成できます。",
      text_10_0: "• コード：フォーマットされたコードを記述できるラッパーを作成できます。",
    },
    what_are_settings_note: {
      title: "ノートの設定について",
      text_1_0: "ノートの設定は次のとおりです：",
      text_2_0: "• 削除：現在のノートを削除できます。",
      text_3_0: "• 重要：ノートを重要なものとして設定できます。",
      text_4_0: "• 保護：ノートをロックできます。有効になっていれば、コードまたは指紋が必要です。",
      text_5_0: "• 読み取り専用：ノートは変更できません。",
      text_6_0: "• カテゴリの変更：ノートのカテゴリを別のものに変更できます。",
      text_7_0: "• 共有：ノートのテキストを他のソーシャルアプリケーションに共有できます。",
    },
    how_create_category: {
      title: "カテゴリを作成する方法",
      text_1_0: "ホームページの左上にある",
      text_1_1: "をクリックすることで新しいカテゴリを作成できます。",
      text_2_0: " '整理'ページにリダイレクトされます。右下隅にある",
      text_2_1: "",
      text_3_0: "再度 'カテゴリの作成'ページにリダイレクトされます。名前を作成し、一意のアイコンを選択するよう求められます。",
      text_4_0: "フォームを記入した後、",
      text_4_1: "が右下隅に表示されます。新しいカテゴリを保存するには、それをクリックする必要があります。",
    },
    how_edit_category: {
      title: "カテゴリを編集する方法",
      text_1_0: "ホームページの左上にある",
      text_1_1: "をクリックすることでカテゴリを編集できます。",
      text_2_0:
        " '整理'ページにリダイレクトされます。カテゴリを選択すると、再度 'カテゴリの更新'ページにリダイレクトされます。",
    },
    how_organize_categories: {
      title: "カテゴリを整理する方法",
      text_1_0: "ホームページの左上にある",
      text_1_1: "をクリックすることでカテゴリを編集できます。",
      text_2_0: " '整理'ページにリダイレクトされます。'整理モード'に移行するには、",
      text_2_1: "をクリックする必要があります。",
      text_3_0:
        "カテゴリをクリックすると、それは '番号なし' になります。カテゴリの順序を変更するには、別のカテゴリをクリックできます。",
      text_4_0: "編集が完了したら、",
      text_4_1: "をクリックして変更を保存できます。",
      text_5_0: "変更を元に戻す場合は、",
      text_5_1: "をクリックできます。",
    },
    how_delete_category: {
      title: "カテゴリを削除する方法",
      text_1_0: "ホームページにいるときは、カテゴリを長押しして、'編集モード'に移行できます。",
      text_2_0:
        "をクリックすると、ポップアップが表示され、カテゴリとそのノートを削除するか、すべてのノートに移動するかを尋ねられます。",
      text_2_1:
        "ポップアップが表示され、カテゴリとそのノートを削除するか、すべてのノートをすべてのノートに移動するかを尋ねられます。",
    },
    what_are_trashed_notes: {
      title: "ゴミ箱のノートとは？",
      text_1_0: "ノートを削除すると、それはゴミ箱のノートに移動します。すべてのノートが一時的に移動するビンです。",
      text_2_0: "デフォルトでは、それらは7日間だけ続き、その後消えます。この設定は基本設定から変更できます。",
    },
    how_restore_trashed_notes: {
      title: "ごみ箱からノートを復元する方法",
      text_1_0:
        "「ごみ箱」ページにいるとき、ノートを選択して、ポップアップが表示され、そのノートを復元するかどうかを尋ねます。",
      text_2_0: "ノートを長押しして複数のノートを復元することもできます。右上のアイコン",
      text_2_1: "をクリックします。",
      text_3_0: "ポップアップが表示され、2番目のオプションが目的のものです。",
      text_4_0: "また、ゴミ箱にあるすべてのノートを復元することもできます。右上のアイコン",
      text_4_1: "をクリックします。",
      text_5_0: "ポップアップが表示され、2番目のオプションが目的のものです。",
    },
    how_restore_delete_notes: {
      title: "削除されたノートを復元する方法",
      text_1_0: "「ごみ箱」ページにいるとき、ノートを長押しすると、「編集モード」に入り、削除したいノートを選択できます。",
      text_2_0: "右上のアイコン",
      text_2_1: "をクリックします。",
      text_3_0: "ポップアップが表示され、最初のオプションが目的のものです。",
      text_4_0: "また、ゴミ箱にあるすべてのノートを削除することもできます。右上のアイコン",
      text_4_1: "をクリックします。",
      text_5_0: "ポップアップが表示され、2番目のオプションが目的のものです。",
    },
    what_cloud_sync: {
      title: "クラウド同期とは何ですか？",
      text_1_0: "Google Firebaseアカウントを接続し、同期モードを有効にすることで、ノートを同期できます。",
      text_2_0: "他に何もする必要はありません。ノートはGoogle Firebaseに保存され、暗号化されます。",
    },
    what_secret_code: {
      title: "秘密コードとは何ですか？",
      text_1_0: "ロックされたノートには、最初にアプリを開いたときに生成した秘密コードが必要です。",
      text_2_0: "基本設定から変更できます。",
    },
    what_import_export: {
      title: "インポート/エクスポートデータとは何ですか？",
      text_1_0: "ローカルにデータをインポートまたはエクスポートできます。",
      text_2_0: "エクスポートすると、保存先フォルダにファイルが生成されます。",
      text_3_0: "デフォルトでは暗号化されます。インポートにはパスフレーズが必要です。",
    },
    what_wipe_data: {
      title: "データを消去するとは何ですか？",
      text_1_0: "すべてのノートとカテゴリを消去できます。",
      text_2_0: "アクションを実行するかどうかを確認するためのポップアップが表示されます。",
      text_3_0: "それらは永久に削除されます。",
    },
  },
  report: {
    title: "問題を報告する",
    question: "問題のトピックは何ですか？",
    topic: {
      crash: "クラッシュ",
      notes: "ノート",
      categories: "カテゴリ",
      cloud: "クラウド",
      webhooks: "Webフック",
      export_import: "エクスポート/インポート",
      translations: "翻訳",
      suggestions: "提案",
      other: "その他",
    },
    descriptionPlaceholder: "詳細に問題を説明してください（必須）",
    deviceInfoCheckbox: "より正確な診断のため、デバイスの詳細を提供してください。",
    attachments: "画像を追加",
    sendReport: "レポートを送信",

    sent_message_1: "レポートの送信ありがとうございます。",
    sent_message_2: "また、レポートは以下の日から送信できます:",

    attachments_limit: "添付ファイルの制限:",
    size_limit: "画像あたりのサイズ制限:",
    loading: "読み込み中...",

    messages: {
      size: {
        title: "ファイルが大きすぎます！",
        text: "より小さいファイルを選択するか、圧縮してください。",
      },
      success: {
        title: "成功！",
        text: "レポートが正常に送信されました。",
      },
      error: {
        title: "エラー！",
        text: "レポートを送信できませんでした。",
      },
      missing: {
        title: "データが不足しています！",
        text: "問題のトピックと説明を入力してください。",
      },
    },
  },

  /* popup */
  popup: {
    delete_category: "このカテゴリを削除しますか？\nノートを 'ALL' カテゴリに移動できます",
    restore_single_note: "このノートを復元しますか？",
    restore_notes: "これらのノートを復元しますか？",
    delete_notes: "これらのノートを削除しますか？",
    delete_notes_perma: "これらのノートを完全に削除しますか？",
    restore_all_notes: "すべてのノートを復元しますか？",
    delete_all_notes_perma: "すべてのノートを完全に削除しますか？",
    select_one_option: "1つのオプションを選択してください",
    passphrase_wrong: "入力したパスフレーズが間違っています。",
    are_you_sure_wipe: "データを消去してもよろしいですか？\n作成されたすべてのノートとカテゴリが失われます。",
    finish_organize_categories: "カテゴリの整理を完了するか、変更を元に戻します。",
    generic_success_description: "操作は成功しました。",
  },

  /* generic */
  All: "すべて",
  delete_and_move: "削除して移動",
  delete_with_notes: "ノートと一緒に削除",
  ok: "OK",
  confirm: "確認",
  cancel: "キャンセル",
  delete: "削除",
  restore: "復元",
  warning: "警告",
  error: "エラー",
  import: "インポート",
  export: "エクスポート",
  retry: "再試行",
  wipe: "すべて消去",
  wipeWithCloud: "消去 + クラウド",
  loading: "読み込み中...",

  /* toast */
  disconnected: "クラウドから切断されました",
  dataSynced: "データが同期されました",
  noInternetConnection: "インターネットに接続していません",
  devicesLimitReached: "デバイスの制限に達しました",
  noteLimitReached: "ノートの制限に達しました",

  empty_title: "(タイトルなし)",
};

export default ja;
