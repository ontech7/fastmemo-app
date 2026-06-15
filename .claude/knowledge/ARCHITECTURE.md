# FastMemo Architecture

## Overview

FastMemo follows a hybrid feature-based / layer-based architecture. Screens are organized by domain (expo-router file-based
routing), components are domain-grouped, and state management uses centralized Redux slices per domain. The app targets three
platforms: Android (primary), Web, and Desktop (Tauri).

## Platform Target Matrix

| Platform | Framework                            | Build Tool   | Status          |
| -------- | ------------------------------------ | ------------ | --------------- |
| Android  | React Native 0.85 (New Architecture) | EAS Build    | Active (v3.2.0) |
| Web      | Expo Web (React DOM)                 | Expo/Webpack | Active          |
| Desktop  | Tauri 1.x (Rust + WebView)           | tauri-action | Active (v1.2.0) |
| iOS      | React Native                         | -            | Dismissed       |

## Source Directory Structure

> As of v3.2.0 / Expo SDK 56, `app/` and `assets/` live at the **project root** (moved out of `src/`). The tree below still reflects their internal layout.

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
    notes/             # Note editors: NoteTextEditor, NoteTodoEditor, NoteKanbanEditor, NoteCodeEditor
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
    # Standalone: CategoryIcon, LoadingSpinner, SafeAreaView, Sidebar, VirtualNumberKeyboard

  slicers/             # Redux state management
    store.ts           # Store configuration (double-persist, typed hooks)
    notesSlice.ts      # Notes state: CRUD, trash, filters, cloud sync queue (27 reducers)
    categoriesSlice.ts # Categories state: CRUD, reorder, cloud sync queue (9 reducers)
    settingsSlice.ts   # App settings: language, security, cloud, AI, dev mode (12 reducers)
    thunks/
      notes.ts         # Async cloud sync for notes (drain outbox queue)
      categories.ts    # Async cloud sync for categories (drain outbox queue)

  types/               # TypeScript type definitions
    index.ts           # Barrel re-export (type-only exports)
    note.ts            # NoteBase, TextNote, TodoNote, KanbanNote, CodeNote, Note (discriminated union)
    category.ts        # Category interface
    settings.ts        # SettingsState, CloudSettings, Webhooks, VoiceRecognitionSettings, etc.
    store.ts           # RootState (manually defined), NotesState, CategoriesState
    common.ts          # Timestamped, Ordered (structural contracts for sort utils)
    config.ts          # AppConfigs interface

  hooks/               # Custom React hooks
    useCloudSync.ts    # Cloud sync lifecycle management (connect, disconnect, sync, handshake)
    useRouter.ts       # Expo Router wrapper with push-debounce (1000ms guard)
    useSecret.ts       # Secret code / biometric authentication
    useNetInfo.ts      # Network connectivity state
    useTimeoutTask.ts  # Debounced async task runner with loading states
    useVaultUnlocked.ts # useSyncExternalStore over vaultSession (is the DEK loaded?)
    useVaultPrompt.ts  # useSyncExternalStore over vaultPrompt (does encryption need attention?)
    useVaultProgress.ts # useSyncExternalStore over vaultProgress (re-upload progress bar)

  libs/                # Third-party service wrappers
    ai/                # On-device LLM (llama.rn)
      types.ts         # AIModelId, AIModelStatus, EditorAction, EditorActionResult
      constants.ts     # Model configs, system prompts, GBNF grammar
      helpers.ts       # Category matching, HTML stripping (platform-agnostic)
      context.ts       # LLM context lifecycle, model download, text generation (native only)
      index.ts         # Barrel export (native)
      index.web.ts     # No-op stubs for web
    haptics/           # Platform-split: native (expo-haptics) / web (no-op stubs)
    i18n/              # i18next setup + 7 locale files
    storage/           # Platform-split: native (fs-storage) / web (localforage/IndexedDB)
    firebase.ts        # Firestore CRUD, device management, handshake, cloud sync, vault doc CRUD
    registry.ts        # In-memory Map for passing non-serializable data between screens (+ vault continuation / recovery-key transport)
    localization.ts    # Locale detection wrapper (expo-localization + web fallback)
    secureStore.ts     # Platform-split (.web.ts): expo-secure-store / localforage key-value
    vaultSession.ts    # In-memory DEK + pub/sub; persist/load/wipe via secureStore (namespaced by projectId)
    vaultManager.ts    # Vault orchestration: probe/initialize/migrate/unlock/recover/changePassphrase/recreate
    vaultPrompt.ts     # Ephemeral pub/sub signal: "encryption needs attention" (drives VaultPromptDialog)
    vaultProgress.ts   # Ephemeral pub/sub signal {done,total} for the re-upload determinate progress bar

  utils/               # Pure utility functions
    sort.ts            # Sort comparators for Timestamped/Ordered items
    string.ts          # String validation, formatting, size computation
    date.ts            # Date formatting with locale awareness
    crypt.ts           # Note encryption/decryption (CryptNote); reads DEK from vaultSession, CONTENT_MAGIC auth marker
    vault.ts           # Envelope-encryption primitives (createVault/unlock/recover/rewrap, canary, PBKDF2 via crypto-js)
    secureRandom.ts    # OS CSPRNG bytes (WebCrypto getRandomValues, expo-crypto fallback)
    ui.ts              # yieldToUI() — let the spinner paint a frame before a synchronous freeze
    toast.ts           # Platform-split toast notifications
    webhook.ts         # HTTP POST webhook dispatcher
    export.ts          # PDF/text export, file sharing
    platform.ts        # Tauri detection
    openUrl.ts         # Cross-platform URL opener

  providers/           # React context providers
    KanbanDragProvider.tsx  # Kanban drag-and-drop state (reanimated shared values)
    SyncOnProvider.tsx      # Headless cloud sync polling (returns null, side-effects only)

  constants/           # Static constants
    styles.ts          # COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, BORDER, SIZE, MONOSPACE_FONT
    icons.ts           # Available category icon names
    code-languages.ts  # Supported code editor languages
    note-types.ts      # Note type metadata

  configs/             # App configuration
    index.ts           # Main config (env vars, app metadata, business rules, cloud, sentry, firebase)
    default.ts         # Factory defaults (defaultCategory, defaultNote function)
