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
      [noteId].tsx     # Dynamic route: note editor (handles create + edit)
    categories/
      create.tsx       # Create/update category (dual-purpose)
      change.tsx       # Change a note's category
      organize.tsx     # Reorder categories via drag-and-drop
    settings/
      general.tsx      # Settings hub
      ai-assistant.tsx # AI model management
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
    buttons/           # 26 button components (each a single-purpose TouchableOpacity)
    cards/             # NoteCard, TrashedNoteCard, OrganizeCategoryCard, OrderedCategoryCard
    notes/             # Note editors: NoteTextEditor, NoteTodoEditor, NoteKanbanEditor, NoteCodeEditor; NoteImageMenu (ADR-024)
    kanban/            # KanbanBoard, KanbanColumn, KanbanCard, KanbanDragOverlay
    settings/          # Settings UI system (Section, SectionHeader, SectionWrapper, items/)
    vault/             # VaultScaffold (shared chrome for the 6 vault screens) + VaultBackupButton (optional quick export before a risky op)
    dialogs/           # ComplexDialog, ConfirmOrCancelDialog, SecretPassphraseDialog, VaultPromptDialog
    inputs/            # BaseInput, CodeInput, SearchNotesInput
    lists/             # FavoriteCategoryList, OrderedCategoryList, OrganizeCategoryList
    todo/              # TodoItem.native.tsx, TodoItem.web.tsx
    ai/                # AIEditorActions.tsx, AIEditorActions.web.tsx
    icons/             # Custom icon components
    lottie/            # LottieAnimation.tsx, LottieAnimation.web.tsx
    webhook/           # WebhookItem
    renderers/         # ContextMenu
    ui/                # Design primitives: AppBackground, GlassSurface, IconChip, PopupMenu (under a trigger, or `at` a point),
                       # ImageViewer (full screen, pinch/pan/double tap), TourSpotlight, TourTip, BlinkingDot
    # Standalone: CategoryIcon, LoadingSpinner, SafeAreaView, Sidebar, VirtualNumberKeyboard

  slicers/             # Redux state management
    store.ts           # Store configuration (nested persist, notes through the note store, legacy fold, typed hooks)
    notesSlice.ts      # Notes state: CRUD, trash, filters, revisions, cloud outbox, sync plans/pushes (29 reducers)
    categoriesSlice.ts # Categories state: CRUD, reorder, cloud outbox, sync plans/pushes (9 reducers)
    settingsSlice.ts   # App settings: language, security, cloud, AI, dev mode (14 reducers)
    thunks/
      notes.ts         # wipeNotes (+ the cloud collection)
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
    useRouter.ts       # Expo Router wrapper with push-debounce (1000ms guard)
    useSecret.ts       # Secret code / biometric authentication
    useNetInfo.ts      # Network connectivity state
    useTimeoutTask.ts  # Debounced async task runner with loading states
    useVaultUnlocked.ts # useSyncExternalStore over vaultSession (is the DEK loaded?)
    useVaultPrompt.ts  # useSyncExternalStore over vaultPrompt (does encryption need attention?)
    useVaultProgress.ts # useSyncExternalStore over vaultProgress (re-upload progress bar)
    useAppFonts.ts     # The Geist fonts: built into the apps (expo-font plugin, ADR-025), loaded on the web (.web.ts)

  libs/                # Third-party service wrappers
    ai/                # On-device LLM (llama.rn, Qwen3.5 0.8B/2B/4B -- ADR-004)
      types.ts         # AIModelId, AIModelStatus, EditorAction, EditorActionResult, AITimings
      constants.ts     # Model catalog (pinned GGUFs), legacy id map, per-action sampling/token budget, prompts, GBNF
      helpers.ts       # Category matching, HTML stripping, think stripping, stream throttle, rewrite guard, answer cleanup
                       # (tested by scripts/ai.test.mjs)
      blocks.ts        # A text note's HTML as lines to rewrite (split/join, structure kept), the summary on top, token
                       # estimate, chunking (pure, tested by scripts/ai.test.mjs)
      longNote.ts      # Long notes: a rewrite line by line, a summary in parts then merged, step cache, time estimate
                       # (tested with a stub model)
      context.ts       # LLM context lifecycle (pre-warm, idle/background release), download, generation (native only)
      eval.ts          # Developer-only evaluation run over evalFixtures.ts (Developer options -> AI evaluation)
      index.ts         # Barrel export (native)
      index.web.ts     # No-op stubs for web
    haptics/           # Platform-split: native (expo-haptics) / web (no-op stubs)
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
      sync.ts          # The app's engine (bound to the store) + event bus (applied/devices/removed/vaultStale)
      presence.ts      # useNoteOpenElsewhere(): which other device has a note open
      token.ts         # contentToken(): stable hash of queue content (guards the ack)
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
    desktopMenu.ts     # macOS menu labels (i18n menu.*) and its items' commands; .ts no-op, .web.ts on Tauri macOS
    windowReady.ts     # Desktop: shows the window (hidden at launch) once the first screen is drawn (ADR-022); .ts no-op
    richTextEditor.ts  # The text editor's page script (line types, code exit, bullets, images, the image menu's messages) and style
                       # (ADR-023, ADR-024, scripts/richtext.test.mjs)

  utils/               # Pure utility functions
    sort.ts            # Sort comparators for Timestamped/Ordered items
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
    KanbanDragProvider.tsx  # Kanban drag-and-drop state (reanimated shared values)
    SyncOnProvider.tsx      # Headless: runs the sync engine while connected + unlocked, turns its events into UI

  constants/           # Static constants
    styles.ts          # COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, BORDER, SIZE, MONOSPACE_FONT
    icons.ts           # Available category icon names
    code-languages.ts  # Supported code editor languages
    note-types.ts      # Note type metadata
    app-icons.ts       # Alternate app icons: AppIconName (= the plugin names in app.config.ts), labels, previews (ADR-020)

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
`queueCloudAdd`, and the outbox keeps every entry until a push commits it (the engine retries with backoff, 2s -> 5 min).

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
ADR-022).

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
I18nextProvider
  KeyboardProvider
    DialogProvider
      MenuProvider
        Redux Provider
          PersistGate
            SyncOnProvider (headless, returns null)
            (WebViewWarmup is rendered by home, 1s after mount + idle -- not here: it competed with first paint)
            RootSiblingParent (toast overlays)
              StatusBar
              WebToaster (web only, conditional require)
              Stack (expo-router, single flat navigator)
                32 screens (all headerShown: false, transparentModal)
