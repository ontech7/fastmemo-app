# FastMemo Architecture

## Overview

FastMemo follows a hybrid feature-based / layer-based architecture. Screens are organized by domain (expo-router file-based
routing), components are domain-grouped, and state management uses centralized Redux slices per domain. The app targets three
platforms: Android (primary), Web, and Desktop (Tauri).

## Platform Target Matrix

| Platform | Framework                            | Build Tool   | Status          |
| -------- | ------------------------------------ | ------------ | --------------- |
| Android  | React Native 0.88 (New Architecture) | EAS Build    | Active (v4.0.0) |
| Web      | Expo Web (React DOM)                 | Expo/Metro   | Active          |
| Desktop  | Tauri 2.x (Rust + WebView)           | tauri-action | Active (v2.0.0) |
| iOS      | React Native                         | -            | Dismissed       |

## Source Directory Structure

> As of v3.2.0 / Expo SDK 56, `app/` and `assets/` live at the **project root** (moved out of `src/`). The tree below still
> reflects their internal layout.

```
src/
  app/                 # Expo Router screens (file-based routing) — physically at repo root since v3.2.0
    _layout.tsx        # Root layout: provider tower + single flat Stack navigator
    index.tsx          # Boot/splash screen (platform-split: index.web.tsx)
    intro.tsx          # Onboarding carousel (platform-split: intro.web.tsx)
    home.tsx           # Main screen (note list + sidebar)
    changelog.tsx      # Version changelog modal
    secret-code.tsx    # Secret code entry
    temporary-trash.tsx # Trashed notes list
    notes/
      [noteId].tsx     # Dynamic route: note editor (handles create + edit); ?version=<id>: a kept version, read only (ADR-042)
      history.tsx      # A note's kept versions by day (ADR-042); a protected note's only from inside it (a pass, LL-085)
    categories/
      create.tsx       # Create/update category (dual-purpose)
      change.tsx       # Change a note's category
      organize.tsx     # Reorder categories via drag-and-drop
    settings/
      general.tsx      # Settings hub
      ai-assistant.tsx # AI model management (shows a download under way: it goes on when the screen closes)
      cloud-sync/
        connect.tsx        # Cloud sync setup + encryption entry points (enable/unlock/change/reset)
        devices.tsx        # Connected devices
        vault-setup.tsx    # Set encryption password (modes: create | migrate | reset)
        vault-unlock.tsx   # Unlock an existing vault on this device (+ forgot-password link)
        vault-recovery.tsx # Show the recovery key once, then run the connect continuation
        vault-recover.tsx  # Forgot-password: recovery key + new password
        vault-change.tsx   # Change the encryption password (re-wraps DEK only)
        vault-reset.tsx    # Confirm + route to vault-setup mode=reset (last resort)
      # ... 8 more settings screens

  components/          # UI components (domain-grouped)
    cloud/             # CloudUnreachableLine (the home's line when the cloud can't be reached), CloudStatusDot (ADR-029)
    buttons/           # 18 button components (each a single-purpose TouchableOpacity)
    cards/             # NoteCard (in a search: the title's marked words and the line that matched), TrashedNoteCard,
                       #   OrganizeCategoryCard, OrderedCategoryCard, TagRow (a tag and its count, the search's tag list)
    notes/             # Note editors: NoteTextEditor, NoteTodoEditor, NoteKanbanEditor, NoteCodeEditor; NoteImageMenu (ADR-024);
                       #   TextFormatBar (the text note's bar, ADR-041), NoteLinkPicker ([[), FindReplaceBar (talks to a FindTarget),
                       #   VersionBand (a kept version on screen, ADR-042)
                       # QuickNoteBar (the home's capture bar); SelectionBar (select mode's actions in its place: words, or
                       #   icons alone where the column is narrow; LL-091)
    kanban/            # KanbanBoard, KanbanColumn, KanbanCard
    reorder/           # The reorder engine's parts (ADR-038): ReorderHandle (pan, screen reader actions, arrow keys),
                       #   ReorderSlot (where the item in the air lands), ReorderOverlay (the lifted copy),
                       #   useReorderContainer (a container's scroll, edge scroll), useItemSlide, scrollViews
    settings/          # Settings UI system (Section, SectionHeader, SectionWrapper, items/)
    vault/             # VaultScaffold (shared chrome for the 6 vault screens) + VaultBackupButton (optional quick export before a risky op)
    dialogs/           # ComplexDialog, ConfirmOrCancelDialog, SecretPassphraseDialog, VaultPromptDialog; KEEP_DIALOG_TOUCHES (spread
                       #   onto a library <Dialog>: a tap on its own content doesn't reach the backdrop and close it, native + web)
    inputs/            # BaseInput, CodeInput, SearchNotesInput
    lists/             # FavoriteCategoryList, OrderedCategoryList, OrganizeCategoryList
    todo/              # TodoItem (one row for every platform), TodoList (.web: a ScrollView): a list on the engine
    ai/                # AIEditorActions.tsx (before/after preview: title, category -- ADR-027 --, rewrites), one file for the
                       #   phone and the desktop (centered cards and Esc on desktop, ADR-034)
    icons/             # Custom icon components
    lottie/            # LottieAnimation.tsx, LottieAnimation.web.tsx
    webhook/           # WebhookItem
    renderers/         # ContextMenu
    ui/                # Design primitives: AppBackground, GlassSurface, IconChip, PopupMenu (under a trigger, or `at` a point;
                       #   options, labels, dividers, a row of icon switches, a destructive option), MarkedText (marked ranges),
                       # ImageViewer (full screen, pinch/pan/double tap), TourSpotlight, TourTip, BlinkingDot,
                       # ProgressBar (a download: AI model, APK update), DropSlot (where a dragged card or row lands),
                       # EmptyState (an empty list: notes / category / search / trash, its drawing, title and sentence),
                       # MenuItemPop (the staggered pop of an overlay menu's items)
      illustrations/   # The drawings (react-native-svg, 176 x 112, "ghost cards"): EmptyNotes, EmptyCategory, EmptySearch,
                       #   EmptyTrash, Crash; tokens.ts holds their shared values (ghost card, lit card, tile, line, accent)
    # Standalone: CategoryIcon, LoadingSpinner, SafeAreaView, Sidebar, VirtualNumberKeyboard
    CrashScreen.tsx    # The error boundary's fallback (ADR-035): reopen, a report sent in place; no store, router or useTranslation

  slicers/             # Redux state management
    store.ts           # Store configuration (nested persist, notes through the note store, legacy fold, typed hooks)
    notesSlice.ts      # Notes state: CRUD, trash, filters, revisions, cloud outbox, sync plans/pushes (29 reducers)
    categoriesSlice.ts # Categories state: CRUD, moveCategory (a drop: renumbers, queues the changed), categoryOrder,
                       #   cloud outbox, sync plans/pushes (10 reducers)
    settingsSlice.ts   # App settings: language, security, cloud, AI, dev mode (14 reducers)
    thunks/
      notes.ts         # wipeNotes (+ the cloud collection)
      duplicateNote.ts # A copy of a live note (libs/noteCopy) through addNote, with the type's "note added" webhook
      restoreVersion.ts # A kept version's title and content back in the note as an ordinary edit (ADR-042)
      categories.ts    # wipeCategories (+ the cloud collection)

  types/               # TypeScript type definitions
    index.ts           # Barrel re-export (type-only exports)
    note.ts            # NoteBase, TextNote, TodoNote, KanbanNote, CodeNote, Note (discriminated union)
    category.ts        # Category interface
    settings.ts        # SettingsState, CloudSettings, Webhooks, VoiceRecognitionSettings, etc.
    store.ts           # RootState (manually defined), NotesState, CategoriesState
    common.ts          # Timestamped, Ordered (structural contracts for sort utils)
    config.ts          # AppConfigs interface

  hooks/               # Custom React hooks
    useCloudSync.ts    # Cloud sync lifecycle management (connect, disconnect, full sync, handshake)
    useLiveNote.ts     # Open editor: reloads changes merged from other devices, publishes presence
    useNoteSearch.ts   # The home's search: every category's notes, 100 ms after the last keystroke, warm-up while idle (ADR-040)
    useTodoList.ts     # A list note's state and actions, shared by both list editors: every action computes from the
                       #   current note (stable handlers), so typing in an item renders that row only (LL-018)
    useRouter.ts       # Expo Router wrapper with push-debounce (1000ms guard)
    useSecret.ts       # Secret code / biometric authentication
    useNetInfo.ts      # Network connectivity state: NetInfo on native; .web.ts reads libs/netStatus (one probe, only with a
                       #   cloud connected and the window visible, LL-082)
    useCloudStatus.ts  # The cloud's state (ok / offline / unreachable) for the home's line and the status dot (ADR-029)
    useVaultUnlocked.ts # useSyncExternalStore over vaultSession (is the DEK loaded?)
    useVaultPrompt.ts  # useSyncExternalStore over vaultPrompt (does encryption need attention?)
    useVaultProgress.ts # useSyncExternalStore over vaultProgress (re-upload progress bar)
    useEngineSupport.ts # Desktop: whether the AI engine library loads here (ai_info), once; null elsewhere (ADR-034)
    useAppFonts.ts     # The Geist fonts: built into the apps (expo-font plugin, ADR-025), loaded on the web (.web.ts)

  libs/                # Third-party service wrappers
    ai/                # On-device LLM (Qwen3.5 0.8B/2B/4B): llama.rn on the phone (ADR-004), llama.cpp in the Tauri shell on
                       #   desktop (ADR-034, see "Desktop AI Engine" below)
      types.ts         # AIModelId, AIModelStatus, EditorAction, EditorActionResult, AITimings
      constants.ts     # Model catalog (pinned GGUFs), legacy id map, per-action sampling/token budget, prompts, GBNF
      helpers.ts       # Category matching, HTML stripping, think stripping, stream throttle, rewrite guard, answer cleanup
                       # (tested by scripts/ai.test.mjs)
      blocks.ts        # A text note's HTML as lines to rewrite (split/join, structure kept), the summary on top, token
                       # estimate, chunking (pure, tested by scripts/ai.test.mjs)
      longNote.ts      # Long notes: a rewrite line by line, a summary in parts then merged, step cache, time estimate
                       # (tested with a stub model)
      context.ts       # LLM context lifecycle (pre-warm, idle/background release), generation, one for both platforms: it
                       # reaches the engine through engine.ts and the files through models.ts (below)
      engine.ts        # The phone's engine: llama.rn (initLlama), isEngineAvailable, getEngineSupport (RAM from expo-device)
      engine.web.ts    # The desktop's: the Tauri commands ai_info / ai_load / ai_tokenize / ai_complete / ai_stop / ai_release;
                       # a plain browser has none (supportsAI() is false). Flushes the open note before each completion
      models.ts        # The phone's model files: modules/fastmemo-downloads (Android DownloadManager, picked up after a
                       # restart -- ADR-028), models in the app's shared-storage folder (older downloads still read from
                       # files/models/)
      models.web.ts    # The desktop's: ai_model_files / ai_download / ai_download_cancel / ai_delete_files over a Channel
      modelFiles.ts    # What both share: which files make up a model (getAllModelFiles), the catalog's sizes, the settings'
                       # change on a finished download
      platformConstants.ts      # The phone's CONTEXT_SIZE, USE_MLOCK, DEFAULT_MODEL_ID, MODEL_SPEED; supportsAI()
      platformConstants.web.ts  # The desktop's (bigger contexts, 2B default, bigger long-note parts); supportsAI() = Tauri only
      desktopDefaultModel.ts    # One-time move of a desktop's stored 0.8B default to the 2B (@aiDefaultModelChecked)
      evalReport.ts / evalReport.web.ts  # Saving the evaluation's report: expo-sharing / ai_save_eval_report + the save dialog
      eval.ts          # Developer-only evaluation run over evalFixtures.ts (Developer options -> AI evaluation)
      index.ts         # Barrel export: the same on both platforms (Metro picks the .web variants of what it re-exports)
    haptics/           # Platform-split: native (expo-haptics) / web (no-op stubs)
    apkUpdater.ts      # GitHub APK only (ADR-031): isApkBuild() (its installer module is linked), download + hand-off to
                       # the system installer; .web.ts stubs. The module: modules-apk/fastmemo-installer, linked by
                       # react-native.config.js only with FASTMEMO_DISTRIBUTION=github (eas.json production-apk)
    i18n/              # i18next setup + 7 locale files
    storage/           # noteStore.ts: the notes one value per note (ADR-018), over noteStoreBackend (native: files in
                       #   fastmemo-notes/, async legacy API; web: IndexedDB `v2:*`, Web Locks); notes.ts: the app's
                       #   instance (store.ts, wipe thunk); fsStorage: the previous single value (read to migrate)
                       #   + legacyRootNotes.ts: one-shot fold of the notes copy out of `persist:root`
    flushOnExit.ts     # Platform-split: flush pending editor batches + persistor on background / hide / window close
    messageGuard.ts    # Platform-split (web): the app page hears `postMessage` only from itself and its iframes (LL-060)
    cloud/             # Cloud sync (ADR-016, ADR-017)
      types.ts         # CloudBackend contract (devices, vault, data, push, listeners, ack, presence, deviceLimit, pacing)
      firebaseBackend.ts # The Firestore implementation: the ONLY importer of firebase/*
      serverBackend.ts # The fastmemo-server implementation (/v1 over fetch: feed, long poll, device token)
      router.ts        # CloudRouter: forwards every call to the backend the settings' `provider` names
      scope.ts         # providerOf, cloudScope (what keys the DEK cache and the token), normalizeServerUrl, isPlainHttp
      vaultRead.ts     # toVaultRead(): the vault doc check both backends share
      index.ts         # `cloud` (the router over both backends), isCloudConnected / only_if_cloudConnected, device uuid
      revision.ts      # noteRev / nextRev / touchNote / baseOf, deletion stubs, tombstone pruning (pure)
      merge.ts         # Merge rules: planner for incoming versions, full-sync reconcile, categories (pure)
      syncEngine.ts    # Listeners -> merge -> persist -> debounced ack; throttled pushes with backoff; poll; presence
      sync.ts          # The app's engine (bound to the store) + event bus (applied/devices/removed/vaultStale/tooLarge)
      presence.ts      # useNoteOpenElsewhere(): which other device has a note open
      token.ts         # contentToken(): stable hash of queue content (guards the ack)
      size.ts          # Note size per cloud (ADR-026): jsonBytes, FIRESTORE_NOTE_MAX_BYTES, textLimitFor
    registry.ts        # In-memory Map for passing non-serializable data between screens (+ vault continuation / recovery-key transport, pending editor flushes)
    localization.ts    # Locale detection wrapper (expo-localization + web fallback)
    secureStore.ts     # Platform-split (.web.ts): expo-secure-store / localforage key-value
    vaultSession.ts    # In-memory DEK + pub/sub; persist/load/wipe via secureStore (namespaced by projectId)
    vaultManager.ts    # Vault orchestration: probe/initialize/migrate/unlock/recover/changePassphrase/recreate
    vaultPrompt.ts     # Ephemeral pub/sub signal: "encryption needs attention" (drives VaultPromptDialog)
    vaultProgress.ts   # Ephemeral pub/sub signal {done,total} for the re-upload determinate progress bar
    appIcon.ts         # Alternate app icon (expo-alternate-app-icons, ADR-020); .android.ts confirms and closes the app, .web.ts: none
    net.ts             # Calls to the user's servers (FastMemo server, webhooks); .web.ts: through Rust on desktop (src-tauri/src/net.rs, ADR-017)
    desktopCommands.ts # Desktop shortcuts + macOS menu commands: press on-screen controls (SHORTCUT_TARGET), web only
    desktopMenu.ts     # macOS menu labels (i18n menu.*) and its items' commands, the tray's labels; .ts no-op, .web.ts on Tauri
    mcp/               # The local MCP server's page side (ADR-032, see "Local MCP Server" below), tested by scripts/mcp.test.mjs
      bridge.web.ts    # Listens for Rust's requests, fills McpDeps with the real app, answers through `mcp_reply`; bridge.ts no-op
      handlers.ts      # The tools. Pure over McpDeps, so the tests give it a store of their own
      policy.ts        # What an agent may reach (never locked or hidden): every tool gets at the notes through this
      noteInput.ts     # A note as an agent describes it -> one the app stores; title, category and flag rules
      noteEdit.ts      # edit_note's changes, applied to a copy
      noteView.ts      # A note as an agent reads it: images out, pages, search text, snippets
      help.ts          # A help topic's text from its i18n strings
      settingsApi.ts   # The settings page's way to Rust (switches, connection info), MCP_TOOLS
      snippets.ts      # What to paste into each AI client
      types.ts         # What Rust and the page exchange: McpRequest, McpReply; and UpdateCheck
    windowReady.ts     # Desktop: shows the window (hidden at launch) once the first screen is drawn (ADR-022); .ts no-op
    search/            # One search (ADR-040), no React: fold (case and accents, same length), lines (noteDoc: what a note says;
                       #   a protected note's title alone), tags (words with #), search (matching, groups, the line), cache
                       #   (docOf, kept against the note object; warmUp while idle), findOnOpen (the word a result hands its note)
    noteCopy.ts        # copyOfNote: a copy sharing nothing with the original (new ids inside), the flags spec A.4 gives
    history/           # Version history (ADR-042): limits (pure: what a version holds, shouldKeep, the limits, replacedByPlan),
                       #   store (the queue over a backend of named values), backend (files in fastmemo-history/) / .web
                       #   (IndexedDB fastmemo-history), labels (Today/Yesterday), index (keepVersion when idle, startHistory)
    links.ts           # normalizeLink (https, mailto, tel only), note links as #fm-note-<id> (ADR-041)
    noteHtml.ts        # The 4.1.0 lines' CSS for the editor and for print (BlockColors, PRINT_BLOCK_COLORS)
    listOps.ts         # A list note's item operations, pure (insertAfter, removeItem, visibleItems, withoutDone, ...)
    findTarget.ts      # What the find bar talks to: createTextFindTarget (the text page), createCodeFindTarget (CodeMirror)
    diagnostics/       # What an error and a report carry (ADR-035)
      index.ts         # initDiagnostics (Sentry init, tags, user id), setDiagnosticsContext, reportHandled, reportPageError,
                       #   addTrail, collectAlwaysFacts
      installId.ts     # The installation code FM-XXXX-XXXX (random, @installId, kept by "wipe data"), getInstallId / peek
      facts.ts         # The system, the platform kind, the version with its update; .web.ts: the system's name only
      report.ts        # The report payload (pure, shared with the crash screen), the three-a-day log, sendReport (never throws)
      scrub.ts         # The trail's allow-list (beforeBreadcrumb), routePattern, hostKind, scrubEvent, isTransientNetworkError
                       #   (scripts/diagnostics.test.mjs)
    reloadApp.ts       # Reopens the app (expo-updates reload, DevSettings fallback); .web.ts: a page reload
    reducePhoto.ts     # A picture as it goes into a note or a report: 1600 px long side, JPEG 0.6, base64 (LL-083, LL-088)
    kanbanOps.ts       # moveCard: returns the board unchanged when the move can't complete (LL-078, scripts/kanban.test.mjs)
    reorderDrop.ts     # Where a dragged item lands (boards: N containers; lists, categories: one), from the rectangles
                       #   measured at lift (without it) and the scroll since: findDrop, withoutItem, isOwnPlace,
                       #   toMoveIndex, slotInItems, edgeStep (worklets); moveById, stepIndex on one array (ADR-037,
                       #   ADR-038, scripts/reorder-drop.test.mjs)
    reorderSlides.ts   # forgetSlides: .web.ts clears Reanimated's leftover layout animations before a drop (WebKit)
    netStatus.ts       # createNetStatus: the web/desktop connection status, one probe timer for the app (LL-082,
                       #   scripts/net-status.test.mjs)
    quickNoteDraft.ts  # The quick note bar's unsent text, kept on the device (@quickNoteDraft, LL-084)
    codeEditorPage.ts  # The code note's page: buildCodeEditorHtml, serializeForScript (data that can't break the page, LL-077,
                       # scripts/code-page.test.mjs)
    pageErrors.ts      # The script an editor page runs to forward its errors (FASTMEMO_PAGE_ERROR, ADR-035)
    richTextEditor.ts  # The text editor's page script (line types, code exit, bullets, images, the image menu's messages) and style
                       # (ADR-023, ADR-024, scripts/richtext.test.mjs). ADR-041: messages to the app STATE_MESSAGE (the bar's
                       # state), LINK_MESSAGE / LINK_START_MESSAGE, PICKER_MESSAGE / PICKER_KEY_MESSAGE / NOTE_LINK_MESSAGE,
                       # IMAGE_MESSAGE, COUNT_MESSAGE; commands lineCommand, formatCommand, RULE_COMMAND, the link commands
                       # (linkCommand, LINK_START/CANCEL, UNLINK), the picker's (noteLinkCommand, PICKER_CLOSE, pickerShown,
                       # PICK_START), imageCommand. Structural changes are pageChanges (recorded, one undo each)

  utils/               # Pure utility functions
    sort.ts            # Sort comparators for Timestamped/Ordered items; importantFirst (LL-080)
    noteEmpty.ts       # isTodoNoteEmpty / isKanbanNoteEmpty: no title and nothing typed (empty rows/cards count as none)
    noteType.ts        # isKnownNoteType: the types this version opens; any other is shown as "update to open" (ADR-039)
    imageSize.ts       # resizeFor, PHOTO_LONG_SIDE, PHOTO_QUALITY: the size a picture is reduced to (pure)
    string.ts          # String validation, formatting, size computation
    date.ts            # Date formatting with locale awareness
    dateParse.ts       # Stored date string -> timestamp (pure, no i18n: imported by libs/cloud/revision)
    crypt.ts           # Note encryption/decryption (CryptNote); reads DEK from vaultSession, CONTENT_MAGIC auth marker
    vault.ts           # Envelope-encryption primitives (createVault/unlock/recover/rewrap, canary, PBKDF2 via crypto-js)
    secureRandom.ts    # OS CSPRNG bytes (WebCrypto getRandomValues, expo-crypto fallback)
    ui.ts              # yieldToUI() — let the spinner paint a frame before a synchronous freeze
    toast.ts           # Platform-split toast notifications
    webhook.ts         # Webhook dispatcher (sends through @/libs/net)
    export.ts          # PDF/text export, file sharing, an image's share (phone) / save (web, desktop)
    dataUrl.ts         # An image's data: URL -> MIME type, base64, file extension
    platform.ts        # Tauri detection
    openUrl.ts         # Cross-platform URL opener

  providers/           # React context providers
    AppUpdateProvider.tsx   # Update check (/api/version): the icon, the desktop installer prompt, the APK's prompt + download
    ReorderProvider.tsx     # The reorder engine (ADR-037, ADR-038): boards, lists, categories; measures at lift; contexts: a
                            #   value that never changes (shared values, register/lift/release/move, itemLayout), the item in
                            #   the air, the preview (where the slot is), and the web's sliding signal
    SyncOnProvider.tsx      # Headless: runs the sync engine while connected + unlocked, turns its events into UI
    DiagnosticsProvider.tsx # Headless: Sentry's language and cloud tags, the route trail (as patterns, ADR-035)

  constants/           # Static constants
    styles.ts          # COLOR, CARD_TYPE_COLOR, GLASS, BLUR, SHADOW, LIFT, FONT, FONTSIZE, FONTWEIGHT (pre-Geist), PADDING_MARGIN,
                       #   BORDER, SIZE, MAX_WIDTH, MONOSPACE_FONT
    motion.ts          # DURATION (fast/base/slow), EASING (enter/exit), SPRING (soft/snappy), LOOP: every animation's values
    icons.ts           # Available category icon names
    code-languages.ts  # Supported code editor languages; PLAIN_TEXT_LANGUAGES (no highlighter in the page, LL-086)
    note-types.ts      # Note type metadata
    app-icons.ts       # Alternate app icons: AppIconName (= the plugin names in app.config.ts), labels, previews (ADR-020)
    help-topics.ts     # The help topics fastmemo_help lists, in the order of the help screen (scripts/mcp.test.mjs checks the two)

  configs/             # App configuration
    index.ts           # Main config (env vars, app metadata, business rules, cloud, sentry, firebase)
    default.ts         # Factory defaults (defaultCategory)

  editor/              # Sources bundled into strings that the editors' pages run (`yarn build:editor`)
    codemirror-entry.js # CodeMirror 6 for the code editor WebView (scripts/build-codemirror.mjs)
    sanitize-entry.ts  # DOMPurify + hooks in the rich text editor's page (scripts/build-sanitize.mjs; LL-060, ADR-021)
    sanitizeConfig.ts  # What a note's HTML keeps (the editor's page and the web PDF export)
  generated/           # Those scripts' output, committed (codemirror-html.ts, editor-sanitize.ts): never edit by hand
```