```

## Data Flow

### State Management Architecture

```
                    Redux Store (configured in slicers/store.ts)
                    ============================================

        +------------------+  +-----------------------+  +------------------+
        |   notesSlice     |  |   categoriesSlice     |  |  settingsSlice   |
        |  (27 reducers)   |  |    (9 reducers)       |  |  (12 reducers)   |
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
        |  Reducers queue encrypted items into      |
        |  cloud.items.add / cloud.items.delete     |
        |  via only_if_cloudConnected()             |
        +------------------------------------------+
               |                       |
               v                       v
        +------------------------------------------+
        |        Async Thunks (thunks/)             |
        |  Drain outbox queues -> Firebase CRUD     |
        |  On fulfilled -> remove from outbox       |
        +------------------------------------------+
               |
               v
        +------------------------------------------+
        |          Firebase (libs/firebase.ts)       |
        |  Firestore collections: notes, categories  |
        |  + vault doc (encryption envelope)         |
        |  Device management, handshake, sync        |
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
queueCloudDelete / detach    -> content-stripped deletionStub (no DEK needed; propagates while locked)
uploadCloudData              -> instruments vaultProgress (begin/tick/clear) -> determinate bar on
                                the vault-recovery / vault-unlock / connect (resync) loaders
SyncOnProvider               -> every sync loop gated on useVaultUnlocked(); re-validates the cached
                                DEK against the cloud vault (dekMatchesVault) and re-locks on reset
```

`readVault()` (vault presence + DEK-staleness checks) uses a **server read** (`getDocFromServer`), never Firestore's local cache
— a cached old vault doc would mask a reset done on another device and survive restarts (see LL-027). Offline -> "error" ->
callers skip (no false lock/create). A note is never lost to slow encryption/upload: it is written to local state (plaintext,
persisted) before `queueCloudAdd`, the encrypt-into-outbox is synchronous, and the outbox retains unconfirmed items until the
Firestore write succeeds (retry — see thunks/notes.ts).

### Persistence Architecture

```
Redux Persist (double-layer -- see DECISIONS.md)
================================================

Root persistReducer (key: "root")
  |
  +-- notesSlice persistReducer (key: "root_notes")
  |     Storage: FSStorage (expo-fs-storage / IndexedDB on web)
  |     Migration: legacy AsyncStorage -> FSStorage
  |
  +-- categoriesSlice persistReducer (key: "root_categories")
  |     Storage: AsyncStorage
  |
  +-- settingsSlice persistReducer (key: "root_settings")
        Storage: AsyncStorage
```

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

slicers/*Slice.ts --> utils/crypt (encrypt/decrypt for cloud queue)
                 --> utils/sort (note ordering)
                 --> libs/firebase (cloud sync in thunks -- NOT in reducers)
                 --> libs/vaultSession (isVaultUnlocked gate before queuing encrypted items)

utils/crypt --> libs/vaultSession (reads the in-memory DEK; encrypt fails closed if locked)
libs/vaultManager --> utils/vault (envelope primitives) + libs/firebase (vault doc) + libs/vaultSession (cache)
providers/SyncOnProvider --> libs/vaultSession + hooks/useVaultUnlocked (gate every sync loop on unlock)

libs/ai/context.ts --> llama.rn (native LLM)
                   --> slicers/store (direct getState() for categories, cloud key)
                   --> libs/i18n (language-aware prompts)

providers/SyncOnProvider --> slicers/ (selectors + thunk dispatch)
                         --> libs/firebase (device sync)
                         --> hooks/useNetInfo (connectivity check)
```

## Approximate Scale

| Metric                      | Count            |
| --------------------------- | ---------------- |
| Screens (routes)            | 32               |
| Components (.tsx)           | ~98              |
| Redux reducers              | 48 (27 + 9 + 12) |
| Custom hooks                | 8                |
| Utility files               | 12               |
| i18n locales                | 7                |
| Translation keys            | ~670 per locale  |
| TypeScript type definitions | 7 files          |
| Platform-split file pairs   | ~10              |