```

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

When a native module (llama.rn, expo-haptics) has no web equivalent, the web variant provides API-compatible stubs that return
safe defaults (`false`, `""`, `Promise.resolve()`, `{ success: false }`).

Example: `libs/ai/index.web.ts`, `libs/haptics/haptics.web.ts`

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

libs/ai/context.ts --> llama.rn (native LLM)
                   --> slicers/store (direct getState() for categories, cloud key)
                   --> libs/i18n (language-aware prompts)

providers/SyncOnProvider --> libs/cloud/sync (engine lifecycle + events) + libs/cloud/presence
                         --> hooks/useNetInfo (back online -> engine.resume)

libs/cloud/sync --> slicers/store (store, persistor) + slices (plan/push actions) + libs/registry (flushPending)
libs/cloud/syncEngine, merge, revision --> no app imports (pure; tested by scripts/sync.test.mjs)
libs/cloud/firebaseBackend --> firebase/* (the only place; tested by scripts/sync-firestore.test.mjs)
libs/cloud/serverBackend --> fetch + libs/secureStore (token) (tested by scripts/sync-server.test.mjs, real server)
libs/cloud/router, scope --> settings only (which backend, which scope)
```

## Approximate Scale

| Metric                      | Count            |
| --------------------------- | ---------------- |
| Screens (routes)            | 32               |
| Components (.tsx)           | ~98              |
| Redux reducers              | 52 (29 + 9 + 14) |
| Custom hooks                | 8                |
| Utility files               | 12               |
| i18n locales                | 7                |
| Translation keys            | ~740 per locale  |
| TypeScript type definitions | 7 files          |
| Platform-split file pairs   | ~10              |