## Data Flow

### State Management Architecture

```
                    Redux Store (configured in slicers/store.ts)
                    ============================================

        +------------------+  +-----------------------+  +------------------+
        |   notesSlice     |  |   categoriesSlice     |  |  settingsSlice   |
        |  (29 reducers)   |  |    (9 reducers)       |  |  (14 reducers)   |
        |                  |  |                       |  |                  |
        | items: Note[]    |  | items: Category[]     |  | language, secret |
        | temporaryItems[] |  | cloud.items.add {}    |  | cloud, webhooks  |
        | filters {}       |  | cloud.items.delete {} |  | ai, devMode, etc |
        | cloud.items {}   |  +-----------------------+  +------------------+
        +------------------+           |
               |                       |
               v                       v
        +------------------------------------------+
        |         Cloud Sync Outbox Pattern         |
        |  Reducers stamp `rev` (touchNote) and     |
        |  queue into cloud.items.add / .delete /   |
        |  .detach via only_if_cloudConnected()     |
        +------------------------------------------+
               |                       ^
               v                       | applyNotesPlan / notesPushed
        +------------------------------------------+
        |   SyncEngine (libs/cloud/syncEngine.ts)   |
        |  One task at a time: merge incoming       |
        |  (planner, flush editors first) -> persist|
        |  -> ack; push outbox (encrypt at push)    |
        +------------------------------------------+
               |
               v
        +------------------------------------------+
        |   CloudBackend (FirebaseBackend)          |
        |  notes/, categories/, tombstones/,        |
        |  vault/config, connectedDevices/{uuid}:   |
        |  fan-out queues, devicesToSync,           |
        |  fullSyncDue, lastSync, presence          |
        |  onSnapshot devices + vault; guarded      |
        |  transactional push and ack               |
        +------------------------------------------+
```

