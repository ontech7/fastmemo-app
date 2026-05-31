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
      description_1_1_1: `• オフラインノートを追加。ノートをこの端末だけに保存し、クラウドには同期しません。
• 音声認識 2.0：音声入力を刷新し、AI による自動整形に対応。
• AI アシスタントがノートのタイトルからカテゴリを提案できるようになりました。
• テキストエディタに元に戻す/やり直しと取り消し線を追加。
• デスクトップのロック解除が Touch ID と Windows Hello に対応しました。
• 各種修正。`,

      description_1_0_0: `• Fast Memo Desktop の初の安定版をリリース（BETA を卒業）。
• 全画面を刷新した新しいモダンデザイン。新フォント Geist、グラス調の表面、グラデーションを採用。
• 紹介ステップを刷新したオンボーディング。
• 新規ノートの初期設定をカスタマイズできるノート作成設定を追加。
• To-Do ノートにステップモードを追加。
• 各種修正。`,

      description_0_3_0: `• 新しいノートタイプ「コード」を追加。エディタ内蔵、シンタックスハイライト、複数タブ、言語自動検出に対応。
• テキストノートに検索と置換機能を追加。
• ノートのエクスポート機能を追加。
• 各種修正。`,

      description_0_2_0: `• カンバンの列を移動できるようになりました。
• アニメーションを改善しました。
• 各種修正。`,

      description_0_1_1: `• アプリ起動時のクラウド同期を修正しました。
• 同期のたびに、ノートが正しく並び替えられるようになりました。`,

      description_0_1_0: `• Fast Memo Desktop（BETA）の初期リリース。モバイルのすべての機能を備えています。`,
    },

    mobile: {
      description_3_1_1: `• オフラインノートを追加。ノートをこの端末だけに保存し、クラウドには同期しません。
• 音声認識 2.0：音声入力を刷新し、AI による自動整形に対応。
• AI アシスタントがノートのタイトルからカテゴリを提案できるようになりました。
• テキストエディタに元に戻す/やり直しと取り消し線を追加。
• 各種修正。`,

      description_3_0_0: `• 全画面を刷新した新しいモダンデザイン。新フォント Geist、グラス調の表面、グラデーションを採用。
• 紹介ステップを刷新したオンボーディング。
• 新規ノートの初期設定をカスタマイズできるノート作成設定を追加。
• To-Do ノートにステップモードを追加。
• アプリアイコンとスプラッシュ画面を刷新。
• 各種修正。`,

      description_2_9_1: `• 新しいノートタイプ「コード」を追加。エディタ内蔵、シンタックスハイライト、複数タブ、言語自動検出に対応。
• Qwen 2.5 7BモデルとデバイスRAM検出を追加。コード向け新AIアクション：コードの説明とコメント追加。
• テキストノートに検索と置換機能を追加。
• ノートのエクスポート機能を追加。
• 各種修正。`,

      description_2_8_0: `• セルフホスト型AIアシスタント（Qwen 2.5）を追加。ノート向けスマート機能搭載。設定 -> AIアシスタントから設定できます。
• カンバンの列を移動できるようになりました。
• アニメーションを改善しました。
• 各種修正。`,

      description_2_7_1: `• アプリ起動時のクラウド同期を修正しました。
• 同期のたびに、ノートが正しく並び替えられるようになりました。`,

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
    step4: "カンバンボードでアイデアを視覚化します。",
    step5: "スニペットをメモします。",
    step6: "必要に応じて独自のカテゴリを作成します。",
    step7: "メモを非表示にするための秘密コードを挿入します。",
    step8: "Google Firebaseでメモを同期します。",
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
    selected_count: "{{count}}件選択",

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
    mode_free: "リスト",
    mode_steps: "ステップ",
    ongoing: "進行中",
    created: "作成: ",
    updated: "更新: ",
    type: {
      todo: "リスト",
      kanban: "カンバン",
      text: "テキスト",
      code: "コード",
    },
    settings: {
      delete: "削除",
      important: "重要",
      protect: "保護",
      readonly: "読み取り専用",
      hide: "非表示",
      make_offline: "オフラインにする",
      sync_to_cloud: "クラウドに同期",
      made_offline: "ノートはオフラインになりました",
      synced_as_duplicate: "コピーとしてクラウドに同期しました",
      changecategory: "カテゴリを変更",
      share: "共有",
      export: "エクスポート",
      export_description: "エクスポート形式を選択してください",
      export_txt: "プレーンテキスト (.txt)",
      info: "情報",
    },
    info: {
      title: "情報",
      type: "種類",
      category: "カテゴリ",
      created: "作成日",
      updated: "更新日",
      flags: "フラグ",
      no_flags: "なし",
      offline: "オフライン",
      close: "閉じる",
    },
    find_replace: {
      search_placeholder: "検索...",
      replace_placeholder: "置換...",
      replace_short: "置換",
      replace_one: "置換",
      replace_all: "全て",
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
  code: {
    add_tab: "タブを追加",
    tab_title_placeholder: "ファイル名",
    code_placeholder: "ここにコードを入力...",
    max_tabs_reached: "タブは最大6つまでです",
    delete_tab: "タブを削除",
    delete_tab_confirm: "このタブを削除してもよろしいですか？この操作は取り消せません。",
    language: "言語",
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
    upToDate: "最新",
    pending: "{{count}} 件保留中",
    mostRecent: "最も新しい",
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
    addKanbanNote: "カンバンノー��を追加",
    addCodeNote: "コードノートを追加",
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
    fingerprint_reason: "メモのロックを解除",
    advanced: "高度",
    show_hidden: "隠しノートを表示",
    export_import_data: "データのエクスポート/インポート",
    export_import_popup_title: "秘密のパスフレーズ",
    export_import_placeholder_input: "秘密のコードを入力してください...",
    export_popup_description: "ここに秘密のパスフレーズを入力してください。保存しないと、ノートを回復できなくなります。",
    import_popup_description: "ここに秘密のパスフレーズを入力してください。ノートをインポートするには保存してください。",
    webhooks: "Webhooks",
    voice_recognition: "音声認識",
    ai_assistant: "AIアシスタント",
    note_creation: "ノート作成",
    wipe_data: "データを削除",
    developer_options: "開発者オプション",
    about: "について",
    about_the_app: "アプリについて",
    about_the_developer: "開発者について",
    check_updates: "更新を確認",
    checking_updates: "確認中...",
    update_available: "アップデートあり",
    update_confirm: "今すぐインストールしますか？",
    no_updates: "最新バージョンを使用しています。",
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
  note_creation: {
    title: "ノート作成",
    mode_section: "モード",
    default_type_section: "既定のノート種類",
    mode: {
      simple: "シンプル",
      simple_description: "タップでテキストノートを作成。他の種類はメニューから。",
      smart: "スマート",
      smart_description: "タップで常に下で選んだ種類を作成。",
      adaptive: "アダプティブ",
      adaptive_description: "タップで前回と同じ種類のノートを作成。",
    },
  },
  aboutdeveloper: {
    title: "私について",
    freelance: "フリーランスウェブ開発者",
    information: "情報",
    developer: "開発者",
    website: "ウェブサイト",
    openLink: "リンクを開く",
  },
  ai: {
    title: "AIアシスタント",
    model: "モデル",
    status: "ステータス",
    settings: "設定",
    enabled: "有効",
    downloaded: "ダウンロード済み",
    not_downloaded: "未ダウンロード",
    downloading: "ダウンロード中...",
    download_model: "モデルをダウンロード",
    cancel: "キャンセル",
    delete_model: "モデルを削除",
    info: "AIアシスタントはデバイス上で完全に動作します。外部サーバーにデータは送信されません。モデルは一度ダウンロードする必要があり（約400 MB）、ローカルに保存されます。",
    model_light: "高速、基本品質。3GB以上のRAMが必要。",
    model_powerful: "速度と品質のバランス。4GB以上のRAMが必要。",
    model_advanced: "高品質。6GB以上のRAMが必要。",
    model_pro: "最高品質、デスクトップ級の性能。8GB以上のRAMが必要。",
    model_unavailable: "このデバイスのRAMが不足しています",
    capabilities_title: "何ができますか？",
    cap: {
      generate_title: "ノート内容からタイトルを生成",
      summarize: "テキストノートを数文で要約",
      fix_grammar: "スペルと文法を修正",
      shorten: "テキストを短く簡潔にする",
      translate: "ノートをアプリの言語に翻訳",
      suggest_items: "チェックリストの新しい項目を提案",
      suggest_category: "ノートに最適なカテゴリを提案",
      voice_cleanup: "口述テキストを句読点付きで整える",
      explain_code: "コードの動作を説明",
      add_comments: "コードにコメントを追加",
    },
    unavailable_web: "AIアシスタントはモバイルデバイスでのみ利用可能です。",
    native_rebuild_needed: "AIアシスタントにはネイティブリビルドが必要です。\n実行: npx expo run:android",
    voice_only: "音声のみ",
    voice_only_hint: "音声のみでアシスタントと対話",
    listening: "聞いています...",
    tap_to_speak: "マイクをタップして話す",
    sending_soon: "送信中...",
    placeholder: "何をしたいですか？",
    processing: "考え中...",
    feedback: {
      note_created: "ノート「{{title}}」を作成しました",
      property_toggled: "{{count}}件のノートを更新しました",
      note_deleted: "{{count}}件のノートをゴミ箱に移動しました",
      category_changed: "{{count}}件のノートを移動しました",
      done: "完了",
      note_renamed: "ノートを「{{title}}」に名前変更しました",
      items_added: "{{count}}件のアイテムを追加しました",
      category_created: "カテゴリ「{{name}}」を作成しました",
      note_restored: "{{count}}件のノートを復元しました",
      category_switched: "「{{name}}」に切り替えました",
      no_notes_found: "一致するノートが見つかりません",
      category_not_found: "カテゴリが見つかりません",
      not_todo_note: "そのノートはチェックリストではありません",
      category_exists: "カテゴリは既に存在します",
      note_converted: "ノート「{{title}}」を変換しました",
      notes_merged: "ノートを「{{title}}」に統合しました",
      setting_changed: "設定を更新しました",
      help_message:
        "ノート、リスト、ボードの作成、削除、名前変更、変換、統合などができます。\n試してみて：「牛乳とパンの買い物リストを作成」\n全機能は設定 > AIアシスタントをご覧ください。",
      same_type: "ノートは既にそのタイプです",
      not_understood: "ノートに関するお手伝いのみ可能です",
      error: "問題が発生しました。もう一度お試しください",
      voice_unavailable: "音声が利用できません",
    },
    editor: {
      generate_title: "タイトルを生成",
      summarize: "要約する",
      suggest_items: "項目を提案",
      suggest_category: "カテゴリを提案",
      explain_code: "コードを説明",
      add_comments: "コメントを追加",
      fix_grammar: "文法を修正",
      shorten: "短くする",
      translate: "翻訳",
      min_model: "最低",
      before: "変更前",
      after: "変更後",
      apply: "適用",
      no_content: "まず何か書いてください",
      no_category_match: "該当するカテゴリが見つかりません",
      error: "生成できませんでした。もう一度お試しください",
    },
  },
  voicerecognition: {
    title: "音声認識",
    enabled: "有効",
    interimResults: "リアルタイム文字起こし",
    continuous: "手動停止",
    language: "言語",
    language_default: "デフォルト（システム）",
    dictation: {
      listening: "聞き取り中…",
      paused: "一時停止",
      hint: "話してください。",
      insert: "挿入",
      cancel: "キャンセル",
      ai_cleanup: "AIで整える",
      processing: "処理中…",
    },
  },
  help: {
    title: "ヘルプ",
    search_placeholder: "どのようなご用件ですか？",
    no_results: "結果がありません。別の言葉でお試しください。",
    search_placeholders: [
      "検索、または必要なことを入力…",
      "ノートはどう作成しますか？",
      "ツールバーは何に使いますか？",
      "クラウド同期の仕組みは？",
      "削除したノートはどう復元しますか？",
    ],
    ai_thinking: "AIで検索中…",
    ai_results: "AIの結果 · タップでクリア",
    ai_invite_title: "お探しのものが見つかりませんか？",
    ai_invite_subtitle: "自分の言葉で説明すると、AIアシスタントが適切なトピックを見つけます。",
    cat_notes: "ノート",
    cat_editor: "エディタと書式",
    cat_categories: "カテゴリ",
    cat_trash: "ゴミ箱",
    cat_cloud: "クラウド同期と暗号化",
    cat_data: "セキュリティとデータ",
    cat_settings: "設定",
    cat_more: "その他と情報",
    cat_ai: "AI アシスタント",
    how_to_create_note: {
      title: "ノートを作成するには？",
      text_1_0: "ホーム画面の右下にある",
      text_1_1: "ボタンをタップします。",
      text_2_0: "新しいページが開き、タイトルを付けてノートを書くことができます。",
      text_3_0: "保存するには、ホーム画面に戻るだけです。",
    },
    how_to_create_todo_note: {
      title: "ToDoリストを作成するには？",
      text_1_0: "ホーム画面の右下にある",
      text_1_1: "ボタンをタップします。",
      text_2_0: "新しいページが開き、タイトルとToDo項目を追加できます。",
      text_3_0: "項目の右側にある6つのドットをドラッグすると、上下に移動できます。",
      text_4_0: "右側の×印をタップすると、その項目を削除できます。",
      text_5_0: "下部のボタンでは次のことができます：",
      text_6_0: "• 追加 — リストに新しい項目を追加します。",
      text_7_0:
        "• モードを切り替え — リスト（従来のチェックリスト）とステップ（順番に完了する番号付きの順次リスト）を切り替えます。",
      text_8_0: "• すべて削除 — リスト内のすべての項目を削除します。",
      text_9_0: "保存するには、ホーム画面に戻るだけです。",
    },
    how_to_create_kanban_note: {
      title: "カンバンボードを作成するには？",
      text_1_0: "ホーム画面の右下にある",
      text_1_1: "ボタンをタップして「カンバン」を選びます。",
      text_2_0: "すぐに使える列が1つあるボードが開きます。",
      text_3_0: "• 列を追加 — 右側の「列を追加」をタップします（最大10列）。",
      text_4_0: "• 列の名前を変更 — ヘッダーのテキストを編集します。",
      text_5_0: "• 列の色を変更 — ヘッダーの色付きの四角をタップします。",
      text_6_0: "• カードを追加 — 列の下部にある「カードを追加」をタップします。",
      text_7_0: "• カードを移動 — カードを長押ししてから、別の列にドラッグします。",
      text_8_0: "• カードを削除 — カードのゴミ箱アイコンをタップします。",
      text_9_0: "• 列を削除 — ヘッダーのゴミ箱アイコンをタップします。",
      text_10_0: "ボードを保存するには、ホーム画面に戻るだけです。",
    },
    how_to_create_code_note: {
      title: "コードノートを作成するには？",
      text_1_0: "ホーム画面の右下にある",
      text_1_1: "ボタンをタップして「コード」を選びます。",
      text_2_0: "構文ハイライト付きの本格的なコードエディタが使えます。",
      text_3_0:
        "• タブ — 1つのノートに複数のスニペットをまとめられます。追加・名前変更・削除や、ドラッグして並べ替えができます（最大6つ）。",
      text_4_0: "• 言語 — 言語バーをタップして選ぶか、自動で検出させることができます。",
      text_5_0: "• 検索と置換 — テキストノートと同じように、上部の検索アイコンをタップします。",
      text_6_0: "保存するには、ホーム画面に戻るだけです。",
    },
    how_to_edit_note: {
      title: "ノートを編集するには？",
      text_1_0: "ホーム画面でノートをタップして開き、変更を加えるだけです。",
    },
    how_to_delete_note: {
      title: "ノートを削除するには？",
      text_1_0: "ノートを表示している状態で、右上の",
      text_1_1: "をタップします。",
      text_2_0: "メニューが開き、「削除」が最初のオプションです。",
    },
    how_to_select_notes: {
      title: "複数のノートを一度に選択するには？",
      text_1_0: "いずれかのノートを長押しすると、選択を開始できます。",
      text_2_0:
        "これで選択モードがオンになり、複数のノートをまとめて操作できます。削除したり、重要・読み取り専用・ロックに設定したりできます。",
    },
    what_are_hidden_notes: {
      title: "非表示ノートはどのように機能しますか？",
      text_1_0: "ノートのオプションメニューを開いて「非表示」をタップすると、ホーム画面に表示されなくなります。",
      text_2_0: "非表示ノートを再び見るには、詳細設定で「非表示ノートを表示」をオンにします。これには秘密コードが必要です。",
    },
    what_toolbar_below: {
      title: "下部のツールバーは何ですか？",
      text_1_0: "テキストを書式設定して豊かにできます。各ボタンの機能は次のとおりです：",
      text_2_0: "• 元に戻す / やり直し — 直近の変更を前後に移動します。",
      text_3_0: "• 画像 — ギャラリーから写真を挿入します。",
      text_4_0: "• 太字 — 選択したテキストを太字にします。",
      text_5_0: "• イタリック — 選択したテキストを斜体にします。",
      text_6_0: "• 取り消し線 — 選択したテキストに取り消し線を引きます。",
      text_7_0: "• 下線 — 選択したテキストに下線を引きます。",
      text_8_0: "• 下付き文字 — テキストを行よりわずかに下に配置します。",
      text_9_0: "• 上付き文字 — テキストを行よりわずかに上に配置します。",
      text_10_0: "• 箇条書き — 箇条書きリストを開始します。",
      text_11_0: "• 番号付きリスト — 番号付きリストを開始します。",
      text_12_0: "• コード — テキストを書式付きのコードブロックで囲みます。",
    },
    what_find_replace: {
      title: "テキストを検索して置換するには？",
      text_1_0: "テキストノートまたはコードノートを編集中に、右上の検索アイコンをタップします。",
      text_2_0: "探したい語句を入力します。矢印で一致箇所を移動でき、件数も表示されます。",
      text_3_0: "「置換」をオンにすると、現在の一致箇所を置き換えるか、すべての一致箇所を一度に置き換えられます。",
    },
    what_are_settings_note: {
      title: "ノートのオプションは何ですか？",
      text_1_0: "ノートを開き、右上の ⋮ メニューをタップします。そこから次のことができます：",
      text_2_0: "• 削除 — ノートをゴミ箱に移動します。",
      text_3_0: "• 重要 — ノートに印を付けて、上部で目立つようにします。",
      text_4_0: "• 保護 — 秘密コードや指紋でノートをロックします。",
      text_5_0: "• 読み取り専用 — 誤ってノートが編集されないようにします。",
      text_6_0: "• 非表示 — 非表示ノートを表示するまで、ノートをホーム画面から隠します。",
      text_7_0: "• オフラインにする — ノートをこのデバイスだけに保存し、クラウドには同期しません。",
      text_8_0: "• カテゴリの変更 — ノートを別のカテゴリに移動します。",
      text_9_0: "• エクスポート（テキストノート） — ノートを .txt、Markdown、PDF ファイルとして保存します。",
      text_10_0: "• 情報 — ノートの種類・カテゴリ・日付を確認します。",
    },
    how_create_category: {
      title: "カテゴリを作成するには？",
      text_1_0: "ホーム画面で、左上の",
      text_1_1: "をタップします。",
      text_2_0: "「整理」ページが開きます。そこで、右下の",
      text_2_1: "をタップします。",
      text_3_0: "「カテゴリの作成」ページで名前を付け、まだ使われていないアイコンを選びます。",
      text_4_0: "完了したら、右下の",
      text_4_1: "をタップして保存します。",
    },
    how_edit_category: {
      title: "カテゴリを編集するには？",
      text_1_0: "ホーム画面で、左上の",
      text_1_1: "をタップします。",
      text_2_0:
        "「整理」ページで、変更したいカテゴリをタップします。編集ページが開き、名前を変更したり、新しいアイコンを選んだりできます。",
    },
    how_organize_categories: {
      title: "カテゴリを並べ替えるには？",
      text_1_0: "ホーム画面で、左上の",
      text_1_1: "をタップします。",
      text_2_0: "「整理」ページで、",
      text_2_1: "をタップして整理モードに入ります。",
      text_3_0: "カテゴリをタップして持ち上げ、別のカテゴリをタップしてそこに置くと、順序を変更できます。",
      text_4_0: "希望の順序になったら、",
      text_4_1: "をタップして保存します。",
      text_5_0: "変更を破棄するには、右上の",
      text_5_1: "をタップします。",
    },
    how_delete_category: {
      title: "カテゴリを削除するには？",
      text_1_0: "ホーム画面で、カテゴリを長押しして選択モードに入ります。",
      text_2_0: "次に",
      text_2_1: "をタップし、ノートごとカテゴリを削除するか、ノートを「すべて」に移動して残すかを選びます。",
    },
    what_are_trashed_notes: {
      title: "ゴミ箱とは何ですか？",
      text_1_0: "ノートを削除しても、すぐには消えません。まずゴミ箱に移動します。",
      text_2_0: "ノートはそこに7日間残り、その後完全に削除されます。保管期間は基本設定で変更できます。",
    },
    how_restore_trashed_notes: {
      title: "削除したノートを復元するには？",
      text_1_0: "「ゴミ箱」ページを開いてノートをタップすると、復元するかどうかを尋ねられます。",
      text_2_0: "複数を一度に復元するには、ノートを長押しして対象を選び、右上の",
      text_2_1: "をタップします。",
      text_3_0: "表示されるメニューで「復元」を選びます。",
      text_4_0: "すべてを一度に戻すには、右上の",
      text_4_1: "をタップします。",
      text_5_0: "表示されるメニューで「すべて復元」を選びます。",
    },
    how_restore_delete_notes: {
      title: "ゴミ箱からノートを完全に削除するには？",
      text_1_0: "「ゴミ箱」ページを開き、ノートを長押しして選択モードに入り、削除する対象を選びます。",
      text_2_0: "右上の",
      text_2_1: "をタップします。",
      text_3_0: "表示されるメニューで「削除」を選びます。",
      text_4_0: "ゴミ箱全体を一度に空にするには、右上の",
      text_4_1: "をタップします。",
      text_5_0: "表示されるメニューで「すべて削除」を選びます。",
    },
    what_cloud_sync: {
      title: "クラウド同期とは何ですか？",
      text_1_0:
        "自分の Google Firebase プロジェクトを接続して同期を有効にすると、デバイス間でノートを同期できます。Fast Memo の中央サーバーは存在せず、データはあなたの Firebase の中だけにあります。",
      text_2_0: "ノートはアップロード前にデバイス上でエンドツーエンド暗号化されるため、あなた以外の誰も読むことはできません。",
      text_link: "Google Firebase の設定手順ガイドを読む →",
    },
    what_encryption: {
      title: "ノートはどのように暗号化されますか？",
      text_1_0:
        "クラウド同期はエンドツーエンド暗号化を使用します。初回設定時に暗号化パスワードを選び、デバイスがそこからノートを保護する鍵を導出します。",
      text_2_0:
        "鍵はデバイスから出ることはなく、クラウドにも保存されないため、あなたの Firebase にアクセスできる人でも、パスワードなしにノートの内容を読むことはできません。",
      text_3_0: "ノートの内容は暗号化されます。タイトルと日付は、アプリが並べ替えと同期を行えるように読み取り可能なままです。",
    },
    how_unlock_device: {
      title: "なぜデバイスごとに解錠が必要なのですか？",
      text_1_0:
        "各デバイスはパスワードを入力して一度だけ暗号化を解錠します。その後、鍵はデバイスに安全に保存される（Keychain / Keystore）ため、起動のたびに再入力する必要はありません。",
      text_2_0:
        "デバイスが解錠されていない場合、そのデバイスでの同期は解錠するまで一時停止されます。これによりノートが読めない状態で保存されるのを防ぎます。",
    },
    forgot_password: {
      title: "暗号化パスワードを忘れました",
      text_1_0: "暗号化を設定すると、リカバリーキーが一度だけ表示されます。安全な場所に保管してください。",
      text_2_0:
        "解錠画面で「パスワードを忘れた場合」を選び、リカバリーキーを入力して新しいパスワードを設定します。ノートは失われません。",
      text_3_0:
        "パスワードとリカバリーキーの両方を失うと、クラウドのノートは誰にも復号できません。これがエンドツーエンド暗号化の意義です。",
    },
    reset_encryption: {
      title: "暗号化のリセットは何をしますか？",
      text_1_0: "リセットは、パスワードとリカバリーキーの両方を失った場合の最終手段です。",
      text_2_0:
        "現在このデバイスにあるノートから新しい暗号化設定を作成し、クラウドのコピーを置き換えます。もう復号できない古いクラウドのノートは削除されます。",
      text_3_0:
        "ローカルのノートは保持されて再アップロードされるため、このデバイスは何も失いませんが、他のデバイスは新しいパスワードで再度解錠する必要があります。",
    },
    quick_backup: {
      title: "クイックバックアップとは何ですか？",
      text_1_0: "暗号化の設定・解錠・リセットの各画面に、任意の「クイックバックアップ」ボタンがあります。",
      text_2_0:
        "パスフレーズで保護されたノートのファイルを、クラウドとは独立してこのデバイスから直接エクスポートします。大規模な同期やリセットの前のセーフティネットです。いずれにせよ、ノートは常にこのデバイスに保存されたままです。",
    },
    what_secret_code: {
      title: "秘密コードとは何ですか？",
      text_1_0: "最初にアプリを開いたときに設定したコードで、ロックしたノートを開くときに必要になります。",
      text_2_0: "基本設定からいつでも変更できます。",
    },
    what_import_export: {
      title: "インポートとエクスポートとは何ですか？",
      text_1_0: "データのコピーを保存したり、復元したりを、このデバイス上で直接行えます。",
      text_2_0: "エクスポートすると、選んだフォルダにファイルが保存されます。",
      text_3_0: "ファイルは常に暗号化されます。再びインポートするには、設定したパスフレーズが必要です。",
    },
    how_export_note: {
      title: "単一のノートをエクスポートするには？",
      text_1_0: "テキストノートを開き、オプションメニューをタップして「エクスポート」を選びます。",
      text_2_0: "次に、希望の形式を選びます：",
      text_3_0: "• プレーンテキスト（.txt） — 書式なしのテキストだけ。",
      text_4_0: "• Markdown（.md） — 見出しや基本的な書式を保持します。",
      text_5_0: "• PDF — 共有にすぐ使える、整った文書。",
      text_6_0: "ファイルはデバイスを通じて共有されるので、好きな場所に保存したり送ったりできます。",
    },
    what_wipe_data: {
      title: "データの消去は何をしますか？",
      text_1_0: "このデバイスからすべてのノートとカテゴリを一括で削除します。",
      text_2_0: "元に戻せないため、まず確認を求められます。",
      text_3_0: "確認すると、すべてが完全に削除されます。",
    },
    what_note_creation: {
      title: "ノート作成の設定は何をしますか？",
      text_1_0: "ホーム画面で [+] ボタンをタップしたときの動作を決めます。設定 → ノート作成で次から選べます：",
      text_2_0: "• シンプル — [+] でテキストノートを作成します。他の種類はメニューから使います。",
      text_3_0: "• スマート — [+] で、お気に入りに選んだ種類を常に作成します。",
      text_4_0: "• 適応型 — [+] で、最後に扱ったノートと同じ種類を作成します。",
    },
    what_home_filters: {
      title: "ホームのフィルターはどのように機能しますか？",
      text_1_0: "ホーム画面上部のフィルターアイコンをタップすると、ノートの表示方法を変更できます。",
      text_2_0: "• 並べ替え — 作成日または最終更新で、昇順または降順に並べ替えます。",
      text_3_0: "• 詳細検索 — タイトルだけでなく、ノートの内容やリストの中も検索します（最初に秘密コードを求められます）。",
    },
    what_language: {
      title: "言語を変更するには？",
      text_1_0: "基本設定を開き、「言語」をタップして切り替えます。",
      text_2_0:
        "デバイスの言語に自動で従うか、利用可能な7言語（英語、イタリア語、スペイン語、フランス語、ドイツ語、中国語、日本語）から1つを選べます。",
    },
    what_version_check: {
      title: "アプリは更新を確認しますか？",
      text_1_0: "はい。Fast Memo を開くと、新しいバージョンがあるかどうかを静かに確認します。",
      text_2_0: "更新があると、「新着情報」画面に変更点が表示されます。設定からいつでも確認することもできます。",
    },
    what_report_problem: {
      title: "問題を報告するには？",
      text_1_0: "設定 → 問題を報告 に進みます。",
      text_2_0:
        "トピックを選んで、何が起きたかを説明し、必要に応じてスクリーンショットやデバイス情報を添付すると、調査に役立ちます。",
      text_3_0: "送信できる報告は1日1件です。",
    },
    what_webhooks: {
      title: "Webhook とは何ですか？",
      text_1_0:
        "Webhook は上級者向けの機能です。ノートの作成・更新・削除、カテゴリの変更、データのエクスポートなど、何かが起きるたびに Fast Memo が別のサービスに通知できます。",
      text_2_0: "各アクションは、任意の Web アドレスを呼び出せます。設定 → Webhook で設定します。",
    },
    what_platforms: {
      title: "Fast Memo はどこで使えますか？",
      text_1_0: "Fast Memo はモバイルとデスクトップ（Windows、macOS、Linux）の両方に加え、Web 版でも使えます。",
      text_2_0: "各デバイスで同じ Google Firebase プロジェクトを接続すれば、どこでもノートが同期されたままになります。",
    },
    what_ai_assistant: {
      title: "AIアシスタントとは？",
      text_1_0:
        "Fast Memoにはデバイス上で完全に動作するセルフホスト型AIアシスタントが搭載されています。外部サーバーにデータは送信されません。",
      text_2_0: "設定するには、設定 -> AIアシスタントに移動し、モデルを選択してダウンロードしてください。",
      text_3_0:
        "有効にすると、各ノートエディター内にスパークルボタンが表示されます。タップすると、タイトル生成、要約、続きを書く、テキスト整形、チェックリスト項目の提案、カテゴリの提案などのスマート機能にアクセスできます。",
      text_4_0: "AIはオフラインで動作し、複数の言語をサポートしています。",
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

  developeroptions: {
    title: "開発者オプション",
    warning:
      "これらのオプションは、特定のノートのクラウド同期に影響を与えたり、アプリのパフォーマンスに影響する可能性があります。",
    unlimited_text_space: "無制限のテキストスペース",
    unlimited_text_space_desc: "現在の制限：1 MB",
    unlimited_kanban_columns: "無制限のカンバン列",
    unlimited_kanban_columns_desc: "現在の制限：10 列",
    unlimited_trash_time: "無制限のゴミ箱期間",
    unlimited_trash_time_desc: "現在の制限：30 日",
    change_app_icon: "アプリアイコンを変更",
    change_app_icon_desc: "近日公開",
  },

  /* toast */
  disconnected: "クラウドから切断されました",
  dataSynced: "データが同期されました",
  noInternetConnection: "インターネットに接続していません",
  devicesLimitReached: "デバイスの制限に達しました",
  noteLimitReached: "ノートの制限に達しました",
  developerModeActivated: "開発者モードが有効になりました！",
  developerModeAlready: "開発者モードは既に有効です",
  developerModeTaps: "開発者モードを有効にするにはあと {{remaining}} 回タップしてください",

  empty_title: "(タイトルなし)",
};

export default ja;
