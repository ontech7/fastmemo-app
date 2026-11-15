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
    updated_to: "{{version}} に更新しました",
    whats_new: "新機能",
    new_in: "{{version}} の新機能",
    new_in_hint: "重要なものから順に",
    show_more: "もっと見る",
    show_less: "閉じる",
    more_count: "ほか{{count}}件",
    previous: "以前のバージョン",

    web: {
      description_2_1_0: `• AI アシスタントがパソコンでも：校正、短縮、翻訳、要約をすべてデバイス上で。
• MCP で Claude や Cursor などの AI エージェントをノートに接続：初期設定はオフ、ロックされたノートと非表示のノートには届きません。
• アプリらしいウィンドウ：ダークなタイトルバー、ブラウザのメニューやショートカットはなし。
• その他の修正と改善。`,

      description_2_0_0: `• 自分の FastMemo Server と同期（Firebase の代わりに）。
• デバイス間でリアルタイムに同期。
• キーボードショートカットと、Mac ではメニューバー。
• 画像をクリックしてサイズ変更、回転、保存。
• アプリの高速化と各種修正。`,

      description_1_2_0: `• エンドツーエンド暗号化のクラウド同期：ノートはあなただけの鍵で保護されます。
• ホーム画面からすぐにメモを書ける「クイックメモ」バーを追加。
• ヘルプセクションを刷新し、AIスマート検索に対応。
• その他の修正と改善。`,

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
      description_4_0_0: `• 自分の FastMemo Server と同期（Firebase の代わりに）。
• デバイス間でリアルタイムに同期。
• 新しい Qwen3.5 モデルの AI アシスタント：校正、短縮、翻訳、要約。
• 画像をタップしてサイズ変更、回転、共有。
• アプリの高速化と各種修正。`,

      description_3_2_0: `• エンドツーエンド暗号化のクラウド同期：ノートはあなただけの鍵で保護されます。
• ホーム画面からすぐにメモを書ける「クイックメモ」バーを追加。
• ヘルプセクションを刷新し、AIスマート検索に対応。
• その他の修正と改善。`,

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
    step8: "デバイス間でメモを同期：あなたの Firebase でも、自分のサーバーでも。",
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
  tour: {
    step: "{{current}} / {{total}}",
    skip: "スキップ",
    got_it: "了解",
    create_title: "最初のメモ",
    create_text: "＋をタップして書き始めましょう。隣の矢印からは、リスト・カンバン・コードなど他の種類も選べます。",
    write_title: "書くだけでOK",
    write_text: "入力した内容は自動で保存されます。書き終えたら、左上の矢印をタップしてください。",
    explore_title: "最後のヒント",
    explore_text:
      "メモを長押しすると選択できます。重要マーク、ロック、非表示、削除ができます。カテゴリ、ゴミ箱、設定は左側のバーにあります。",
  },
  home: {
    notes: "メモ",
    search: "何かを検索...",
    search_in: "{{category}} 内",
    search_elsewhere: "ほかのカテゴリ",
    tags_title: "ノートのタグ",
    quickNote: "クイックメモ…",
    selected_count: "{{count}}件選択",

    filters: {
      orderBy: "並び替え:",
      createdAt: "作成日",
      updatedAt: "更新日",
    },
  },
  note: {
    photo_denied: "Fast Memo はカメラを使用できません：システムの設定で許可してください",
    photo_failed: "カメラを開けませんでした",
    not_found: "メモが見つかりません",
    format: {
      undo: "元に戻す",
      redo: "やり直す",
      style: "行のスタイル",
      bold: "太字",
      italic: "斜体",
      underline: "下線",
      lists: "リスト",
      insert: "挿入",
      more: "その他",
      normal: "標準",
      h1: "見出し 1",
      h2: "見出し 2",
      quote: "引用",
      code_block: "コードブロック",
      bullets: "箇条書き",
      numbers: "番号付きリスト",
      checks: "チェックボックス",
      image: "画像",
      photo: "写真",
      link: "リンク",
      note_link: "ノートへのリンク",
      rule: "区切り線",
      inline_code: "インラインコード",
      highlight: "ハイライト",
      strike: "取り消し線",
      align_left: "左揃え",
      center: "中央揃え",
      sub: "下付き",
      sup: "上付き",
    },
    link: {
      title: "リンク",
      text: "テキスト",
      address: "アドレス",
      invalid: "リンクできるのはウェブアドレス、メールアドレス、電話番号だけです。",
      open: "開く",
      edit: "編集",
      remove: "リンクを削除",
      search_notes: "メモを検索…",
    },
    update_to_open: "このノートを開くには Fast Memo を更新してください",
    duplicated: "ノートを複製しました",
    duplicate_failed: "ノートを複製できませんでした",
    title_placeholder: "タイトル",
    description_placeholder: "ここに何かを書いてください...",
    characters: "文字",
    progress: "<hl>{{done}}</hl>/{{total}} 完了",
    mode_free: "リスト",
    mode_steps: "ステップ",
    hide_done: "完了を非表示",
    show_done: "完了を表示",
    delete_done: "完了を削除",
    delete_done_title: "完了した項目を削除しますか？",
    delete_done_text: "このリストの完了した項目が削除されます。",
    hidden_done: "非表示の完了項目：{{count}}",
    emptied_to_trash: "空のメモをゴミ箱に移動しました",
    show: "表示",
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
      reminder: "リマインダー",
      widget_show: "ウィジェットに表示",
      widget_remove: "ウィジェットから外す",
      open: "開く",
      move_to_trash: "ゴミ箱に移動",
      delete: "削除",
      important: "重要",
      protect: "保護",
      readonly: "読み取り専用",
      hide: "非表示",
      make_offline: "オフラインにする",
      sync_to_cloud: "クラウドに同期",
      made_offline: "ノートはオフラインになりました",
      synced_as_duplicate: "コピーとしてクラウドに同期しました",
      duplicate: "複製",
      history: "履歴",
      changecategory: "カテゴリを変更",
      share: "共有",
      export: "エクスポート",
      export_description: "エクスポート形式を選択してください",
      export_print: "プリントまたはPDFとして保存",
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
    image: {
      size: "サイズ",
      size_s: "小",
      size_m: "中",
      size_l: "大",
      size_full: "全幅",
      align: "配置",
      view: "表示",
      rotate: "回転",
      share: "共有",
      save: "保存",
      delete: "削除",
      failed: "この画像は変更も共有もできません",
      not_added: "画像を追加できませんでした",
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
    delete_column_confirm: "列「{{name}}」とそのすべてのカード（{{count}}）を削除しますか？",
    unnamed_column: "名前なし",
  },
  code: {
    add_tab: "タブを追加",
    tab_title_placeholder: "ファイル名",
    code_placeholder: "ここにコードを入力...",
    max_tabs_reached: "タブは最大6つまでです",
    delete_tab: "タブを削除",
    delete_tab_confirm: "このタブを削除してもよろしいですか？この操作は取り消せません。",
    language: "言語",
    plain_text: "プレーンテキスト",
  },
  changecategory: {
    title: "カテゴリーの変更",
  },
  cloudsync: {
    conflict_suffix: "（競合）",
    note_too_large: "「{{title}}」はこのクラウドには大きすぎるため、オフラインになりました（このデバイスのみ）。",
    notes_too_large: "{{count}} 件のノートはこのクラウドには大きすぎるため、オフラインになりました（このデバイスのみ）。",
    unreachable_server: "サーバーに接続できません",
    unreachable_firebase: "Firebase に接続できません",
    unreachable_pending: "{{count}} 件が待機中",
    unreachable_body: "変更はこのデバイスに残り、接続できるようになると自動で送信されます。",
    unreachable_pending_notes: "送信待ちのノート：{{count}} 件。",
    unreachable_last: "最終同期：{{time}}。",
    unreachable_vpn: "VPN（WireGuard など）で接続している場合は、オンになっているか確認してください。",
    reachable_server: "サーバーに接続できます",
    reachable_firebase: "Firebase に接続できます",
    unreachable_check_server: "FastMemo Server が起動しているか確認してください。",
    unreachable_check_firebase: "接続を確認して、もう一度お試しください。",
    conflict_copies: "同期前に2台のデバイスで編集されました：両方のバージョンを保持しました（一方はコピー）",
    open_on: "{{devices}} で開いています",
    note_deleted_elsewhere: "このメモはゴミ箱に移動されました。編集すると元に戻ります。",
    title: "クラウド同期",
    syncing_1: "同期中...",
    syncing_2: "完了までお待ちください",
    enable: "クラウド同期を有効にする",
    save: "設定を保存",
    edit: "設定を編集",
    resync: "データを再同期",
    resync_confirm_title: "データを再同期しますか？",
    resync_confirm_desc:
      "ノートとカテゴリーをクラウドにアップロードし、クラウドに保存済みのものをダウンロードして、両方を統合します。続行しますか？",
    deleteDevices: "デバイスを管理",
    handshakeFailed: "接続試行に失敗しました",
    handshakeFailedDesc: "Firebaseサーバーに接続できませんでした。",
    example: "例：{{value}}",
    provider: {
      title: "同期先",
      firebase: "Google Firebase",
      firebase_desc: "あなた専用の Firebase プロジェクト：無料ですぐに設定でき、Google がホストします。",
      server: "FastMemo サーバー",
      server_desc: "あなた自身のサーバー（PC、NAS、Raspberry Pi、VPS）：ノートがあなたの手元から出ることはありません。",
    },
    server: {
      url: "サーバーのアドレス",
      key: "アクセスキー",
      http_warning:
        "HTTP は暗号化されません。Tailscale や WireGuard などの VPN 経由なら問題ありません。ほかでは HTTPS を推奨。",
      http_blocked:
        "ブラウザーでは FastMemo は HTTPS のアドレスにしか接続できません。HTTP には Android アプリかデスクトップアプリを使ってください。",
      http_confirm_title: "HTTP で接続しますか？",
      http_confirm_desc:
        "HTTP は暗号化されません。Tailscale や WireGuard などの VPN 経由なら問題ありません。トンネルが通信をすでに暗号化しています。開かれたネットワークでは、通信を見られる人がノートのタイトルとデバイスの認証情報を読み取れる可能性があります。ノートの内容はエンドツーエンドで暗号化されたままです。",
      http_confirm_ok: "HTTP を使う",
      handshake_failed_desc:
        "サーバーに接続できないか、アクセスキーが間違っています。アドレス（例：https://notes.example.com）、キー、サーバーが起動しているかを確認してください。HTTPS のないサーバーは、アドレスの前に http:// を入力してください。ウェブアプリには HTTPS のアドレスが必要です。",
    },
    vault: {
      setup_title: "ノートを保護する",
      setup_desc:
        "クラウド同期のエンドツーエンド暗号化を有効にします。暗号化パスワードを選んでください。これがノートを非公開に保つ鍵になります。",
      migrate_title: "暗号化を有効にする",
      migrate_desc:
        "クラウド同期をエンドツーエンド暗号化にアップグレードします。暗号化パスワードを選んでください。クラウドにあるノートはこのパスワードで再暗号化され、各デバイスで一度だけ入力が必要になります。",
      point_private:
        "ノートを読めるのはあなただけです。私たちも、保存先のサービスも読めません。ノートはアップロード前にデバイス上で暗号化されます。",
      point_password: "ノートは、あなたが選び、あなただけが知っている暗号化パスワードで保護されます。",
      point_devices: "同期する各デバイスで、このパスワードを一度だけ入力します。",
      point_norecover:
        "私たちがパスワードをリセットすることはできません。忘れた場合は、次に表示するリカバリーキーが必要になるため、安全な場所に保管してください。",
      unlock_title: "ノートを解錠",
      unlock_desc: "このデバイスでノートを閲覧・同期するには、暗号化パスワードを入力してください。",
      unlock_action: "解錠",
      recover_title: "アクセスを回復",
      recover_desc: "パスワードを忘れましたか？リカバリーキーを入力して、新しい暗号化パスワードを設定してください。",
      recovery_title: "リカバリーキー",
      recovery_desc:
        "書き留めて安全な場所に保管してください。パスワードを忘れたときにノートへ戻れる唯一の方法です。このキーは二度と表示されません。",
      recovery_saved: "保存しました",
      change_title: "パスワードを変更",
      change_desc:
        "現在のパスワードを入力し、新しいパスワードを選んでください。ノートは暗号化されたまま変更されず、解錠済みのデバイスも引き続き動作します。変わるのはパスワードだけです。今後、新しいデバイスの解錠には新しいパスワードが必要になります。",
      change_action: "パスワードを変更",
      change_success: "暗号化パスワードを変更しました",
      changePassphrase: "パスワードを変更",
      reset_title: "暗号化をリセット",
      reset_desc:
        "パスワードとリカバリーキーの両方を失った場合にのみ使用してください。クラウド上の暗号化されたノートを削除し、最初からやり直します。このデバイスのノートは保持され、新しいパスワードで再アップロードされます。",
      reset_action: "暗号化をリセット",
      resetVault: "暗号化をリセット",
      passphrase_placeholder: "暗号化パスワード",
      passphrase_confirm_placeholder: "パスワードを確認",
      current_passphrase_placeholder: "現在のパスワード",
      new_passphrase_placeholder: "新しいパスワード",
      recovery_key_placeholder: "リカバリーキー",
      passphrase_too_short: "8文字以上にしてください",
      passphrase_mismatch: "パスワードが一致しません",
      wrong_passphrase: "パスワードが違います。もう一度お試しください",
      wrong_recovery_key: "このリカバリーキーは無効です",
      forgot_passphrase: "パスワードを忘れた場合",
      continue: "続行",
      creating: "暗号化を設定しています…",
      migrating: "ノートを暗号化しています…",
      unlocking: "解錠しています…",
      saving: "保存しています…",
      finishing: "仕上げています…",
      uploading: "ノートを暗号化してアップロードしています…",
      resetting: "リセットしています…",
      error_generic: "問題が発生しました。もう一度お試しください。",
      verify_failed: "暗号化の状態を確認できませんでした。接続を確認して、もう一度お試しください。",
      locked_prompt: "ノートはロックされています。同期するには、クラウド設定で解錠してください。",
      setup_prompt: "ノートを保護して同期するには、クラウド設定でエンドツーエンド暗号化を設定してください。",
      setup_action: "暗号化を有効にする",
      setup_cta_hint: "ノートはまだ暗号化されていません。エンドツーエンド暗号化を有効にして保護しましょう。すぐに完了します。",
      locked_cta_title: "同期は一時停止中です",
      locked_cta_hint:
        "このデバイスのノートは暗号化されロックされているため、クラウド同期は保留中です。暗号化パスワードを入力して解錠し、同期を再開してください。",
      enable_hint:
        "クラウド同期はエンドツーエンドで暗号化されます。ノートを読めるのはあなただけで、私たちも保存先のサービスも読めません。",
      prompt_title: "同期を一時停止中",
      prompt_desc: "ノートはまだ同期されていません。同期を再開するには、クラウド設定で暗号化の設定を完了してください。",
      prompt_close: "閉じる",
      prompt_go: "クラウド同期へ",
      backup_hint:
        "ヒント：続行する前に、ノートの暗号化バックアップをエクスポートしてください。任意ですが、万一の際の安全な備えになります。",
      backup_action: "クイックバックアップ",
    },
  },
  synceddevices: {
    title: "同期済みデバイス",
    lastSync: "最終同期: ",
    error_fetching: "デバイスを読み込めませんでした",
    error_body: "読み込み中に問題が発生しました。しばらくしてからもう一度お試しください。",
    offline_body: "オンラインに戻ると、ここにデバイスが表示されます。",
    upToDate: "最新",
    pending: "{{count}} 件保留中",
    mostRecent: "最も新しい",
    count: "（{{count}}/{{limit}}）台のデバイス",
    remove_title: "このデバイスを削除しますか？",
    remove_description: "{{name}} は同期から切断されます。ノートはそのデバイスに残りますが、再接続するまで同期されません。",
    remove_confirm: "削除",
  },
  createcategory: {
    title_create: "カテゴリーを作成",
    title_update: "カテゴリーを更新",
    name_title: "名前",
    name_placeholder: "ここにカテゴリー名を入力してください...",
    icon_title: "アイコン",
    suggested_title: "おすすめ",
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
  mcp: {
    title: "MCPサーバー",
    enable_label: "AIエージェントによる Fast Memo の利用を許可",
    enable_line: "このコンピューター上の AI エージェント（Claude Code など）がメモを検索、読み取り、追加できます。",
    provider_warning: "エージェントが読み取った内容は、そのエージェントが使うモデルの提供元に送信されます。",
    tools_section: "ツール",
    tools: {
      fastmemo_create_note: "メモを作成",
      fastmemo_list_categories: "カテゴリを一覧表示",
      fastmemo_search_notes: "メモを検索",
      fastmemo_read_note: "メモを読み取り",
      fastmemo_set_note_flags: "メモのフラグを設定",
      fastmemo_help: "ヘルプを読む",
      fastmemo_check_update: "アップデートを確認",
      fastmemo_edit_note: "メモを編集",
      fastmemo_trash_note: "メモをゴミ箱に移動",
    },
    tool_lines: {
      fastmemo_create_note: "テキスト、ToDo、かんばん、コードのメモを追加します。",
      fastmemo_list_categories: "カテゴリの名前を表示します。",
      fastmemo_search_notes: "タイトルや内容でメモを検索します。ロックされたメモと非表示のメモは見つかりません。",
      fastmemo_read_note: "メモの内容を読み取ります。ロックされたメモと非表示のメモは読み取れません。",
      fastmemo_set_note_flags: "メモを重要、読み取り専用、ロック済みにします。",
      fastmemo_help: "Fast Memo のヘルプトピックを読み取ります。",
      fastmemo_check_update: "新しいバージョンがあるかを伝えます。何もインストールしません。",
      fastmemo_trash_note: "メモを一時ゴミ箱に移動します。そこから復元できます。",
    },
    edit_note_line: "オフのときは、エージェントは同じセッションで作成したメモだけを編集できます。",
    background_label: "バックグラウンドで実行を続ける",
    background_line:
      "オン：ウィンドウを閉じても、Fast Memo はトレイのアイコンとともに実行され続けます。オフ：閉じるとアプリが終了し、エージェントはウィンドウを開いている間だけ利用できます。",
    connect_section: "エージェントを接続",
    connect_intro: "下のテキストで Fast Memo をエージェントに追加します。MCP がオンのときに使えます。",
    client_claude_code: "Claude Code",
    client_codex: "Codex",
    client_json: "Claude Desktop と Cursor",
    json_files:
      "Claude Desktop では claude_desktop_config.json（設定、開発者、設定を編集）に、Cursor では ~/.cursor/mcp.json にこの JSON を保存します。ファイルにすでに他のサーバーがある場合は、mcpServers に fastmemo の項目だけを追加してください。",
    copy: "コピー",
    copied: "コピーしました",
    copy_failed: "コピーできませんでした。テキストを選択して手動でコピーしてください。",
    copy_label: "{{client}} 用のテキストをコピー",
    moved_warning:
      "Fast Memo が「アプリケーション」フォルダにありません。移動すると接続が機能しなくなります。「アプリケーション」に置いてから、もう一度テキストをコピーしてください。",
    save_failed: "変更を適用できませんでした：{{error}}",
    load_failed: "設定を読み込めませんでした：{{error}}",
  },
  generalsettings: {
    zoom_value: "ズーム：{{percent}}%",
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
    mcp: "MCP",
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
    update_installing: "アップデートをダウンロード中です。インストール後にアプリが再起動します。",
    update_install: "インストール",
    update_downloading: "v{{version}} をダウンロード中",
    update_download_hint: "アプリはそのまま使えます。ダウンロードが終わるとインストールが始まります。",
    update_hide: "隠す",
    update_check_failed: "アップデートを確認できませんでした。後でもう一度お試しください。",
    update_not_allowed: "この権限がないと、Fast Memo はアップデートをインストールできません。",
    update_download_failed: "アップデートをダウンロードできませんでした。後でもう一度お試しください。",
    update_not_verified:
      "ダウンロードしたファイルは、このアプリと同じ署名の Fast Memo アップデートではないため、インストールしませんでした。",
    update_size: "ダウンロード: {{size}} MB",
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
    quick_note_section: "クイックメモ",
    quick_note_label: "クイックメモバー",
    quick_note_description:
      "ホーム画面下部にバーを表示し、完全なエディタを開かずにテキストメモをすばやく書いて保存できます。タップして入力し、送信。",
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
    role: "Senior Software Engineer",
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
    download_notification: "FastMemo の AI モデル",
    download_waiting: "ネットワークを待っています...",
    download_failed: "ダウンロードに失敗しました。もう一度お試しください。",
    download_no_space: "モデルを保存する空き容量が足りません。容量を空けてもう一度お試しください。",
    download_background: "この画面を離れても、画面を消しても、ダウンロードは続きます。進行状況は通知に表示されます。",
    download_background_desktop:
      "このページを離れてもダウンロードは続きます。アプリを閉じた場合は、もう一度「モデルをダウンロード」をクリックすると、中断した位置から再開されます。",
    cancel: "キャンセル",
    delete_model: "モデルを削除",
    info: "AIアシスタントはデバイス上で完全に動作します。外部サーバーにデータは送信されません。モデルは一度だけダウンロードし（約530 MBから）、ローカルに保存されます。",
    model_light: "高速、基本品質。3GB以上のRAMが必要。",
    model_powerful: "速度と品質のバランス。4GB以上のRAMが必要。",
    model_advanced: "最高品質。6GB以上のRAMが必要。",
    model_unavailable: "このデバイスのRAMが不足しています",
    recommended: "おすすめ",
    old_models_title: "古い AI モデル：{{size}}",
    old_models_desc:
      "FastMemo は Qwen3.5 モデルを使うようになりました。より速く、より賢くなっています。古いファイルはもう使われません。今すぐ削除するか、新しいモデルをダウンロードすると自動で削除されます。",
    old_models_delete: "古いモデルを削除",
    old_models_confirm: "古い AI モデル（{{size}}）を削除しますか？FastMemo ではもう使われません。",
    old_models_deleted: "古いモデルを削除しました：{{size}} 解放",
    capabilities_title: "何ができますか？",
    cap: {
      generate_title: "ノート内容からタイトルを生成",
      summarize: "テキストノートを数文で要約",
      fix_grammar: "スペルと文法を修正",
      shorten: "テキストを短く簡潔にする",
      translate: "ノートを選んだ言語に翻訳",
      suggest_items: "チェックリストの新しい項目を提案",
      suggest_category: "ノートに最適なカテゴリを提案",
      voice_cleanup: "口述テキストを句読点付きで整える",
    },
    unavailable_web: "AIアシスタントはモバイルデバイスでのみ利用可能です。",
    native_rebuild_needed: "AIアシスタントにはネイティブリビルドが必要です。\n実行: npx expo run:android",
    unavailable_computer: "このコンピューターではAIを利用できません。",
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
      setting_changed: "設定を更新しました",
      help_message:
        "ノート、リスト、ボードの作成、削除、名前変更、変換、統合などができます。\n試してみて：「牛乳とパンの買い物リストを作成」\n全機能は設定 > AIアシスタントをご覧ください。",
      not_understood: "ノートに関するお手伝いのみ可能です",
      error: "問題が発生しました。もう一度お試しください",
      voice_unavailable: "音声が利用できません",
    },
    editor: {
      generate_title: "タイトルを生成",
      summarize: "要約する",
      suggest_items: "項目を提案",
      suggest_category: "カテゴリを提案",
      fix_grammar: "文法を修正",
      shorten: "短くする",
      translate: "翻訳",
      translate_to: "翻訳先",
      app_language: "アプリの言語",
      min_model: "最低",
      before: "変更前",
      after: "変更後",
      apply: "適用",
      content_changed: "AI の処理中にノートが変更されました。もう一度実行してください。",
      no_content: "まず何か書いてください",
      no_category_match: "該当するカテゴリが見つかりません",
      category_unchanged: "ノートはすでに「{{name}}」にあります",
      category_unsure: "AI はこの 2 つで迷っています。どちらかを選んでください。",
      no_improvement: "AI はこのテキストを改善できませんでした。変更はありません。",
      too_long: "テキストが長すぎて AI で処理できません。短い部分で試してください。",
      note_too_long: "このモデルにはノートが長すぎます",
      progress: "パート {{current}} / {{total}}",
      summary_label: "要約",
      summary_on_top: "ノートの先頭に追加され、その下のノートはそのまま残ります。",
      summary_replaces: "ノートの先頭に追加され、以前の要約と置き換わります。",
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
      text_1_0: "ホーム画面の右下、[+] の隣にある",
      text_1_1: "ボタンをタップして「リスト」を選びます。",
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
      text_1_0: "ホーム画面の右下、[+] の隣にある",
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
      text_1_0: "ホーム画面の右下、[+] の隣にある",
      text_1_1: "ボタンをタップして「コード」を選びます。",
      text_2_0: "構文ハイライト付きの本格的なコードエディタが使えます。",
      text_3_0:
        "• タブ — 1つのノートに複数のスニペットをまとめられます。追加・名前変更・削除や、ドラッグして並べ替えができます（最大6つ）。",
      text_4_0: "• 言語 — 言語バーをタップして選ぶか、自動で検出させることができます。",
      text_6_0: "保存するには、ホーム画面に戻るだけです。",
    },
    what_quick_note: {
      title: "クイックメモバーとは？",
      text_1_0: "ホーム画面の下部にある「クイックメモ…」の入力欄です。タップして入力し、",
      text_1_1: "をタップすると、エディターを開かずにすぐテキストノートとして保存できます。",
      text_2_0: "ノートは表示中のカテゴリに保存され、タイトルは本文の最初の部分から付けられます。",
      text_3_0: "書式や画像を追加したいときは、代わりに",
      text_3_1: "をタップすると、入力した内容がフルエディターで開きます。",
      text_4_0: "パソコンでは Ctrl/⌘+Enter でノートを保存し、Enter で改行します。",
      text_5_0: "このバーは、設定 → ノート作成でオフにできます。",
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
      text_heading: "• 見出し — 現在の行を見出しにします。",
      text_4_0: "• 太字 — 選択したテキストを太字にします。",
      text_5_0: "• イタリック — 選択したテキストを斜体にします。",
      text_6_0: "• 取り消し線 — 選択したテキストに取り消し線を引きます。",
      text_7_0: "• 下線 — 選択したテキストに下線を引きます。",
      text_align: "• 左揃え / 中央揃え — 段落を左または中央に揃えます。",
      text_8_0: "• 下付き文字 — テキストを行よりわずかに下に配置します。",
      text_9_0: "• 上付き文字 — テキストを行よりわずかに上に配置します。",
      text_10_0: "• 箇条書き — 箇条書きリストを開始します。",
      text_11_0: "• 番号付きリスト — 番号付きリストを開始します。",
      text_12_0: "• コード — テキストを書式付きのコードブロックで囲みます。",
    },
    what_text_notes: {
      title: "テキストノート",
      text_1_0:
        "バーには行のスタイル（標準、見出し、引用）、チェックボックス付きのリスト、画像・リンク・他のノートへのリンク・線を挿入するメニュー、そして ··· の中にコードブロック、インラインコード、ハイライトなどがあります。標準ですべてのスタイルが外れます。",
      text_2_0: "Markdown でも書けます。下の「Markdown」をご覧ください。",
    },
    what_markdown: {
      title: "Markdown",
      text_1_0:
        "行頭で: # 見出し、## 小見出し、- または * 箇条書き、1. 番号付きリスト、[] チェックボックス、> 引用、続けてスペース。--- と Enter で線を引きます。",
      text_2_0:
        "文中で: **太字**、*斜体* または _斜体_、__下線__、~~取り消し線~~、==ハイライト==、`コード`。閉じる記号を入力するとスタイルが付き、元に戻すと記号が戻ります。",
      text_3_0: "http:// または https:// で始まるアドレスは、スペースを入力するか Enter を押すとリンクになります。",
      text_4_0:
        "Markdown を貼り付けると、見出し、リスト、チェックボックス、引用、線、``` で囲んだコードブロック、[テキスト](アドレス) のリンクがノートの行になります。元に戻すを1回で全部取り消せます。",
    },
    what_note_links: {
      title: "ノートをリンク",
      text_1_0: "テキストノートで [[ と入力し、ノートを選びます。リンクをタップするとそのノートが開きます。",
    },
    what_lists: {
      title: "リスト",
      text_1_0: "Enter で次の項目を追加します。左下のボタンで完了した項目を非表示にしたり削除したりできます。",
    },
    what_history: {
      title: "履歴",
      text_1_0: "ノートのメニューから以前のバージョンを表示して復元できます。",
      text_2_0:
        "AI、エージェント、同期、または大きな変更でノートが書き換えられる前に、Fast Memo がバージョンを保存します。この端末にのみ保存されます。",
    },
    what_reminders: {
      title: "リマインダー",
      text_1_0:
        "ノートのメニューから日付と時刻を選びます。通知はそのノートがあるスマートフォンに届きます。別の端末で設定したものは、次にそのスマートフォンで Fast Memo を開いたときに届きます。",
    },
    what_from_outside: {
      title: "アプリの外から",
      text_1_0:
        "Fast Memo のアイコンを長押しすると、新しいノート、新しいリスト、ノートを音声入力が使えます。ウィジェットをホーム画面に追加でき、他のアプリからテキスト、リンク、画像を Fast Memo に共有できます。",
    },
    what_find_replace: {
      title: "テキストを検索して置換するには？",
      text_1_0: "テキストノートまたはコードノートを編集中に、右上の検索アイコンをタップします。",
      text_2_0: "探したい語句を入力します。矢印で一致箇所を移動でき、件数も表示されます。",
      text_3_0: "「置換」をオンにすると、現在の一致箇所を置き換えるか、すべての一致箇所を一度に置き換えられます。",
    },
    what_voice_dictation: {
      title: "ノートを音声で入力するには？",
      text_1_0: "テキストノートまたはToDoリストで、マイクボタンをタップして話してください。",
      text_2_0: "話している間に文字が表示されるので、挿入する前に確認できます。",
      text_3_0:
        "「挿入」をタップすると、カーソルの位置にテキストが追加されます。ToDoリストでは、1行ごとに1つの項目になります。",
      text_4_0:
        "AIアシスタントを設定していれば、「AIで整える」で挿入前にテキスト（句読点、表記、言いよどみ）を整えられます。ToDoリストでは、代わりに話した内容を項目に分けます。",
      text_5_0: "言語の変更や音声入力のオフは、設定 → 音声認識で行えます。",
    },
    what_are_settings_note: {
      title: "ノートのオプションは何ですか？",
      text_1_0: "ノートを開き、右上の ⋮ メニューをタップします。そこから次のことができます：",
      text_2_0: "• 削除 — ノートをゴミ箱に移動します。",
      text_3_0: "• 重要 — ノートに印を付けて、上部で目立つようにします。",
      text_4_0: "• 保護 — 秘密コードや指紋でノートをロックします。",
      text_5_0: "• 読み取り専用 — 誤ってノートが編集されないようにします。",
      text_6_0: "• 非表示 — 非表示ノートを表示するまで、ノートをホーム画面から隠します。",
      text_7_0:
        "• オフラインにする — ノートをこのデバイスだけに保存し、クラウドには同期しません。「クラウドに同期」を選ぶと、タイトルの末尾に「(2)」が付いた新しいノートとして再びアップロードされます。",
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
      text_2_0: "カテゴリのハンドルをドラッグして新しい位置に移動します。並び順はすぐに保存されます。",
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
      text_2_0: "ノートはそこに標準で30日間残り、その後完全に削除されます。基本設定で3日、7日、15日、30日から選べます。",
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
        "自分の Google Firebase プロジェクト、または自分の FastMemo Server（PC、NAS、Raspberry Pi、VPS 上）を接続して同期を有効にすると、デバイス間でノートを同期できます。Fast Memo の中央サーバーは存在せず、データはあなたが選んだ場所だけにあります。",
      text_2_0: "ノートはアップロード前にデバイス上でエンドツーエンド暗号化されるため、あなた以外の誰も読むことはできません。",
      text_link: "Google Firebase の設定手順ガイドを読む →",
      text_link_server: "自分の FastMemo Server の設定ガイドを読む →",
    },
    what_conflict_copy: {
      title: "「（競合）」と付いたノートがあるのはなぜ？",
      text_1_0:
        "同じノートが同期前に2台のデバイスで変更されると、Fast Memo はどちらか一方を選ばずに両方のバージョンを残します。そのため、書いた内容が失われることはありません。",
      text_2_0:
        "一方はタイトルの末尾に「（競合）」が付いたコピーになります。両方を見比べて必要な内容を残し、もう一方を削除してください。",
    },
    what_encryption: {
      title: "ノートはどのように暗号化されますか？",
      text_1_0:
        "クラウド同期はエンドツーエンド暗号化を使用します。初回設定時に暗号化パスワードを選び、デバイスがそこからノートを保護する鍵を導出します。",
      text_2_0:
        "鍵はデバイスから出ることはなく、クラウドにも保存されないため、あなたの Firebase やサーバーにアクセスできる人でも、パスワードなしにノートの内容を読むことはできません。",
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
      text_5_0: "• クイックメモバー — ホーム画面下部のクイックメモ用バーを表示または非表示にします。",
    },
    what_home_filters: {
      title: "ホームのフィルターはどのように機能しますか？",
      text_1_0: "ホーム画面上部のフィルターアイコンをタップすると、ノートの表示方法を変更できます。",
      text_2_0: "• 並べ替え — 作成日または最終更新で、昇順または降順に並べ替えます。",
      text_3_0:
        "• 検索：ホーム上部の入力欄に入力します。タイトルとすべての種類のノートの中を、すべてのカテゴリで、大文字・小文字やアクセントを区別せずに検索します。複数の語を入力すると、そのすべてを含むノートが見つかります。保護されたノートはタイトルでのみ見つかります。",
      text_4_0:
        "• タグ：ノートのどこにでも、前に # を付けた語（#仕事）を書きます。検索欄に # と入力するとタグの一覧が表示され、タップするとそのタグのノートを検索します。",
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
      text_3_0:
        "デスクトップアプリでは「インストール」をクリックすると、更新が自動でダウンロード・インストールされ、アプリが再起動します。スマートフォンでは、小さな修正が自動で届き、次にアプリを開いたときに適用されることもあります。",
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
      text_link: "Webhook ガイドを読む →",
    },
    what_platforms: {
      title: "Fast Memo はどこで使えますか？",
      text_1_0: "Fast Memo はモバイルとデスクトップ（Windows、macOS、Linux）の両方に加え、Web 版でも使えます。",
      text_2_0:
        "各デバイスを同じ Google Firebase プロジェクトまたは同じ FastMemo Server に接続すれば、どこでもノートが同期されたままになります。",
    },
    what_mcp: {
      title: "MCP サーバーはありますか？",
      text_1_0:
        "デスクトップアプリのみ：このコンピューター上の AI エージェント（Claude Code、Codex、Claude Desktop、Cursor など）がノートを検索・読み取り・追加できるようにします。",
      text_2_0:
        "設定 → MCP でオンにするまではオフです。そこでは、エージェントを接続するためにコピーするテキストと、ツールごとのスイッチも見つかります。",
      text_3_0:
        "ロックされたノートと非表示のノートはエージェントの手の届かないところにあり、検索されることも読み取られることもありません。",
      text_4_0:
        "「バックグラウンドで実行を続ける」をオンにすると、ウィンドウを閉じていてもエージェントは Fast Memo にアクセスできます。",
      text_5_0: "エージェントが読み取った内容は、そのエージェントが使うモデルの提供元に送信されます。",
    },
    what_desktop_shortcuts: {
      title: "パソコンでキーボードショートカットは使えますか？",
      text_1_0: "はい、デスクトップアプリでは次のショートカットが使えます：",
      text_2_0: "• Ctrl/⌘+N — 新しいノート。",
      text_3_0: "• Ctrl/⌘+F — ノートを検索、または開いているテキストノート内のテキストを検索。",
      text_4_0: "• Esc — 前の画面に戻る。テキスト欄では、最初の Esc は欄から抜けるだけです。",
      text_5_0: "• Ctrl/⌘+Enter — クイックメモを保存。",
      text_8_0:
        "矢印キーでノートを移動し、Enter で開き、ノートを右クリックするとメニューが開き、Ctrl/⌘ + クリックで複数選択できます。Ctrl/⌘ + P はテキストノートを印刷、Ctrl/⌘ と + / - でズームを変更します。テキストノートには画像を貼り付けたりドロップしたりできます。",
      text_6_0:
        "Mac では、同じコマンドがメニューバーにもあり、ほかのノートの種類やデータのエクスポート/インポートも選べます。ウインドウを閉じても Fast Memo は動き続けます。Dock のアイコンをクリックすると再び開き、⌘Q で終了します。",
      text_7_0: "Windows と Linux では、ウインドウを閉じると Fast Memo が終了します。",
    },
    what_ai_assistant: {
      title: "AIアシスタントとは？",
      text_1_0:
        "Fast Memoにはデバイス上で完全に動作するセルフホスト型AIアシスタントが搭載されています。外部サーバーにデータは送信されません。",
      text_2_0: "設定するには、設定 → AIアシスタントに移動し、モデルを選択してダウンロードしてください。",
      text_3_0:
        "有効にすると、ノートエディターにスパークルボタンが表示されます。ノートの種類に応じて、タイトルの生成、要約（要約はノートの先頭に入ります）、文法の修正、テキストの短縮、選んだ言語への翻訳、チェックリスト項目の提案、カテゴリの提案ができます。",
      text_4_0: "一部の機能には大きめのモデルが必要です。設定 → AIアシスタントで、各モデルにできることを確認できます。",
      text_5_0: "音声入力の整形もでき、このヘルプでは自分の言葉で書いた内容から適切なトピックを探せます。",
      text_6_0: "AIはオフラインで動作し、複数の言語をサポートしています。",
      text_link: "AIアシスタントのガイドを読む →",
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
    deviceInfoCheckbox: "デバイスの情報を追加",
    attachments: "画像を追加",
    sendReport: "レポートを送信",

    sent_message_1: "レポートの送信ありがとうございます。",
    sent_message_2: "次の報告を送れるのは：",

    attachments_limit: "添付ファイルの制限:",
    loading: "読み込み中...",

    alwaysSent: "常に送信",
    deviceInfoText: "メーカー、機種、クラウドの種類、アプリのアイコン。ノートの内容は決して含みません。",
    seeWhatIsSent: "送信される内容を見る",
    whatIsSent: "送信される内容",
    shortDescription: "何をしていて、どうなると思っていたかを書き加えてください。短い文では状況がわかりにくいです。",
    email: "メールアドレス（任意、返信用）",
    installCode: "このインストールのコード：{{code}}",

    sent: {
      appVersion: "アプリ",
      os: "システム",
      osVersion: "システムのバージョン",
      appLanguage: "アプリの言語",
      installId: "インストールコード",
      brand: "メーカー",
      modelName: "機種",
      deviceType: "種類",
      cloud: "クラウド",
      appIcon: "アプリのアイコン",
      topics: "トピック",
      descriptionLength: "説明（文字数）",
      images: "画像",
      email: "メール",
    },

    messages: {
      email_invalid: {
        title: "メールアドレスを確認してください",
        text: "メールアドレスが正しくないようです。",
      },
      fileNotFound: "ファイルを読み込めませんでした。",
      invalidType: "添付できるのは画像のみです。",
      size: {
        title: "ファイルが大きすぎます！",
        text: "画像の合計サイズが大きすぎます。1枚削除してください。",
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
    delete_note: "このノートを削除しますか？",
    delete_notes_perma: "これらのノートを完全に削除しますか？",
    restore_all_notes: "すべてのノートを復元しますか？",
    delete_all_notes_perma: "すべてのノートを完全に削除しますか？",
    select_one_option: "1つのオプションを選択してください",
    passphrase_wrong: "入力したパスフレーズが間違っています。",
    are_you_sure_wipe: "データを消去してもよろしいですか？\n作成されたすべてのノートとカテゴリが失われます。",
    generic_success_description: "操作は成功しました。",
  },

  // The macOS menu bar (Apple's own wording in each language).
  menu: {
    about: "{{name}}について",
    settings: "設定…",
    services: "サービス",
    hide: "{{name}}を非表示",
    hide_others: "ほかを非表示",
    show_all: "すべてを表示",
    quit: "{{name}}を終了",
    file: "ファイル",
    new_note: "新規ノート",
    new_text: "新規テキストノート",
    new_todo: "新規リスト",
    new_kanban: "新規カンバンボード",
    new_code: "新規コードノート",
    export_import: "データのエクスポート/インポート…",
    close_window: "ウインドウを閉じる",
    edit: "編集",
    undo: "取り消す",
    redo: "やり直す",
    cut: "カット",
    copy: "コピー",
    paste: "ペースト",
    select_all: "すべてを選択",
    find: "検索…",
    view: "表示",
    zoom_in: "拡大",
    zoom_out: "縮小",
    actual_size: "実際のサイズ",
    fullscreen: "フルスクリーンにする",
    window: "ウインドウ",
    minimize: "しまう",
    zoom: "拡大／縮小",
    help: "ヘルプ",
    help_item: "{{name}} ヘルプ",
    tray_open: "Fast Memo を開く",
    tray_quit: "終了",
  },

  a11y: {
    whats_new: "このバージョンの新機能",
    prev_month: "前の月",
    next_month: "次の月",
    back: "戻る",
    close: "閉じる",
    save: "保存",
    previous: "前へ",
    next: "次へ",
    previous_match: "前の一致",
    next_match: "次の一致",
    sync_device: "このデバイスを同期",
    remove_device: "デバイスを削除",
    remove_attachment: "添付ファイルを削除",
    start_over: "やり直す",
    delete_digit: "数字を削除",
    new_note: "新規ノート",
    exit_selection: "選択を終了",
    note_types: "ノートの種類を選択",
    organize_categories: "カテゴリーを整理",
    delete_category: "カテゴリーを削除",
    dictate: "音声入力",
    start_listening: "聞き取りを開始",
    stop_listening: "聞き取りを停止",
    clear_search: "検索をクリア",
    tag_row: "タグ {{tag}}、ノート：{{count}}",
    delete_item: "項目を削除",
    change_column_color: "列の色を変更",
    move_column_left: "列を左に移動",
    move_column_right: "列を右に移動",
    reorder: "並べ替え",
    move_up: "上へ移動",
    move_down: "下へ移動",
    search_in_note: "ノート内を検索",
    add_item: "項目を追加",
    open_full_note: "通常のノートとして開く",
    save_note: "ノートを保存",
    list_menu: "リストのオプション",
    more_options: "その他のオプション",
    sort_filter: "並べ替えとフィルター",
    hide_keyboard: "キーボードを閉じる",
    open_guide: "ガイドを開く",
    page: "{{page}} ページ",
    item: "項目",
    image: {
      picture: "画像",
      small: "小",
      medium: "中",
      large: "大",
      full: "全幅",
      align_left: "左揃え",
      align_center: "中央揃え",
      align_right: "右揃え",
    },
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
    change_app_icon_desc: "ホーム画面用の季節のアイコン",
    ai_eval: "AI 評価",
    ai_eval_desc: "選択中のモデルで固定テキストを実行：時間と回答",
  },

  appicon: {
    title: "アプリアイコン",
    default: "デフォルト",
    halloween: "ハロウィン",
    christmas: "クリスマス",
    easter: "イースター",
    summer: "夏",
    close_title: "アイコンを変更",
    close_description: "新しいアイコンを適用するため、Fast Memo を終了します。ホーム画面から再度開いてください。",
    close_confirm: "変更して終了",
    failed: "アイコンを変更できませんでした。",
    unavailable: "このデバイスでは利用できません",
  },

  aieval: {
    title: "AI 評価",
    run: "すべて実行",
    stop: "停止",
    share: "結果を共有",
    progress: "{{done}} / {{total}} 完了",
    load: "モデルの読み込み：{{ms}} ms",
    no_model: "まず AI アシスタントでこのモデルをダウンロードしてください。",
    unavailable: "ここではデバイス上の AI は使えません。",
    failed: "モデルを読み込めませんでした。",
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

  crash: {
    title: "問題が発生しました",
    text: "保存したノートはデバイスに残っています。アプリを開き直してください。再び起きる場合は、報告を送ってください。",
    reopen: "Fast Memo を開き直す",
    report: "報告を送る",
    what: "何をしていましたか？",
    send: "送信",
    sending: "送信中…",
    sent: "報告を送信しました",
    failed: "送信できませんでした。接続を確認して、もう一度お試しください。",
    code: "コード：{{code}}",
  },

  history: {
    current: "現在のバージョン",
    today: "今日",
    yesterday: "昨日",
    reason: {
      ai: "AIアシスタントの前",
      agent: "AIエージェントの前",
      sync: "同期の前",
      edit: "編集の前",
      replace: "「すべて置換」の前",
      cleanup: "完了した項目を削除する前",
      restore: "復元の前",
    },
    footer: "保存されたバージョン: {{count}}。この端末にのみ保存されます。",
    empty_title: "以前のバージョンはありません",
    empty_text:
      "AI、エージェント、同期、または大きな変更でこのノートが書き換えられる前に、Fast Memo がバージョンを保存します。",
    restore: "復元",
    close: "閉じる",
    restored: "バージョンを復元しました",
  },

  launch: {
    dictation_off: "音声認識がオフです。設定でオンにしてください",
  },
  widget: {
    new_list: "新しいリスト",
    dictate: "音声入力",
    set: "このメモをウィジェットに表示しました",
    removed: "ウィジェットから外しました",
    new_note: "新しいメモ…",
    empty_title: "メモが選ばれていません",
    empty_text: "メモを開いて「ウィジェットに表示」を選んでください",
  },
  reminder: {
    channel: "リマインダー",
    notification_body: "リマインダー",
    notification_title: "リマインダー",
    notification_private: "保護されたノートにリマインダーがあります",
    ask_sync_title: "ノートにリマインダーがあります",
    ask_sync_text: "このスマートフォンにも通知しますか？",
    not_now: "後で",
    denied_title: "このスマートフォンには通知されません",
    denied_text: "Fast Memo の通知はオフになっています。リマインダーはノートに残り、ほかのスマートフォンで鳴ることがあります。",
    open_settings: "設定を開く",
    exact_title: "時間どおりに",
    exact_text:
      "正確な時刻に鳴らすには、Fast Memo に「アラームとリマインダー」の許可が必要です。許可がないと、Android は通知を最大1時間遅らせることがあります。",
    late_note: "「アラームとリマインダー」の許可がないと、通知が遅れることがあります。",
    in_hour: "1時間後",
    tonight: "今夜",
    tomorrow: "明日の朝",
    monday: "月曜日",
    choose: "日時を選択…",
    hours_field: "時",
    minutes_field: "分",
    set: "設定",
    remove: "リマインダーを削除",
    current: "{{when}} に設定済み",
    past: "まだ過ぎていない日時を選んでください",
    card: "リマインダー：{{when}}",
    set_toast: "リマインダーを設定しました",
    removed_toast: "リマインダーを削除しました",
    desktop_note: "通知はこのノートがあるスマートフォンに届きます。",
  },
  share: {
    nothing: "Fast Memo に保存できるのはテキスト、リンク、画像です",
    saved: "共有した内容は新しいノートにあります",
  },
  empty: {
    notes_title: "まだノートがありません",
    notes_text: "+ をタップして最初のノートを書くか、下のクイックノートを使ってください。",
    notes_text_no_quick: "+ をタップして最初のノートを書いてください。",
    category_title: "まだ何もありません",
    category_text: "このカテゴリで作成したノートがここに表示されます。",
    search_title: "ノートが見つかりません",
    search_text: "別の言葉で試してください。",
    trash_title: "ゴミ箱は空です",
    trash_text: "削除したノートはここに {{days}} 日間残ります。",
    trash_text_unlimited: "削除したノートは、削除するまでここに残ります。",
    categories_title: "まだカテゴリーがありません",
    categories_text: "+ をタップして最初のカテゴリーを作成してください。",
    list_title: "まだ項目がありません",
    list_text: "+ をタップして最初の項目を追加してください。",
    list_text_read_only: "このリストには項目がありません。",
  },

  empty_title: "(タイトルなし)",
};

export default ja;