### Cloud Sync Encryption Gate (per-vault E2E -- ADR-012)

All cloud sync is gated on the **vault** being unlocked. The encryption key (DEK) lives only in `libs/vaultSession.ts`
(in-memory + secure-storage cache), never in Redux or Firestore.

```
connect (handshake)
  -> probeVault()  [libs/vaultManager.ts]
       present       -> vault-unlock   (enter password -> derive KEK -> unwrap DEK -> cache)
       needsMigration-> vault-setup?mode=migrate
       absent        -> vault-setup?mode=create
       error         -> abort + toast (never write on an unproven read)
  -> DEK obtained -> registry continuation finalizes the connection / resync

queueCloudAdd (notesSlice)   -> gated on isVaultUnlocked(); CryptNote.encrypt uses the cached DEK
                                (per-note AES only — fast; PBKDF2 runs ONLY at setup/unlock/reset)
queueCloudDelete / detach    -> id + revision stub (no DEK needed; propagates while locked)
syncCloudData (full sync)    -> SyncEngine.fullSync(onProgress) -> vaultProgress (begin/set/clear) -> determinate
                                bar on the vault-recovery / vault-unlock / connect (resync) loaders
SyncOnProvider               -> the engine runs only while useVaultUnlocked(); its vault listener (server
                                snapshots) re-validates the DEK (dekMatchesVault) and reports vaultStale -> re-lock
```

`readVault()` (vault presence + DEK-staleness checks) uses a **server read** (`getDocFromServer`), never Firestore's local cache
— a cached old vault doc would mask a reset done on another device and survive restarts (see LL-027). Listeners act only on
server-confirmed snapshots (not `fromCache`, no pending local writes). Offline -> "error" -> callers skip (no false
lock/create). A note is never lost to slow encryption/upload: it is written to local state (plaintext, persisted) before
`queueCloudAdd`, and the outbox keeps every entry until a push commits it (the engine retries with backoff, 2s -> 5 min). An
upload entry is a marker `{ id, rev }`, a new object per commit: nothing is encrypted in a reducer, the engine encrypts the
stored note at push (ADR-036; an encrypted copy queued by 4.0.0 is accepted the same way).

### Cloud Sync Engine (ADR-016)

```
other device push -> connectedDevices/{sender}: queues + devicesToSync = every other device
  -> onSnapshot (server) -> SyncEngine.processDevices
       removed from the list? -> onRemoved (disconnect)
       per sender ChangeSet: readVersions (fetch references, decrypt; unreadable -> vault check)
         -> flushPending() -> createPlanner(state).add/remove/detach -> applyNotesPlan
         -> persistor.flush() -> ackChanges once the sender is quiet 5 s (max 30 s; transaction: only if the queues
            are still the merged ones)
         -> onApplied {changed, conflicts} -> toast + open editor reloads (useLiveNote)
local change -> reducer: touchNote (rev) + outbox -> store.subscribe -> kick (200 ms, >= 2 s after the last push)
  -> pushOutbox: adoptLegacyOutbox, encrypt the stored note now, base = baseOf(note)
  -> backend.push (transaction per chunk: guarded writes, exclusive fan-out entries, tombstones, recipients = the
     other devices; queues over budget (bytes + index entries) -> start over, laggards get fullSyncDue; nothing
     applied -> no write)
       committed -> notesPushed (dequeue if unchanged, syncedRev = pushed rev)
       superseded (cloud newer than base, or equal) -> merged as incoming, then pushed again
       rejected (e.g. > 1 MiB) -> kept queued, skipped until next launch
full sync (connect/unlock/"sync now"/fullSyncDue) -> pull queues -> reconcile(fetchNotes, fetchTombstones)
  -> clearFullSyncDue -> push; due again until it completes
every 5 min / resume -> reconnect the transport (if idle or stuck > 60 s) -> pullDevices
presence: editor open -> setPresence(noteId) (debounced, 5 min heartbeat) -> others: useNoteOpenElsewhere
```

### Self-Hosted Server Backend (ADR-017)

```
cloud (CloudRouter) -> providerOf(settings): "firebase" (default, also for settings saved before) | "server"
ServerBackend -> fastmemo-server /v1 (repo ../fastmemo-server, docs/PROTOCOL.md)
  connect: verify = GET /v1/info with the key (server + protocol 1, maxDevices) -> vault, notes, devices with the key
           -> once unlocked: POST /v1/devices -> token -> secure storage serverToken_<cloudScope> -> Bearer from now on
  edit:    connected + Save: cloud.check(new) on its own connection (fails -> dialog, still connected as before);
           same cloudScope -> engine stop + idle, init, save, start (no re-register); another cloud -> leave it, then connect
  token:   read / none stored / unreadable (read again); writes serialized; a request whose connection changed is dropped
  live:    pollLoop: GET /v1/sync?v=<version>&wait=25&p=<page> -> devices + vault listeners;
           feed page -> deliver as one ChangeSet (token "<page>|<seq>") -> engine merge -> POST /v1/ack { token: seq }
           error -> backoff 1 s .. 30 s; 401 device_unknown for the token held (no registration running)
           -> token dropped, empty device list -> engine onRemoved
  read:    GET /v1/notes?after=<seq>&bytes= -> { notes, next } until next is null (later page wins)
  push:    POST /v1/push (<= 4 MB / 500 entries per request; 413 -> halve, a single entry -> rejected;
           a timeout halves the request size for the next tries, down to 256 KB; pages likewise)
  pacing:  push >= 500 ms apart, ack after 1 s quiet (<= 5 s)
server:   items (kind, key, state live|deleted|detached, rev, seq, author, data) + devices (token_hash, cursor)
          + vault + stats (per day) + events; dashboard at / (admin key)
```

### Local MCP Server (ADR-032)

Desktop only, off until the user enables it (`app/settings/mcp.web.tsx`, entry gated by `isTauri()`).

```
AI client starts <the app's binary> --mcp          main.rs, before Tauri: no window, no Dock icon
  bridge.rs: stdin line -> socket -> reply -> stdout (JSON-RPC only; logs on stderr)
    app away: initialize, server/discover, tools/list answered from what's compiled in; each call -> "isn't reachable";
    connects again on the next line; one connection for the session (its rights are tied to it)
  endpoint.rs: <home>/<id>/mcp/sock in a 0700 directory (macOS Application Support, Linux .local/share)
    Windows: owner-only named pipe, a new name for each start, published in %APPDATA%\<id>\mcp\pipe-name
  server.rs: one thread per connection, each with its own AppRunner (mod.rs) and Session (session.rs: owned ids, 30 writes/min)
  protocol.rs: both eras (2026-07-28 server/discover + _meta; 2025-11-25, 2025-06-18 initialize); tools/list -> listed_tools(settings);
    a tool switched off -> tool error (tools.rs holds the definitions and the defaults)
  page.rs: request { id, tool, args, scope: { editAll, ownedIds } } -> event fastmemo://mcp-request to the main window; waits 10 s
page: libs/mcp/bridge.web.ts -> handlers.ts
  refused until rehydrated and the notes were read (LL-029, LL-039)
  flushPending (ADR-013) -> policy.ts (locked, hidden: "No note with this id.", as for an id that doesn't exist)
  write: dispatch (touchNote + outbox, like any change) -> an existing note: notifyNoteChanged (an open editor reloads, no toast)
         -> flushNow (on disk before it's answered) -> the user's webhook
  -> invoke("mcp_reply", { id, reply: { text, isError, createdId? } }); createdId -> Session.own
```

**Settings:** `mcp.json` in the app's config directory (macOS `~/Library/Application Support/<id>/`, Windows `%APPDATA%\<id>\`,
Linux `~/.config/<id>/`): `{ enabled, tools: { <tool name>: bool }, keepRunning }`, a tool not listed having its default. Owned
by Rust (`settings.rs`, written by temp file and rename), read at launch and through `mcp_get_settings` / `mcp_set_settings`:
per device, never in Redux, never synced. `apply_settings` (`mod.rs`) saves them and starts or stops the server, one change at a
time, and syncs the tray.

**Window closed:** `tray.rs`. macOS never has a tray (ADR-022). Windows and Linux: with `enabled` and `keepRunning`, closing
hides the window and an icon stays, with Open and Quit; otherwise closing quits. See "Sync while hidden" in ADR-032 for what the
engine does.

**An app window, not a browser (ADR-033):** the dark theme is the window's config (`theme`, Windows and macOS);
`window_chrome.rs` paints Windows 11's title bar `#05091A`, trims WebView2's text-field menu to cut/copy/paste and tells a
minimised page it is hidden. `useKeyboardShortcuts.web.ts` blocks the browser's keys and its right-click menu outside text
fields and selections; `RICH_TEXT_SCRIPT` does Cmd/Ctrl+B/I/U itself (WebKit on macOS leaves them to a Format menu the app
doesn't have).

### Desktop AI Engine (ADR-034)

Desktop only (macOS, Windows x64, Linux x64). The phone's AI is llama.rn (ADR-004); the shell's is llama.cpp in a library the
app opens when the AI is first used.

```
page: context.ts --> engine.web.ts / models.web.ts --invoke("ai_*")--> src-tauri/src/ai/mod.rs
  mod.rs      the commands; one engine call at a time ("busy"; release and quit stop it and wait); stop and cancel counted, so one sent early is kept; nothing starts on quit
  library.rs  libloading: opens LIBRARY_FILE once (macOS Frameworks, Windows/Linux resources "ai/"); checks fm_ai_abi_version == 1
              -> Unavailable { Cpu | Missing | Abi | Error } = no AI; the app is unaffected
  system.rs   total memory (sysctl / GlobalMemoryStatusEx / /proc/meminfo), inference_threads() = half the cores, cpu_supported() (AVX2+FMA+F16C)
  download.rs Hugging Face only -> <file>.part -> Range resume -> size + SHA-256 -> rename; progress ~4/s over a Channel
    --> fm_ai_call(JSON request, on_token callback, stop flag) --> fm_ai_free(answer)
src-tauri/ai-engine/ (crate fastmemo-ai, cdylib fastmemo_ai; its own workspace and Cargo.lock; llama-cpp-2 =0.1.161)
  ffi.rs      the three C functions; catches panics -> {"error":"panic"}
  json.rs     a small JSON parser and writer (the crate takes no serde)
  engine.rs   ops load / tokenize / complete / release; every request checked before llama.cpp sees it; mmap, Metal on aarch64 macOS;
              the system turn's state kept and restored for the next prompt; a prompt over n_ctx refused (truncated), context_full
  prompt.rs   Qwen3.5's chat prompt, thinking off      sampling.rs  the sampler chain's order      stream.rs  whole UTF-8 chars, stop-word holdback
  stub.rs     built without the `llama` feature: ABI version 0, every op "no_engine"
  tests/real_model.rs, examples/bench.rs: need FASTMEMO_AI_MODEL (a GGUF), run from src-tauri/ai-engine
```

**Build and bundle:** `scripts/build-ai-engine.mjs` is the first step of Tauri's `beforeBuildCommand` / `beforeDevCommand`: it
builds for `TAURI_ENV_TARGET_TRIPLE` (the host's if unset) into `src-tauri/ai-engine/dist/` (gitignored), always `--target`,
always with cargo running from `src-tauri/ai-engine` so its `.cargo/config.toml` applies (AVX2/FMA/F16C on x86_64, static CRT on
MSVC). The macOS dylib gets the install name `@rpath/libfastmemo_ai.dylib` and an ad-hoc signature; Intel Macs build with
`GGML_METAL=OFF`. The bundle places it per OS in `tauri.macos.conf.json` (`frameworks`, with `Entitlements.plist`),
`tauri.windows.conf.json` and `tauri.linux.conf.json` (`resources` to `ai/`). `src-tauri/build.rs` leaves an empty file when the
library wasn't built, which `library.rs` reads as missing.

**Files and settings:** models in `app_local_data_dir()/models/`, evaluation reports in `ai-eval/` beside it. The AI settings
stay in Redux, per device (`settings.aiAssistant`, not synced). The page's RAM gate reads `totalMemory` from `ai_info`.

### Persistence Architecture

```
Redux Persist (nested -- see DECISIONS.md ADR-003)
==================================================

Root persistReducer (key: "root", AsyncStorage)      blacklist ["notes"] once the legacy copy is folded
  |
  +-- notesSlice persistReducer (key: "root_notes", serialize/deserialize: false)
  |     Storage: the note store (ADR-018): one value per note, written only when that note changed
  |       (outbox entries, then notes, then a small `state` value: entry list, settings, deletions
  |       waiting, tombstones), a few at a time
  |       native: files/fastmemo-notes/<escaped name>.json (.tmp + rename) / web: IndexedDB `v2:<name>`
  |     Migration: the previous single value (files/reduxPersist/persist:root_notes, IndexedDB
  |       `persist:root_notes`) on the first launch, then a `migrated` marker; the old value is kept
  |       14 days for a rollback (folded back by revision), removed by "Wipe data"; older: AsyncStorage
  |
  +-- categoriesSlice persistReducer (key: "root_categories")
  |     Storage: AsyncStorage
  |
  +-- settingsSlice persistReducer (key: "root_settings")
        Storage: AsyncStorage

All configs: timeout 0 (never rehydrate empty state on a slow read, LL-029).
```

Boot order (`store.ts`): `persistStore(store, { manualPersist: true })`, then `foldLegacyRootNotes(notesStorage)` merges the old
notes copy from `persist:root` into the notes storage (backup under `backup:root-notes`, marker `fastmemo:root-notes-folded`),
and only then `persistor.persist()`. If the fold can't finish, notes keep persisting in the root blob for that session. The note
store then reads its `state` value and entries (or, the first time, the folded single value: its first write migrates).

Edits reach the store in batches (`useNoteEditor`: debounce 500ms / max 2s native, 300ms / 1s web). Pending batches register in
`registry.ts`; `flushOnExit` (installed in `_layout`) flushes them plus `persistor.flush()` on AppState background, page hide,
or a desktop quit: the Rust shell (`src-tauri/src/lib.rs`) holds a quit from the window (close button on Windows/Linux) or the
app menu (Cmd+Q), emits `fastmemo://flush-before-exit`, and exits on the frontend's `exit_after_flush` or after 2s (Dock Quit,
logout and OS session end aren't held: ADR-015). On macOS closing the window hides it (`fastmemo://hidden`: a flush, no exit;
ADR-022); on Windows and Linux too, while the local MCP server keeps the app running (ADR-032).

### Screen Navigation Flow

```
index (boot)
  |-- [first launch] replace --> intro --> setup-secret-code --> replace --> home
  |-- [returning user] replace --> home

home
  |-- push --> notes/[noteId]        (new-text|new-todo|new-kanban|new-code|<uuid>)
  |-- push --> settings/general      --> settings/* (drill-down hierarchy)
  |-- push --> categories/organize   --> categories/create
  |-- push --> temporary-trash
  |-- push --> changelog             (auto-triggered on version update)

notes/[noteId]
  |-- push --> categories/change     (pick category, then back)
  |-- push --> secret-code           (verify before unlock)

Animation conventions:
  "none"             -> index (loading screen)
  "fade"             -> intro, home (boot flow)
  "fade_from_bottom" -> notes, changelog, secret-code, category create/organize (modal-like)
  "ios_from_left"    -> settings hierarchy, temporary-trash, category change (drill-down)
```

### Provider Tower (Root Layout)

> **Boot polyfill:** `_layout.tsx`'s first import is `react-native-get-random-values`, which installs
> `global.crypto.getRandomValues`. Hermes/RN does not provide it, and `crypto-js` (PBKDF2/AES, used by the vault) needs it for
> its internal IV/salt -- without the polyfill every vault op throws "Native crypto module could not be used to get secure
> random number" on the phone (web/Tauri already have the global). See LL-025.

```
Sentry.ErrorBoundary (fallback: CrashScreen, ADR-035 -- outside everything, it needs none of it)
  I18nextProvider
    KeyboardProvider
      DialogProvider
        Redux Provider
          PersistGate
            SyncOnProvider (headless, returns null)
            DiagnosticsProvider (headless: Sentry tags for language + cloud, the route trail)
            AppUpdateProvider
            (WebViewWarmup is rendered by home, 1s after mount + idle -- not here: it competed with first paint)
              RootSiblingParent (toast overlays)
                StatusBar
                WebToaster (web only, conditional require)
                Stack (expo-router, single flat navigator)
                  33 screens (all headerShown: false, transparentModal)
```

`initDiagnostics()` (Sentry's init) runs at module scope in `_layout.tsx`, before any of this renders.

## Platform Abstraction Strategy

Three patterns are used for platform-specific code:

### 1. File Extension Resolution (Primary)

Metro/Webpack auto-resolves `.web.tsx` / `.native.tsx` file extensions.

Convention:

- `Component.tsx` = native implementation (default)
- `Component.web.tsx` = web override
- Use `.native.tsx` only when both variants exist alongside an `index.ts` barrel

Examples: TodoItem, LottieAnimation, fsStorage, AI module, NoteTodoEditor, AIEditorActions

### 2. Runtime Platform Check with Dynamic Require

Used when the barrel needs to be explicit:

```ts
const Module = Platform.OS === "web" ? require("./module.web").default : require("./module.native").default;
```

Example: `libs/haptics/index.ts`

### 3. No-Op Stub Pattern

When a native module (expo-haptics) has no web equivalent, the web variant provides API-compatible stubs that return safe
defaults (`false`, `""`, `Promise.resolve()`, `{ success: false }`).

Example: `libs/haptics/haptics.web.ts`. The AI is no longer one: its engine and model files are platform splits
(`libs/ai/engine.ts` / `engine.web.ts`, `models.ts` / `models.web.ts`), and the web variants talk to the Tauri shell (ADR-034).

## Component Hierarchy (Key Relationships)

```
home.tsx
  +-- Sidebar
  +-- SearchNotesInput
  +-- CategoryFilterButton (memo)
  +-- FlashList<Note>
        +-- NoteCard (memo) -- renders per note type
  +-- AddNoteOverlayButton (FAB menu)
        +-- AddNoteTextButton, AddNoteTodoButton, AddNoteKanbanButton

notes/[noteId].tsx
  +-- switch(note.type)
        case "text"   -> NoteTextEditor
        case "todo"   -> NoteTodoEditor (.web.tsx variant)
        case "kanban" -> NoteKanbanEditor
        case "code"   -> NoteCodeEditor
  +-- AIEditorActions (.web.tsx variant)

settings/general.tsx
  +-- Section (memo)
        +-- SectionList
              +-- SectionItemList
                    +-- SectionItemList_Navigation | SectionItemList_Text
                          +-- SectionItem_* (19 items)

categories/organize.tsx
  +-- DraggableFlatList (native) / DnD-Kit (web)
        +-- OrganizeCategoryCard
```

## Key Module Dependencies

```
components/notes/* --> slicers/ (useSelector, useDispatch)
                  --> utils/webhook (side-effect on save/delete)
                  --> libs/ai (AI editor actions)
                  --> hooks/useRouter (navigation)

slicers/*Slice.ts --> utils/crypt (encrypt for the cloud outbox)
                 --> utils/sort (note ordering)
                 --> libs/cloud (only_if_cloudConnected) + libs/cloud/revision (stamping) -- no cloud I/O in reducers
                 --> libs/vaultSession (isVaultUnlocked gate before queuing encrypted items)

utils/crypt --> libs/vaultSession (reads the in-memory DEK; encrypt fails closed if locked)
libs/vaultManager --> utils/vault (envelope primitives) + libs/cloud (vault doc) + libs/vaultSession (cache)
providers/SyncOnProvider --> libs/vaultSession + hooks/useVaultUnlocked (engine runs only while unlocked)

libs/ai/context.ts --> libs/ai/engine, models, platformConstants (llama.rn on the phone, Tauri commands on desktop)
                   --> slicers/store (direct getState() for categories, cloud key)
                   --> libs/i18n (language-aware prompts)

providers/SyncOnProvider --> libs/cloud/sync (engine lifecycle + events) + libs/cloud/presence
                         --> hooks/useNetInfo (back online -> engine.resume)

libs/cloud/sync --> slicers/store (store, persistor) + slices (plan/push actions) + libs/registry (flushPending)
libs/cloud/syncEngine, merge, revision --> no app imports (pure; tested by scripts/sync.test.mjs)
libs/cloud/firebaseBackend --> firebase/* (the only place; tested by scripts/sync-firestore.test.mjs)
libs/cloud/serverBackend --> fetch + libs/secureStore (token) (tested by scripts/sync-server.test.mjs, real server)
libs/cloud/router, scope --> settings only (which backend, which scope)

libs/mcp/handlers, noteInput, noteEdit, noteView --> McpDeps + libs/mcp/policy (no store import; tested by scripts/mcp.test.mjs)
libs/mcp/bridge.web --> slicers/store, libs/registry (flushPending), libs/flushOnExit, libs/cloud/sync (notifyNoteChanged)
src-tauri/src/mcp/ --> the page only through an event and `mcp_reply`; the notes never reach Rust except as text on their way out
src-tauri/src/ai/ --> the engine library only through libloading, at the first AI command; the page through `ai_*` commands
src-tauri/ai-engine/ --> llama-cpp-2 (llama.cpp); nothing of the app (its own workspace, not linked into it)
```

## Approximate Scale

| Metric                      | Count            |
| --------------------------- | ---------------- |
| Screens (routes)            | 33               |
| Components (.tsx)           | ~98              |
| Redux reducers              | 52 (29 + 9 + 14) |
| Custom hooks                | 8                |
| Utility files               | 12               |
| i18n locales                | 7                |
| Translation keys            | ~740 per locale  |
| TypeScript type definitions | 7 files          |
| Platform-split file pairs   | ~10              |
