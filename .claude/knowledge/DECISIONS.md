# FastMemo Architecture Decisions

> **Read this when questioning a design choice.** Each entry explains WHY a specific pattern or library was chosen.

## ADR-001: Expo + React Native over Flutter or native

**Status:** Accepted  
**Context:** Need a cross-platform app targeting Android, Web, and Desktop.  
**Decision:** Expo SDK 53 + React Native 0.79 as the foundation.  
**Rationale:**

- Single TypeScript codebase for all platforms
- Expo simplifies native module management, OTA updates, and build pipelines
- React Native New Architecture (Fabric + TurboModules) available since 0.79
- Tauri handles desktop via the same web bundle (no Electron bloat)
- iOS dismissed for now; Android is the primary mobile target

**Trade-offs:**

- Platform-specific code still needed for ~10 file pairs (.web.tsx / .native.tsx)
- Some libraries require native-side patching (metro.config.js has WebView + Sentry patches)

**Updated (June 2026):** upgraded to Expo SDK 56 / React Native 0.85 (React 19.2). The decision stands; only the baseline
versions moved (release v3.2.0).

---

## ADR-002: Redux Toolkit over Zustand/Jotai

**Status:** Accepted  
**Context:** Need centralized state management with persistence, cloud sync queuing, and complex note lifecycle (create, edit,
trash, restore, delete, encrypt, sync).  
**Decision:** Redux Toolkit 2.8 + Redux Persist.  
**Rationale:**

- RTK provides `createSlice` (less boilerplate than raw Redux), `createAsyncThunk` (for cloud sync), and `createSelector`
  (memoized selectors)
- Redux Persist integrates cleanly for offline-first architecture
- The outbox pattern (queue encrypted items in state, drain via thunks) maps naturally to Redux's action/reducer/thunk model
- Large ecosystem and tooling (Redux DevTools, middleware)

**Trade-offs:**

- More setup complexity than Zustand
- The double-persist architecture (see ADR-003) adds overhead
- `serializableCheck` middleware is globally disabled due to redux-persist actions

---

## ADR-003: Double-Persist Architecture

**Status:** Accepted (with reservations)  
**Context:** Notes are large objects that need filesystem storage for performance. Settings and categories are small and work
fine with AsyncStorage.  
**Decision:** Each slice has its own `persistReducer` with a dedicated storage backend, then a root-level `persistReducer` wraps
the combined reducer.

```
Root persistReducer (key: "root")
  +-- notes persistReducer (key: "root_notes", storage: FSStorage)
  +-- categories persistReducer (key: "root_categories", storage: AsyncStorage)
  +-- settings persistReducer (key: "root_settings", storage: AsyncStorage)
```

**Rationale:**

- Notes can be large (rich text with embedded images) -- filesystem storage avoids AsyncStorage's size limits
- A migration path exists from legacy AsyncStorage to FSStorage (notes only)
- The root wrapper was added to ensure consistent rehydration behavior

**Trade-offs:**

- The outer persistReducer with empty blacklist adds redundant serialization/deserialization
- Rehydration ordering can be unpredictable with nested persistence
- **Known debt:** The double layer could be simplified to per-slice only

**Attempt history:** PR #114 tried to remove the outer layer on the assumption that per-slice keys held all the real data. This
broke note visibility on a real device (see LL-003 updated entry and LL-022). The outer layer actually participates in the
rehydrate path in a way that wasn't captured by the model. Any future attempt must start from an empirical audit of AsyncStorage
contents on an installed device.

**Update (2026-10-19):** After that audit (see LL-003), the notes are no longer double-persisted: their copy in `persist:root`
is folded into the notes storage once (`legacyRootNotes.ts`) and `notes` is then blacklisted from the root config. The root
layer is kept for categories and settings, where the duplication costs a few KB. Removing it entirely is no longer worth the
migration risk.

**Update (2026-10-20):** the notes' own storage is now one value per note (ADR-018); the legacy fold still runs first, on the
single value, and the note store migrates from it.

---

## ADR-004: On-Device AI (llama.rn) over Cloud AI APIs

**Status:** Accepted (models revised 2026-10: Qwen 2.5 -> Qwen3.5, see "Revision"; the desktop runs it through llama.cpp, see
ADR-034)  
**Context:** Need AI features (title generation, summarization, item suggestions) without requiring internet or external API
costs.  
**Decision:** llama.rn 0.12 with Qwen3.5 Small GGUF models (0.8B, 2B, 4B), Unsloth Q4_K_M files pinned to a Hugging Face commit
and checked by exact size.  
**Rationale:**

- Complete privacy: no data leaves the device
- No API costs or rate limits
- Works offline
- Three model tiers let users choose quality vs. device capability
- GBNF grammar constrains output format (e.g., JSON arrays for suggestions)

**Trade-offs:**

- Models are large downloads (hundreds of MB to several GB)
- Generation quality varies significantly with model size
- Not available in a plain browser (the web build); the desktop app has the AI through llama.cpp, see ADR-034
- Only one model loaded at a time (singleton context pattern)
- RAM-intensive: minimum 3GB for smallest model, 6GB for the 4B

**Revision (2026-10, Qwen3.5; the working spec `docs/AI_QWEN35_UPGRADE.md` was removed before 4.0.0, see git history):**

- **Qwen3.5 replaced Qwen 2.5** (0.5B/1.5B/3B/7B -> 0.8B/2B/4B). No 7B/9B tier: on a phone the 7B took 12 s to load and ran at 4
  tok/s, and the note tasks don't need it. The code actions (`explain_code`, `add_comments`) went with it: code notes store
  snippets.
- **Thinking off for every completion**: `jinja: true, enable_thinking: false, reasoning_format: "none"`; the 4B thinks by
  default and a reasoning block eats a title's whole budget. `stripThinking` removes a stray block anyway.
- **Sampling per action** (`ACTION_SAMPLING`): cold and without repeat penalty for anything that rewrites or labels (the right
  answer repeats the input), warmer with a presence penalty where the model writes something new.
- **Old ids are normalised on read** (`normalizeModelId` in a memoized selector) and fixed on write; the store keeps its shape.
  Files outside the catalog are leftovers: the settings offer to delete them, and a new download deletes them.
- **Load once, keep a while**: `prewarmContext` starts loading when the dictation sheet or the AI menu opens; the context is
  released 3 minutes after its last use and when the app goes to the background, never under a running completion.
- **Answers stream** into the dictation sheet and the before/after preview (throttled, think tags hidden); Apply waits for the
  end, Cancel stops the model and keeps the original.
- **Rewrites are guarded** (`isPlausibleRewrite`): an empty answer, a think tag, or a length outside the action's range
  (`REWRITE_LENGTH_RATIO`) is discarded and the text stays as it was.
- **Measured, not guessed**: Developer options -> AI evaluation runs fixed inputs on the loaded model and saves timings and
  outputs as JSON (`libs/ai/evalFixtures.ts`). On a Pixel 10 Pro llama.rn finds no GPU backend and runs on the CPU.
- **Long notes work line by line** (2026-10, phase 7, `libs/ai/blocks.ts` + `longNote.ts`). Grammar, shortening and translation
  used to send the whole note as plain text and write plain text back: headings, lists, bold and images were lost, and a long
  note overflowed the context. Now each line (paragraph, heading, list item, a `<br>` line) is one completion and goes back in
  its place; code, tables and images are never sent; a line the AI leaves unchanged keeps its formatting; a paragraph over
  `REWRITE_PIECE_TOKENS` goes a few sentences at a time. One call per line rather than grouped lines: nothing to map back, and
  llama.rn reuses the system prompt's cache, so the cost per line is about half a second on the 2B. Alternative rejected:
  numbered lines in one prompt (a small model merges or splits them).
- **The summary goes on top of the note** (developer decision), under a bold label marked `data-fm="summary"`; a newer one
  replaces it, and only the mark identifies it (a bold "Summary" the user wrote is text). A note longer than
  `SUMMARY_PART_TOKENS` is summarized in parts, then the parts are merged (map-reduce): worse than reading it all at once, so
  the parts are large.
- **Turned off rather than slow**: an action estimated over `LONG_NOTE_MAX_SECONDS` (5 minutes) on the note is disabled with a
  message. The estimate uses the speed the model ran at on this device in this session (`getModelSpeed`), the reference phone's
  until then. Steps done are cached in memory (a run after a cancel resumes at once); turning a result down clears it.

---

## ADR-005: CodeMirror 6 via WebView for Code Editing

**Status:** Accepted  
**Context:** Need a code editor with syntax highlighting for 16+ languages on both native and web.  
**Decision:** CodeMirror 6 running inside a WebView on native, directly on web.  
**Rationale:**

- No React Native library provides comparable syntax highlighting and editor features
- CodeMirror 6 is modular, performant, and supports 16 language packs
- WebView bridge approach allows the same editor on all platforms
- Pre-bundled via esbuild into a single HTML string (generated at build time)

**Trade-offs:**

- WebView adds a layer of indirection and communication overhead
- Two-way state sync between React Native and CodeMirror requires message passing
- The editor HTML is base64-encoded into a generated TypeScript file (`codemirror-html.ts`)

**Update (2026-10-19):** Language packs are dynamic `import()`s in `src/editor/codemirror-entry.js`; in the single esbuild IIFE
they become lazily initialized modules, so opening a code note no longer builds every grammar's parse tables. Language and
read-only mode are `Compartment`s reconfigured in place (switching no longer rebuilds the view), and `setCode` replaces the
`EditorState` so undo never crosses into another tab (`{ undoable: true }` for in-document edits such as AI comments). Measured
on the 419-note emulator dataset, time-to-ready of a code note did not change (~0.4-0.7 s): it is dominated by a fresh WebView
loading and parsing the ~1 MB inline bundle on every open, which only reusing a live editor document would avoid. The raw-code
cover keeps the content visible meanwhile (~50 ms after the tap).

---

## ADR-006: File-Based Routing (expo-router) with Single Flat Stack

**Status:** Accepted  
**Context:** Need routing that maps to URL paths (for web) and supports deep linking.  
**Decision:** expo-router 5.1 with a single root `Stack` navigator. All 32 screens are registered in `_layout.tsx` with no
nested layouts.  
**Rationale:**

- File-based routing reduces boilerplate and enforces consistent structure
- Typed routes (`experiments.typedRoutes: true`) provide compile-time safety
- A single flat stack is simple to reason about for a note-taking app (no tabs, no drawers)
- Custom animations per screen group (fade for boot flow, slide for drill-down, bottom-sheet for modals)

**Trade-offs:**

- The root layout enumerates all 32 screens -- becomes unwieldy as the app grows
- No nested navigation groups (could be added later with `_layout.tsx` in subdirectories)
- All screens manage their own headers (no shared header from React Navigation)

---

## ADR-007: Cloud Sync with Firebase Firestore + Encryption at Boundary

**Status:** Accepted (encryption-key model **superseded by ADR-012**)  
**Context:** Need optional cloud sync for notes/categories across devices, with end-to-end encryption.  
**Decision:** Firebase Firestore as the cloud backend, with AES encryption applied at the Redux boundary before data enters the
cloud outbox.  
**Rationale:**

- Firebase provides real-time sync, offline support, and free tier for small usage
- Encryption at the Redux boundary (in reducers via `CryptNote.encrypt()`) means Firebase never sees plaintext note content
- The outbox pattern (queue in state, drain via thunks) provides eventual consistency
- Device management (UUID-based) tracks connected devices

**Trade-offs:**

- Encryption in reducers is technically a side effect (violates pure reducer principle)
- No real-time sync -- polling-based (interval + app foreground triggers)
- Device limit enforced client-side

**Superseded part:** The original design stored a single global build-time `SECRET_KEY` (shared by every install, embedded in
the bundle) and uploaded note titles in plaintext. That key model is replaced by the per-vault envelope scheme in **ADR-012**.
The Firestore backend, outbox pattern, and boundary-encryption placement from this ADR are unchanged.

---

## ADR-008: Tauri over Electron for Desktop

**Status:** Accepted (on Tauri 2 since 2026-10, see ADR-015)  
**Context:** Need a desktop app for macOS, Windows, and Linux.  
**Decision:** Tauri (Rust backend) wrapping the web build.  
**Rationale:**

- Tauri produces significantly smaller binaries than Electron (~10-20 MB vs ~100+ MB)
- Uses the OS native WebView (no bundled Chromium)
- Rust backend for system-level operations (file access, auto-updater)
- Shares the web build output -- no separate desktop codebase

**Trade-offs:**

- Tauri is less mature than Electron's ecosystem
- Some web APIs differ in WebView context (native features go through `@tauri-apps/api` and the official plugins)
- Platform detection needed (`isTauri()` in `utils/platform.ts`)
- Desktop-specific features require Rust-side development

---

## ADR-009: Single i18n Namespace

**Status:** Accepted  
**Context:** 7 languages, ~670 keys each, growing.  
**Decision:** A single `"translation"` namespace for all i18next resources.  
**Rationale:**

- Simplicity: `t("section.key")` works everywhere without namespace prefixing
- All translations loaded upfront (small enough for a mobile app)
- Dot-separated hierarchy provides logical grouping without namespace overhead

**Trade-offs:**

- Cannot lazy-load translation sections
- Single file per locale grows linearly with features (~670 lines per locale and growing)
- No tree-shaking of unused translations

---

## ADR-010: In-Memory Registry for Non-Serializable Data

**Status:** Accepted (with reservations)  
**Context:** Some data (callbacks, promise resolvers) needs to be passed between screens but cannot go through Redux (not
serializable) or navigation params (not supported).  
**Decision:** `libs/registry.ts` provides a global `Map<string, unknown>` singleton.  
**Rationale:**

- Simple workaround for React Navigation's serialization constraint
- Used for: dirty note ID tracking (single-use), secret code callbacks (persistent)

**Trade-offs:**

- Global mutable state outside React's lifecycle
- No type safety (values are `unknown`)
- Must manually manage cleanup to prevent memory leaks
- **Known debt:** Could be replaced with React context or event emitter pattern

---

## ADR-011: SyncOnProvider as Headless Component

**Status:** Accepted  
**Context:** Cloud sync polling, debouncing, and AppState listeners need to run globally.  
**Decision:** `SyncOnProvider` is a component that returns `null` and exists solely for its `useEffect` side effects, mounted in
the provider tower.  
**Rationale:**

- Leverages React's component lifecycle for setup/teardown
- Can use hooks (useSelector, useAppDispatch, useNetInfo) naturally
- Placed inside PersistGate so it only activates after rehydration

**Trade-offs:**

- Unconventional pattern -- a "component" that renders nothing
- Could be a custom hook called from `_layout.tsx` instead
- Mixing concerns: polling, debouncing, platform listeners, and dispatch all in one component

---

## ADR-012: Per-Vault End-to-End Encryption (Envelope DEK/KEK)

**Status:** Accepted (supersedes the key model of ADR-007)  
**Context:** ADR-007 encrypted cloud notes with a single global `SECRET_KEY` baked into the bundle and shared by every install.
Anyone who extracted it from the app could decrypt any user's Firestore data. There is no Firebase Auth -- a Firebase project is
a single "vault" that up to a few devices join by manually entering credentials. We needed the encryption key to live **nowhere
except in the user's head**, without ever locking out a user who knows their password and without losing existing notes or
categories on upgrade.  
**Decision:** Per-vault **envelope encryption** keyed by a user-chosen **encryption password**, layered on top of the existing
Firestore + outbox plumbing from ADR-007.

- **DEK** (data encryption key): a random 256-bit key that encrypts notes. Created once, **never changes**.
- **KEK** (key encryption key): `PBKDF2-SHA256(password, salt, 100k iters)` -- only _wraps_ the DEK. Changing the password
  re-wraps the DEK (one tiny write); no note is re-encrypted and other devices keep working.
- **Recovery key**: an independently generated high-entropy code (Crockford Base32, shown once at setup) that wraps a second
  copy of the DEK, so a forgotten password is recoverable without a wipe.
- **Canary**: a known plaintext sealed under the DEK, so a candidate password/DEK can be verified deterministically -- a correct
  password is **never** wrongly rejected.
- The DEK is cached per-device in **secure storage** (expo-secure-store on native / localforage on web), namespaced by
  `projectId`, so each device unlocks **once**.
- A Firestore `vault` doc (`COLLECTIONS.various.vault`, id `config`) stores only `version`, `kdf` params, `salt`, `wrappedDEK`,
  `canary`, `recoverySalt`, `wrappedDEKRecovery`, timestamps. None of it leaks the password or DEK.

**Rationale:**

- **Note crypto must be synchronous.** Note encryption runs inside Redux reducers (see LL-017), and the queue path is
  synchronous. WebCrypto is async and absent on native RN; a native AES-GCM module would not run in the Tauri WebView. So we use
  **`crypto-js`** (pure-JS, identical on iOS/Android/web/Tauri) for AES, with secure randomness from `@/utils/secureRandom` (OS
  CSPRNG), never CryptoJS's `Math.random`-backed `WordArray.random`.
- **The KDF doesn't have to be.** PBKDF2 only runs at setup/unlock/password-change, so it is async and off the JS thread: the
  local Expo module `modules/fastmemo-crypto` (Kotlin `javax.crypto.Mac` / Swift CommonCrypto, WebCrypto on web/Tauri). Its
  output must stay byte-identical to `crypto-js` `PBKDF2(password, Hex.parse(salt), SHA256)`, which remains the reference and
  the fallback: `vault.ts` checks the module against crypto-js once per launch and uses crypto-js when the module is missing (a
  binary older than the module, under an OTA update), throws, or disagrees. `scripts/vault.test.mjs` checks WebCrypto/crypto-js
  interop; the Kotlin and Swift code were checked against the same vectors (RFC 7914, unicode, empty password) when written.
- **Authenticated by a marker, not by the cipher.** AES-CBC is unauthenticated, so a wrong key decrypts to valid-looking garbage
  ~90% of the time without throwing. `CryptNote.encrypt` prepends `CONTENT_MAGIC = "=FMV1=enc="` before AES; `tryDecryptNote`
  requires the marker, making wrong-key / foreign-DEK content reliably detectable so it is **skipped, never stored or
  re-encrypted as garbage** (see LL-024).
- **Non-destructive migration v1->v2.** Create the vault first (atomically), then sweep legacy notes: skip any note that can't
  be decrypted with the legacy key, and treat an empty legacy key as "skip" (never overwrite). See LL-023.

**Trade-offs:**

- PBKDF2 at 100k iters takes ~75ms off the JS thread with the native module (measured on the Android emulator, 2026-10-19). Only
  the pure-JS fallback blocks the JS thread (~1-2s; the UI yields a frame first so the spinner paints -- LL-025/LL-026).
  Iteration count is stored in the vault doc so it can be raised later without breaking old vaults.
- Note **titles** and metadata (id/type/dates/category) remain plaintext for sync keying/ordering; full title encryption is a
  deferred follow-up. Verified 2026-10-19 on a test project: titles, category names, todo `checked` flags and dates are readable
  in Firestore. Sync keys on ids and timestamps, never on titles, so encrypting them is possible; until then the UI copy ("only
  you can read your notes, not us and not Google") overstates what is protected.
- AES-CBC + an app-level marker is weaker than authenticated AES-GCM, chosen deliberately for cross-platform synchronous
  interop; the marker covers the data-loss concern, not tamper-proofing.
- Lose both password **and** recovery key => data is unrecoverable by design (true E2E).
- A new layer of screens/state (vault setup/unlock/recover/change/reset) and a pub/sub session (`vaultSession`) that all sync is
  gated on.

---

---

## ADR-013: Batched Editor Commits with Explicit Flush Points

**Status:** Accepted (2026-10-19)  
**Context:** Every committed edit makes redux-persist serialize and rewrite the whole notes slice (and re-encrypt the note for
the cloud outbox). Committing per keystroke made typing lag with many notes (LL-031).  
**Decision:** `useNoteEditor` keeps edits in local state and commits them to Redux in batches: after a pause (500ms native /
300ms web) and at least every 2s / 1s during continuous typing. Batches are also committed right away on blur, unmount, back,
before actions on the stored note (`flushNote`), and when the app leaves the foreground, the page is hidden or a desktop window
closes (`flushOnExit`, which also flushes the persistor).

**Rationale:**

- Persistence and encryption cost becomes proportional to pauses in typing, not to keystrokes
- One choke point (`registerPendingFlush` / `flushPending`) instead of per-editor lifecycle code
- Shorter windows on web/Tauri, where serializing is cheaper and a window can close without page events

**Trade-offs:**

- The store lags the editor by up to the debounce: code that reads the stored note must flush first (CONVENTIONS ALWAYS #15)
- On Android, JS timers stop in background, so background edits are written synchronously (LL-032)
- ~~Tauri v1's native Quit (Cmd+Q, Dock) terminates without `onCloseRequested`~~: since Tauri 2 (ADR-015) the window close and
  the app menu's Quit (Cmd+Q) wait for the flush; Dock Quit, logout and OS session end still don't

---

## ADR-014: OTA Updates (EAS Update) for Android, Counted on Top of the Store Version

**Status:** Accepted (2026-10-19). The v3.2.0 store build predates it: OTAs start with the first production build that embeds
the `production` channel and the fingerprint runtime.  
**Context:** A JS-only bug fix had to wait for a full Play Store review. EAS Update can ship JS/asset changes to installed apps,
but an update only reaches builds with the same runtime version, and the app `version` is the binary's: an update can't change
it.  
**Decision:**

- `runtimeVersion: { policy: "fingerprint" }`: the runtime is a hash of the native inputs (app config, autolinked native
  dependencies, `modules/`), so it changes exactly when a store build is needed.
- OTAs are published only by the manual **Publish OTA** GitHub workflow (`.github/workflows/publish-ota.yml`, from `main`). It
  runs tsc/lint/i18n/vault tests, then `scripts/ota-guard.sh` (also `yarn ota:check` locally): the current Android fingerprint
  must match a finished build on the `production` channel **of the same app version**, or the code has native changes (or a new
  version) and the run fails instead of publishing an update no installed app can receive. The version is checked on its own:
  the default fingerprint preset leaves `version`/`versionCode` out of the hash, so after a bump with no native change an OTA
  would otherwise reach the previous version's builds, labelled with the new version.
- Each OTA is tagged `vX.Y.Z+ota.N` (N-th OTA on top of store version X.Y.Z, restarting at 1 on a store release) with a GitHub
  Release created `--latest=false`, and N is inlined as `EXPO_PUBLIC_OTA_REVISION`: the app shows "X.Y.Z · OTA N" in Information
  and sends it with bug reports (`getDisplayAppVersion`).

**Rationale:**

- Manual dispatch keeps a human decision in front of every update that hits all users (same model as the Quido apps).
- The revision lives in the JS bundle, not in `app.config.ts` `extra`: the app config is a fingerprint input, so a per-OTA value
  there would give every update its own runtime and orphan it. `eas update` passes the shell environment to the export (EAS
  environment variables win on conflict; `.env` files are ignored with `--environment`).
- `--latest=false` keeps `releases/latest` on the store/desktop release: the website version API and the Tauri updater read it.
- eas-cli is pinned (workflow + guard): the guard depends on its flags and `--json` output. `EXPO_TOKEN` reaches only the guard
  and publish steps, not the dependency install or the checks.

**Trade-offs:**

- Updates apply on the launch after the one that downloads them (default `fallbackToCacheTimeout: 0`): fast startup, one launch
  of delay.
- Android only: the iOS app isn't distributed through this flow.
- `app.config.ts` is dynamic, so `eas update:configure` can't write it: `updates.url`, `runtimeVersion` and the `eas.json`
  channels (named after the profiles) were added by hand from its output, with `fingerprint` instead of its default `appVersion`
  policy (which would let an update reach a build with different native code).
- Local and EAS fingerprints are assumed equal (the gitignored `android/` is already excluded as `bareNativeDir`); the guard
  surfaces any divergence as a failed run, never as an orphaned update.

---

## ADR-015: Tauri 2, Migrated in Place (Same Identifier, Data and Update Channel)

**Status:** Accepted (2026-10-19)  
**Context:** Tauri 1 is in maintenance. Its built-in updater dialog (`dialog: true`) could hang the app, a native Quit (Cmd+Q)
skipped the exit flush (ADR-013), and the white-flash/titlebar fixes needed per-platform native code pinned to Tauri 1's
crates.  
**Decision:** Migrate to Tauri 2 without changing anything an installed app depends on:

- **Same data:** identifier `com.ontech7.fastmemo` and WebView data folders are unchanged, and
  `app.windows[].useHttpsScheme: true` keeps the Windows origin `https://tauri.localhost` (Tauri 2's default `http://` is a
  different origin: empty IndexedDB).
- **Same update channel:** `bundle.createUpdaterArtifacts: "v1Compatible"` produces Tauri 1's archive names (`.app.tar.gz`,
  `.msi.zip`, `.nsis.zip`, `.AppImage.tar.gz`) signed with the same key, so 1.x installs update to the first 2.x release through
  the same `latest.json`; `mainBinaryName` keeps the binary name (`Fast Memo`, and `fast-memo` on Linux via
  `tauri.linux.conf.json`, as 1.x kebab-cased it there).
- **Least privilege:** one capability (`src-tauri/capabilities/default.json`) grants only what the frontend calls: event
  listen/unlisten, resource close and bundle type (no `core:default`), dialog open/save, fs read/write text and write binary (no
  static scope: the dialog plugin scopes the picked path), opener for http(s)/mailto/tel, updater, process restart. Clipboard,
  notification and the v1 fs scope were unused and are gone.
- **Exit flush in Rust:** a quit from the window (`WindowEvent::CloseRequested`: close button, Cmd+W) or from the app menu is
  held, the frontend is asked to flush (`fastmemo://flush-before-exit`) and the app exits on its `exit_after_flush` or after 2s.
  On macOS the app menu is Tauri's default with its own Quit item (Cmd+Q): the predefined one sends `terminate:`, which tao
  turns straight into an exit with no event to hold. No JS close listener, so no window permission is needed (LL-038). _Revised
  2026-10-21 (desktop 2.0.0):_ the macOS menu is the app's own (File, Edit, View, Window, Help, localized through
  `set_menu_labels`), still with the plain Quit item; Windows and Linux keep no menu bar (CONVENTIONS, Desktop Keyboard
  Shortcuts and Menu). _Revised again 2026-10-21:_ on macOS the close button / Cmd+W only hide the window (flushed, no exit;
  ADR-022).
- **Updater UI in the app:** `AppUpdateProvider` checks once per launch (retried on reconnect) and from Settings, asks with the
  app's own dialog, then downloads, flushes, installs, flushes and relaunches (neither the install nor the restart goes through
  the exit flush). No native dialog. deb/rpm installs are never offered an update (the updater only has the AppImage for them):
  they update through their package manager.
- **Single instance** (`tauri-plugin-single-instance`): a second launch focuses the running window instead of opening a second
  writer on the same stored notes. Its lock is keyed by identifier: a `tauri dev` without the test config (same identifier as
  the installed app) exits at once while the installed app runs, and uses its data. Develop with
  `-c src-tauri/tauri.test.conf.json`.
- **No native code:** `backgroundColor` (window and webview layer on every platform: wry turns off WKWebView's `drawsBackground`
  for it) + macOS `titleBarStyle: "Transparent"` replace all the cocoa/webview2/webkit2gtk code.

**Trade-offs:**

- The first 2.x update is installed by the 1.x updater (its native dialog, once more); from then on the in-app flow is used.
- `useHttpsScheme` must never be removed on Windows without a data migration.
- Test builds (`tauri.test.conf.json`) have no updater endpoints: they never update (and can't be offered the real app).
- Quits that bypass the event loop still skip the flush and can lose the edit batch still open (≤1s of typing on desktop): macOS
  Dock → Quit and logout (`terminate:` → `applicationWillTerminate`), a Windows session ending (`WM_ENDSESSION`), Linux SIGTERM.
  Holding those needs `applicationShouldTerminate:` / `WM_QUERYENDSESSION` hooks tao doesn't expose.

---

## ADR-016: Sync Engine Behind a `CloudBackend`, Live Listeners, Revisions and Conflict Copies

**Status:** Accepted (2026-10-19), implemented on `feat/sync-backend`  
**Context:** Sync polled Firestore every 10s (device list + vault + pending query: ~23k reads/day for two devices open all day,
half the free quota), and review of the code found correctness gaps: a receiver cleared a sender's fan-out queue with an
unguarded read-modify-write (a change pushed in between was dropped), an incoming copy overwrote a local unpushed edit (the
devices then diverged for good), the connect/unlock full sync uploaded every note and then _replaced_ local notes with the cloud
set (a note whose upload failed, e.g. >1 MiB, vanished; an offline device's stale notes overwrote newer cloud ones), stale queue
entries replayed while a third device was offline could resurrect trashed notes, and a sender's queue doc could outgrow
Firestore's 1 MiB limit while a device stayed offline, wedging its uploads. Phase 4 (self-hosted server) also needs the cloud
behind an interface.  
**Decision:**

- **`CloudBackend` interface** (`src/libs/cloud/`): domain operations (devices, vault, notes/categories snapshots, push with
  fan-out, incoming-change subscription, ack, presence). `FirebaseBackend` is the only code importing `firebase/*`; the
  self-hosted server (phase 4) implements the same interface. Same Firestore data model and wire format, so 3.2.0 / 1.2.0
  installs keep syncing with updated ones; additions are fields and a `tombstones` collection older versions ignore.
- **Live instead of polling:** one listener on `connectedDevices` (pending changes for this device, recipients for pushes,
  removal of this device, presence) and one on the vault doc (reset detection). Only server-confirmed snapshots
  (`!metadata.fromCache`, no pending local writes) drive decisions (LL-027). A read "from the server" of data a listener is open
  on is answered from that listener, so it can't detect one that died without an error: every 5 min (and on resume) the
  transport is re-opened instead, then the devices are read again; the listeners resume where they were (only changes are read).
  A task stuck over 60 s gets the transport re-opened too. A listener that errors, or whose Firestore app was re-initialised
  under it, is subscribed again with backoff.
- **Revisions:** every synced local change stamps `rev` on the note: now, but at least the previous revision + 1, so an edit
  made on a device whose clock is behind still supersedes the version it was based on. A note's revision is
  `max(rev, updatedAt)`, so edits from older app versions (which only bump `updatedAt`) still count. `syncedRev` (local
  bookkeeping, never uploaded) is the revision last known to be in the cloud; `rev > syncedRev` means unpushed local changes.
  Trash stamps `deletedAt` (deletion stubs carry it), and permanently deleted ids keep a pruned tombstone (`purged`). A note an
  older app version last wrote has no `rev`: its own version is its base, recorded as `syncedRev` by the first change made here
  (`baseOf`), and uploads an older version left queued are stamped on top of the version they change (`adoptLegacyOutbox`, which
  also drops a deletion it left queued for the same, live, note).
- **Merge on receive (pure functions, `merge.ts`):** an incoming version older than what the device has is ignored (stale
  replay); a newer one replaces it when there are no local unpushed changes; when both sides changed since the last synced
  revision, **both are kept**: the newer version keeps the note, the other becomes "<title> (conflict)" with a deterministic id
  (`<id>~<rev>`), so replays produce the same copy, never a second one. A delete applies only if newer than the local note; an
  edit newer than a local trash or a permanent deletion restores it (and drops the deletion still queued). The same revision
  with other content is a change too: older app versions change flags, the category, or restore from the trash without a new
  revision. The incoming version is the cloud's, so it keeps the note (an unsynced local change becomes the copy).
- **Transactional ack:** the receiver applies a sender's queues, persists, then removes itself from `devicesToSync` in a
  transaction that only commits if the queues are still the ones it applied (content token); otherwise it re-applies. Acks wait
  for the sender to go quiet (5 s, at most 30 s): an ack only lets the sender clear its queues, and costs reads on every device.
  Every push makes the current other devices its recipients (`devicesToSync`), which drops the id of a device removed meanwhile
  (with `arrayUnion` it stayed, and that sender's queues never cleared). Removing a device unregisters it first.
- **Guarded, batched, bounded pushes:** the outbox goes out in transactions of up to 200 entries (note/category writes + one
  merged fan-out update + `lastSync`, all or nothing). Each upload carries its base (`syncedRev`, the version it was edited
  from): the transaction reads the cloud doc and refuses to overwrite a newer version than the base, or to delete a version
  newer than the deletion. The refused cloud version comes back to be merged like an incoming one (conflict copy if both
  changed), then the push goes again. The same revision is refused too (it may be other content, see the merge), so a retried
  push whose first reply was lost is settled by the merge as "already there". This closes the window where two online devices
  push near-simultaneous edits. A push that applies nothing writes nothing (a write to the device doc wakes every device's
  listener). Pushes go out at most every 2 s: that's also how fast typing shows on the other devices. The stored note is
  encrypted at push time (latest content, current key); the outbox copy only marks it as waiting and keeps the outbox readable
  by an older app after an OTA rollback.
- **Fan-out size:** a sender's doc holds its queues until every recipient pulled them, under Firestore's limits of 1 MiB and
  40,000 index entries per document (every field of a queued note is indexed: ~50 entries per note, ~12 per reference or stub,
  so the entry limit comes first). Budgets in both (`planFanout`): full notes up to 600 KB / 20k entries, references
  (`{ id, rev, ref: true }`, whose `text` decrypts with no key, so older apps skip them instead of storing them as notes) up to
  900 KB / 30k, stubs up to 1 MB / 36k. Past that the queues start over with the current push, and the devices that hadn't
  pulled them get `fullSyncDue` on their own doc: each runs one full sync and clears it. Deletions and detaches also write
  `tombstones/{id}` (`{ rev, detach? }`), so a full sync tells a deleted note from one the cloud lost. A transaction failing
  with a non-retryable error is split to isolate the culprit; one refused alone is retried without queueing (the device doc may
  be the cause), then stays queued but skipped until the next launch. Retries back off exponentially (2 s → 5 min), and
  snapshots don't skip the backoff; nothing leaves the outbox until committed.
- **Full sync = reconcile, never replace:** apply pending incoming changes, read the cloud and its tombstones, merge per note
  with the same rules, push only what this device has newer, and keep every local note: one missing from the cloud is uploaded
  again, unless a tombstone says it was deleted (or made device-only) after this version. Tombstones expire with the local ones
  (180 days); an older app version's deletion leaves none, so its note can come back from a device that missed it (as before). A
  full sync that doesn't complete (offline, app closed) stays due and runs again when the engine next starts: it's what brings a
  newly connected device the notes no queue carries.
- **Presence and live notes:** a device writes `presence: { noteId, at }` on its own doc when a note opens/closes (+ a 5 min
  heartbeat); others show "open on <device>" on the card and in the editor (stale after 10 min). A presence its device left
  behind (page reloaded, app killed) is cleared by that device's next session as soon as it sees it. After applying incoming
  changes the engine signals the open editor, which reloads the note in place (it was flushed first, so a local edit is already
  in the merge: at worst it becomes the conflict copy). The caret keeps its place in the text (the code editor applies only the
  span that changed, outside its undo history), and a change to the open note alone shows no "synced" toast: it would repeat
  every few seconds while another device types.

**Trade-offs:**

- Revisions use each device's clock: a badly skewed clock can make an older edit win (the other survives as a conflict copy only
  when both changed since the last sync).
- A conflict copy is also created when one side only changed metadata (important, hidden, category) concurrently with a content
  edit on the other: there is no per-field base to merge against.
- Old app versions keep their own behavior (unguarded acks and uploads, no conflict copies, reference entries and overflowed
  queues skipped until their next full sync) until updated. While devices run different versions: a restore from the trash made
  on an older version of a note an updated device trashed is older than that deletion, so it's undone; and a change an older
  version makes without a new revision to a note an updated device also changed becomes a conflict copy.
- Two devices typing in the same open note at the same moment make one conflict copy per collision (each side's unpushed batch
  vs the other's): fine for the occasional overlap, not a co-editing experience.
- A collection read "from the server" while a listener on it is open is answered from the listener's view, which gets this
  client's own transaction writes a moment later: right after an ack, a poll may see the change again. Merging is idempotent and
  the ack then finds nothing to do.
- A device registered while a push is in flight misses that push's change until its first full sync (which connecting runs).
- Live co-editing of the same note (character-level merge) is out of scope: it needs a CRDT per editor and per-keystroke writes
  the free quota can't sustain.
- Firestore cost: a push is 1 read (+1 per guarded note) and 1 write (+1 per note, +1 per tombstone), plus 1 read on every
  device listening; an ack is 1 read and 1 write, plus 1 read per listening device. Idle: nothing but the presence heartbeat.
  Typing continuously in a note open on 3 devices: ≤1 push / 2 s and an ack every ≤30 s, ~9k reads + ~3.7k writes per hour (the
  free quota is 50k reads and 20k writes a day). Two devices, 100 edits each a day: ~1.5k reads + ~700 writes (3.2.0 polled:
  ~23k reads + ~600 writes, plus a full upload of every note on each connect/unlock). A full sync reads every note, category and
  tombstone.

## ADR-017: A Self-Hosted FastMemo Server as a Second `CloudBackend`

**Status:** Accepted (2026-10-20), implemented on `feat/self-hosted-server` (app) and in the `fastmemo-server` repo  
**Context:** Firebase asks for a Google account and a project, and its free quota shapes the whole sync design (ADR-016). Users
who want their notes at home (PC, NAS, Raspberry Pi, VPS) had no option. ADR-016 put the cloud behind `CloudBackend` for this.  
**Decision:**

- **A separate repo, `fastmemo-server`:** Node >= 22.18 running the TypeScript sources directly (type stripping, no build),
  `node:http` without a framework, SQLite through `node:sqlite` by default (no native module to compile on a Pi), PostgreSQL
  through `pg` optionally. One Docker image (node:24-alpine, unprivileged, `/data` volume) and compose files for home, Postgres,
  Caddy (HTTPS) and Coolify, with a README for non-developers. The API is `/v1` (`docs/PROTOCOL.md` there, `PROTOCOL = 1`): the
  app refuses a server that isn't `server: "fastmemo-server"` with protocol 1.
- **A change feed, not fan-out queues:** one row per note/category with its latest state; every write takes the next sequence
  number; each device has a cursor. A device reads what others wrote after its cursor in pages (<= 500 items, ~2 MB), applies
  them and acks the page's last seq. Nothing accumulates per sender: no queue budget, no overflow (`fullSyncDue` stays for
  restores and the dashboard). The engine gets each page as one sender's `ChangeSet` (`ServerBackend.deliver`), whose token is
  `<page id>|<last seq>` (the page id names the content; the ack sends the seq). Every note is read in pages too
  (`GET /v1/notes?after=`, <= 500 notes / 8 MB), and the client halves its push and page sizes after a timeout (a slow link).
  Deletion markers are pruned only once every device has read past them and they're 200 days old (here the marker _is_ the feed
  entry).
- **The same merge guard as Firebase:** an upload is applied only over an older live version than its base (never the same
  revision), a delete only over versions up to its revision, detaches unguarded; refused versions come back to be merged
  (conflict copies). `scripts/sync-server.test.mjs` runs the adapter and the real engine against a real server (contract,
  offline, conflicts, multi-page catch-up, restart, removal, stale vault, the server's pacing).
- **Devices enroll with the access key, then use their own token:** the server keeps only its SHA-256, so removing a device
  revokes it at once (Firebase can't). The token lives in secure storage under `serverToken_<scope>`, written before it's used.
  Only the server refusing the token the device holds now means "removed": a token storage can't read now is read again, and a
  refusal of a token a registration replaced is retried (LL-050). What the app reads while connecting (vault, notes, devices)
  takes the key or a token ("member" routes). Wrong keys are rate-limited per address (20 / 15 min).
- **Editing the settings of a connected device:** the new settings are checked first on a connection of their own
  (`CloudBackend.check`), so a typo leaves the device connected as it was. The same cloud (same `cloudScope`) then only takes
  the new credentials (a rotated access key, a new API key): no re-registration, no vault flow. Another cloud is left first, as
  turning sync off does (unregister, forget its cached key, dispose), then connected as usual. The engine is stopped and idle
  before the connection changes, and a task that outlived `stop()` doesn't act on what it reads.
- **Long polling, not WebSockets:** `GET /v1/sync?v=&wait=25` answers when anything devices see changes (or after 25 s) with the
  devices, the next feed page and the vault: plain HTTP through any proxy, no dependency on either side. A page the device
  already has comes back as `{ same: true }`; page ids include the server's boot id, so a restored backup (which rewinds the seq
  counter) can't make an old id match new content.
- **`CloudRouter`:** `cloud` sends every call to the backend `providerOf(settings)` names (`provider` is new in `CloudSettings`;
  missing = `firebase`, so existing installs are unchanged). `cloudScope(settings)` (the Firebase project id, or
  `server:<normalized url>`) keys what belongs to one cloud: the cached DEK, the server token. Backends declare `deviceLimit`
  (Firebase: 3, from config; the server: its `MAX_DEVICES`, from `/v1/info` and `/v1/devices`) and may set the engine's `pacing`
  (the server: pushes >= 500 ms apart, ack after 1 s quiet, at most 5 s: no quota to save).
- **An ops dashboard on the server:** devices (last sync, last request, open note, how far behind), reads/writes/deletes per day
  over 30 days counted as Firestore bills them, warnings and errors, full sync per device or for all, removal, one-click SQLite
  backup. Served by the server under a strict CSP, opened with an admin key.

**Trade-offs:**

- **Plain HTTP is allowed where the platform can do it, never silently** (user decision, 2026-10-20): a home server is often
  `http://<LAN address>`.
  - Android release builds: `usesCleartextTraffic` plus a network security config permitting cleartext (system CAs only), both
    from the `withCleartextTraffic` plugin in `app.config.ts`; newer Android versions only read the config. The flag is
    app-wide: `http://` webhooks work on Android release too.
  - macOS desktop (a `tauri://` page, so no mixed-content block): App Transport Security lets the webview reach IP addresses,
    `localhost` and `.local` names over http, but not a dotted name (`nas.home.arpa`, a DDNS name; measured on a built app,
    2026-10-20). `src-tauri/Info.plist` set `NSAllowsArbitraryLoadsInWebContent` (webview loads only), until the revision below.
    Linux is a `tauri://` page without ATS: expected to work the same, not tested.
  - The hosted web app is an `https://` page: the browser engine blocks an `http://` fetch from it (mixed content) unless the
    server is this machine (`isLoopbackUrl`); the connect screen says so and disables saving. WebView2's
    `--allow-running-insecure-content` was rejected for the Windows app, it lets every insecure subresource in, not only the
    sync calls.
  - _Revised 2026-10-21 (desktop 2.0.0):_ the desktop app calls the server and the webhooks from Rust (`src-tauri/src/net.rs`,
    `@/libs/net`), on every OS: no mixed-content block on Windows, no ATS on macOS, no CORS. The macOS
    `NSAllowsArbitraryLoadsInWebContent` exception is gone with it. Own commands rather than `tauri-plugin-http` (tried, then
    dropped after review): the plugin builds a new client per request (no connection reuse, the OS trust store read again each
    time, ~80 ms of CPU on a Mac), follows redirects (a redirect to another host drops the `Authorization` header and the
    server's refusal read as "device removed": a Caddy http->https redirect disconnected the device), sends bodies as JSON
    number arrays and needed a capability open to any URL. `net.rs`:
    - reqwest 0.13, already compiled for the updater (no second HTTP stack), but clients of its own: a pair for the server and a
      pair for webhooks, built on first use and kept (connections reused), again after a connection failed (the system proxy is
      read only when a client is built), never kept when the build failed; ring as the crypto provider, gzip, a
      `FastMemo-desktop/<version>` user agent (some proxies and CDNs refuse a request without one);
    - certificates checked by `rustls-platform-verifier`: the OS's verifier on macOS and Windows (as the webview), the system's
      CA certificates on Linux;
    - the server's requests follow no redirect: the adapter reads a 3xx, as any redirect on every platform, as a transport
      error, retried, never a refusal (LL-059). Webhooks follow up to 5, as the browser's fetch did (no token travels with
      them);
    - the system proxy for internet hosts only; this machine, private and link-local addresses, Tailscale and local names
      (`.local`, `.lan`, `.home.arpa`, `.internal`, `.localhost`, single labels) go direct, on every OS (on macOS reqwest
      doesn't read the proxy's bypass list);
    - the page reaches only `/v1/` paths and webhook POSTs, whose answer it never sees. A guard against mistakes, not a security
      boundary: code running in the page can still reach any host with such a path. An address with credentials (`user:pass@`)
      is refused, as by fetch;
    - raw IPC bodies both ways (the answer is the status in 2 bytes, then the body; a number array when the IPC falls back to
      `postMessage`). Request ids are unique per page load (Rust outlives a reload); `net_cancel` aborts a request, even one
      cancelled before it reached Rust, and the page rejects at once. Errors carry their causes, never the address. Verified on
      macOS (tauri dev) through a logging proxy; Windows still to be tried on a real PC.
    - Without the ATS exception, a note's image at `http://` under a dotted name (`http://nas.home.arpa/a.png`) no longer loads
      on macOS: the webview's own loads are back under ATS. https, an IP address, `localhost` and `.local` names load.
  - The connect screen warns under an http address and asks to confirm before saving, recommending HTTPS (a reverse proxy with a
    certificate, or Tailscale). Not for this machine nor a Tailscale address (`isTailscaleUrl`: 100.64.0.0/10, `*.ts.net`),
    which cross no network unencrypted. The warning says what a device on HTTP gives away wherever it is (it roams: confirmed at
    home, it goes on talking on any Wi-Fi): the titles and its credentials, enough to delete or change notes and remove devices,
    not to read them.
  - The access key travels only to connect (handshake, enrolment, member calls before enrolment); an enrolled device sends its
    own token, which can be revoked. A member call whose token the server refuses is tried again with the key (a device removed
    by a leave whose answer got lost must still be able to reconnect).
- **The access key is a shared secret** with the reach of Firebase credentials: whoever has it can enroll a device (up to the
  limit), read the encrypted notes, remove devices or wipe the cloud (vault reset). Notes stay unreadable without the encryption
  password; titles are plaintext, as on Firebase. A lost device is locked out by removing it (its token dies); rotating the key
  only stops new enrolments, the devices already in keep their tokens. After an HTTP exposure, rotate the key and remove and
  re-add each device (a sniffed token outlives the rotation). By default the access key is also the admin key. A SQLite backup
  holds the generated key.
- **A restored backup needs a full sync on every device** (a dashboard button): devices push only their outbox, so what changed
  after the backup comes back only when each compares everything.
- **One process:** a single writer (SQLite behind a mutex, or a Postgres advisory lock), long polls held in memory. Plenty for a
  person or a family; not a multi-tenant service.
- Revisions still come from device clocks (ADR-016).

**Verified** (2026-10-20, the Docker image, two browser devices through the app's screens): an edit reached the other device in
0.6 s, into its open editor too; an offline edit and a concurrent online one ended as the same conflict copy on both; a delete
showed "moved to the trash" in the other's open editor at once; presence; removal from the dashboard disconnected the device and
kept its notes; a change made while the server was down went through 12 s after it came back.

---

## ADR-018: The Notes Stored One Value per Note (Note Store)

**Status:** Accepted (2026-10-20), implemented on `feat/per-note-storage`; ships after the release of phases 1-4, as an OTA  
**Context:** redux-persist stored the whole notes slice as one value (`persist:root_notes`: a file on native, one IndexedDB
value on web). Every save rewrote all of it: with 400 notes 2.5 MB and 100-300 ms per commit, however small the edit (LL-031),
and the bigger the write, the wider the window in which a killed app loses its last edit.  
**Decision:**

- **`src/libs/storage/noteStore.ts`** is the notes' redux-persist storage (`serialize: false`, `deserialize: false`): it gets
  the slice as it is and writes only the notes whose object changed (Redux keeps unchanged notes as the same objects). Entries:
  `n:<id>` live notes, `t:<id>` trashed ones, `o:<id>` notes in the outbox; everything else (settings of the slice, deletions
  waiting, tombstones, the list of entries in order) is one small `state` value. The app's instance lives in
  `src/libs/storage/notes.ts` (store.ts persists with it, the wipe thunk reaches it there).
- **A write** stores the outbox entries, then the notes, then the `state` value, then removes the entries it no longer lists, 8
  values at a time (reads go 32 at a time). A crash leaves a `state` value whose entries all exist. Leftovers nothing lists are
  removed on the next launch, except the outbox entry of a listed note with a change the cloud lacks (`syncedRev` below its
  revision): the crash came before the `state` value listed it, so it's taken back into the outbox. A value found only in its
  spare (a crash before the rename) is read from it and written into place by the next write. A write that a newer one
  superseded while it waited is skipped and settles with that newer write: `persistor.flush()` never resolves before the slice
  is stored, and a failure reaches `notesPersisted()` (the sync engine's ack rule).
- **Backends** (`noteStoreBackend.ts` / `.web.ts`): on a device, one file per value in `files/fastmemo-notes/`, with
  expo-file-system's legacy API (asynchronous: the calls run off the JS thread), written to `.tmp` and renamed over the file (an
  atomic replace on Android). The folder is listed once per launch and kept up to date (the only writer), so a read needs no
  existence check. Names are escaped to `[A-Za-z0-9-_.!~*'()]` (LL-052); a name that can't be a file name (a lone surrogate,
  over 160 characters) is stored as `@<hash>.json` with the name on its first line. On the web and the desktop, IndexedDB values
  `v2:<name>` in the same localforage store; browser tabs share it, so reads and writes run under a Web Lock. A write that finds
  a `state` value it didn't write (or after its own write failed) rewrites every entry that value doesn't list (the last tab to
  save wins, whole, as with the single value); with nothing of its own to store, it doesn't write at all. The desktop is
  single-instance.
- **Reading** is tri-state as everywhere else: an unreadable entry comes from its spare, then from the legacy value, and only
  then is it given up; losses are reported to Sentry once per launch, with a count. A read that fails (I/O) fails the whole read
  and nothing is written that session (LL-039); a `state` value in an unknown format (a newer version's) is not read nor written
  over, whatever its shape.
- **Migration** is the first write: with no `state` value, no entries and no marker, the notes come from the legacy value (after
  the legacy root fold, ADR-003). The first write stores the entries, then the `state` value, then the `migrated` marker: the
  legacy notes the store has taken into account, with their revisions. A marker means the migration finished: "no `state` value"
  never passes for "not migrated" (a lost `state` value after everything was deleted rebuilds an empty store), and a rebuild
  takes the legacy deletion queues only without one. A lost, cut or spare-only marker is made again from the legacy value while
  it's kept (unchanged, it holds what the migration took).
- **The legacy value is kept for a rollback**: an older version (or an older browser tab still open across a deploy) reads and
  writes it. The store records its stamp (on a device its size and modification time; on the web its length and a hash, read in
  full while it's kept); when it changes, its notes are folded in on the next launch: newer versions of notes in the same list
  replace them, and a missing note comes back only if the marker doesn't hold it at that revision (deleted here since: it stays
  deleted, device-only notes included) and no tombstone is newer; the marker then takes the legacy notes in. A lost `state`
  value is rebuilt from the entries the same way, after taking the legacy settings and tombstones. 14 days after the migration
  (on a clean launch, once that launch's write has stored what it folded) the legacy value and the other copies are removed;
  "Wipe data" removes them at once.
- **Wipe data** (`wipeNotesThunk`) and the 14-day expiry remove the notes' other copies on the device
  (`noteStore.removeCopies()`): the legacy value and its spare, the root fold's `backup:root-notes`, every value set aside as
  unreadable; the wipe also drops the wiped notes' queued uploads.
- **Tests:** `scripts/note-store.test.mjs` runs the store with redux-persist and the real notes slice over an in-memory file
  system with Android's behaviour (`scripts/_expo-file-system-legacy-fake.js`: asynchronous, URI paths decoded, rename replaces)
  and launches from a copy of the disk at every step of a write (and with the file being written cut in half): every note comes
  back as before or after the write, no change loses its upload, deletions waiting still go out. The web backend runs over an
  in-memory IndexedDB shared by "tabs" under Web Locks (a stale tab, a failed save, an older tab's saves).

**Trade-offs:**

- **Rollbacks:** a rollback to a version without the note store shows the notes as they were at the migration (the legacy
  value): what changed meanwhile, deletions and the trash included, comes back when the note store runs again, and from the
  cloud for synced notes. After 14 days the older version starts empty (the notes are intact in the note store).
- **Launch reads one file per note** instead of one file. On a Pixel 10 Pro: 400 notes (2.4 MB) in ~120 ms, against ~42 ms for
  the single file (whose parse blocked JS ~30 ms); 2000 long notes (12 MB) in 0.45-0.55 s, against 0.34 s for the single file,
  read and parsed in one block. The JS thread stays free meanwhile, and every save writes a few KB instead of the whole file. A
  pack file (all notes, rewritten rarely in the background, read first) is the next step if libraries grow further.
- **On the web the legacy value is read in full at each launch** while it's kept (14 days), to tell whether an older tab rewrote
  it.
- **Writes aren't fsynced** (expo-file-system has no fsync); a power loss right after a rename can leave an empty file, which
  reads as unreadable and is recovered from the legacy value or given up.
- **The legacy value stays on disk** (2.5 MB for 400 notes, notes deleted since included) for 14 days; values set aside after
  that stay until a wipe.
- **The last edit before a kill:** a save is now a few KB in milliseconds; what's still lost is what was typed less than ~0.3 s
  before Android killed the app (measured on a loaded emulator: the background event and the editor's commit need that long).

**Verified** (2026-10-20, release builds on the emulator, and on a Pixel 10 Pro over USB with the test package; the phone's own
FastMemo untouched): on the phone, the migration of 400 notes wrote 401 entries in 231 ms (JS blocked at most 29 ms), of 2000 in
870 ms. On the emulator, an update over 400 notes stored by the previous version (2.4 MB): every note there, 403 files, the old
file untouched; the migration wrote 401 entries in 607 ms with the JS thread never blocked over 113 ms (the synchronous first
version: 1908 ms, blocked throughout); cold relaunches wrote nothing; an edit rewrote its file. A note deleted for good, an
edit, a rollback to the previous build, an edit there, and the update again: the old version's edit came in, the newer edit
stayed, the deleted note stayed deleted, the next launch folded nothing. "Wipe data" left only the marker and an empty `state`
value; with that `state` value then removed, the app started empty. On the web: 300 notes (2 MB) migrated, first note on screen
454 ms after the reload, an edit wrote one 386-byte value in 23 ms.

---

## ADR-019: A First-Note Tour Instead of the Welcome Note

**Status:** Accepted (2026-10-20, user decision)  
**Context:** A new install got a "Welcome to Fast Memo!" note with a fixed id, rich text and a large embedded image. With cloud
sync, two devices each had their own copy under the same id and different content: the first sync showed a conflict copy. A new
install also opened the changelog right after the intro. The user's rule for anything shown at launch: never block someone who
opens the app to write a note in a hurry.

**Decision:**

- No welcome note on a new install (`defaultNote` is gone); notes already created keep theirs.
- A three-step tour, only for a new install: `settings.tour` (`"create"` -> `"write"` -> `"explore"` -> `"done"`). The intro's
  last step sets `"create"`; absent stays the default, so existing users (whose stored settings lack the key) never see it. It
  ends on `"done"`, not on a removed key: the settings are stored twice (ADR-003), and a key missing from one copy doesn't
  remove it from the other, so a tour removed in one copy only could come back.
- A classic spotlight (user decision): `TourSpotlight` (`components/ui/`) dims the whole screen (an SVG path with even-odd
  holes) except the step's targets, each ringed, and places the step's `TourTip` card on the roomier side of the one it points
  at, with an arrow. Targets register by name with `useTourTarget` (`libs/tourTargets.ts`) and are measured in window
  coordinates when the step shows. A step that asks to tap something lets touches through its single hole (four blocking bands
  around it); otherwise the layer takes every touch. Every step but the last has "Skip".
  - Home, `"create"`: the add button group lit, the card pointing at "+" (the type menu hides the step while open).
  - Editors, `"write"` (`EditorTourTip`, the last child of each editor): the back button lit and tappable. Opening any note
    moves `"create"` to `"write"`; "Got it" or leaving the editor moves to `"explore"`. The new note's autofocus waits
    (`useAutofocusNewNote`): the keyboard would come up and the typing go on under the dimmed screen. Home moves a `"write"` it
    finds on focus to `"explore"` (the app closed in the editor).
  - Home, `"explore"`: the first note and the sidebar lit, "Got it" ends the tour. The card starts right of another lit target
    on its left (the sidebar), narrower, rather than covering it.
- Measured when shown, after 400 ms, when a target comes or goes, on the layer's layout, and again 300 ms after a window resize
  (a list's cells resize after the event). The card is announced to screen readers when it shows.
- A new install marks the current version as seen (`@appVersion`), so its first home screen shows no changelog.

**Trade-offs:** the tour state lives in the settings slice (local, not synced): a second device gets its own tour, which is
right for a new install. A step blocks the screen until it's done or skipped (only on a new install, right after the intro). The
last step mentions long-press even when no note was written (then only the sidebar is lit).

**Pitfalls met** (2026-10-20): the blocking views must be real native views (`collapsable={false}`), or Android's native inputs
under a flattened one still take the touch; and the layer's fade uses React Native's `Animated`, because Reanimated's web View
drops `pointerEvents` and the layer then swallows the taps meant for the hole.

## ADR-020: Seasonal Alternate App Icons with `expo-alternate-app-icons`

**Status:** Accepted (2026-10-20, user decision)  
**Context:** Developer options had a disabled "Change app icon" row and a `developerMode.customAppIcon` field that nothing used.
The user wanted four seasonal icons (Halloween, Christmas, Easter, Summer) to pick from.

**Decision:**

- `expo-alternate-app-icons` (approved by the user): iOS alternate icons, Android one `<activity-alias>` per icon, switched with
  `setComponentEnabledSetting(DONT_KILL_APP)`. The OS keeps the choice, so it is the only source of truth (`getAppIcon()`);
  `customAppIcon` stays unused (removing a persisted key needs the ADR-003 audit first).
- Sources in `assets/images/app-icons/source/*.svg`, each split into `<g id="background">` and `<g id="foreground">` (the F and
  what is attached to it); `scripts/build-app-icons.mjs` (rsvg-convert) renders the iOS PNG and the two Android adaptive layers,
  scaled to 0.68 so the launcher mask shows the whole artwork. Decorations stay within ~450 px of the centre so a circle mask
  doesn't cut them off. The designs are on the Claude Design canvas "FastMemo Seasonal Icons".
- The names live in `app.config.ts` and in `AppIconName` (`constants/app-icons.ts`): keep them equal.
- `libs/appIcon.ts` wraps the module (iOS: switched in place, with a system alert); `appIcon.web.ts` says unsupported (web,
  Tauri), and the Developer options row is then disabled. On Android (`appIcon.android.ts`) disabling the alias the app runs
  from closes its window on the spot, `DONT_KILL_APP` notwithstanding (measured on the API 36 emulator, 2026-10-20). Applying
  the choice on the next `background` was tried and dropped: an image picker, a share sheet or a permission dialog sends the app
  there too, and the switch would close it mid-task. So the picker asks first ("Fast Memo closes"), flushes (`flushNow`),
  switches and closes the app if its window is still up (where it survives, its activity keeps the old alias's name and the next
  switch would disable the wrong component: two icons). The choice survives an app update.
- The picker (`app/settings/app-icon.tsx`) reuses `SelectableCardList` with 144 px previews (`*-preview.png`, also from the
  build script): the 1024 px icons would be decoded whole for a thumbnail.
- `withAlternateIconIntentFilters` (`app.config.ts`) copies MainActivity's non-launcher intent filters onto every alias: the
  plugin gives an alias only the launcher filter, and once an alias is enabled MainActivity is disabled, so the URL scheme
  (expo-router, the dev client) would stop opening the app. It wraps the config rather than sitting in `plugins`: the mods
  registered last run first, so it runs after the aliases exist.

**Trade-offs:** a native module: it needs a new build, an OTA can't deliver it (the fingerprint changes). Choosing an icon on
Android closes the app. iOS is configured but not built or tested yet (no `ios/` here).

## ADR-021: Note HTML Sanitized with DOMPurify in the Rich Text Editor's Page

**Status:** Accepted (2026-10-21, user decision: DOMPurify, with a check that no note's HTML breaks)  
**Context:** The text editor (react-native-pell-rich-editor) puts a note's HTML into its page with `innerHTML` and
`execCommand("insertHTML")`. On web and desktop that page is a same-origin `srcdoc` iframe: an `<img onerror>` in a note runs
with the app's origin (its storage, the parent window, on desktop the Rust commands). Notes come from imports and other devices.
The web PDF export rendered a note, and its title unescaped, straight into the app's page (LL-060).

**Decision:**

- DOMPurify (approved as a direct dependency, pinned; jspdf already pulled it in, now one copy) runs inside the editor's page:
  `src/editor/sanitize-entry.ts` wraps every way HTML becomes DOM there (the `innerHTML`/`outerHTML` setters, also on
  `ShadowRoot`, `insertAdjacentHTML`, `execCommand("insertHTML")`, `createContextualFragment`, `setHTMLUnsafe`,
  `Document.parseHTMLUnsafe`). It is bundled by `scripts/build-sanitize.mjs` into `src/generated/editor-sanitize.ts` (as
  CodeMirror is) and injected through `injectedJavaScript`: the end of the web iframe's page, and on Android evaluated when the
  page finished, ahead of the onLoad that sets the note (`injectedJavaScriptBeforeContentLoaded` is only an earlier try there).
  `scripts/sanitize.test.mjs` fails while the generated file is out of date; it runs in the OTA workflow's checks.
- HTML dropped from elsewhere is inserted as its text (as a paste is, `pasteAsPlainText`): the browser's own drop insertion
  passes no hook. A drag within the note is left to the browser.
- One configuration for the editor and the web PDF export (`NOTE_HTML_CONFIG` + `addNoteHooks`): DOMPurify's defaults plus
  `contenteditable` (the to-do box), unknown schemes allowed (`obsidian:` links, old `file:`/`content:` images); no forms or
  their controls (an `<input>` stays only as a checkbox), dialogs, popovers, style sheets, `<link>`/`<meta>`; no `position` in a
  style (an overlay posing as the app); links lose `intent:`, `android-app:`, `file:`, `content:` and the app's own schemes. A
  read-only note can't pose as a login screen, open an Android intent, or (a form's button) reload the editor empty.
- On web the editor iframe and the app read only each other's `postMessage`: pell runs the commands it gets as code, and the web
  WebView hands every window message to the editor. In the iframe, a message from another window reads as `"{}"` (a
  `MessageEvent.prototype.data` getter, as pell's listener is added first); the app page drops, before any WebView listens, a
  message from a window that isn't itself or one of its iframes (`src/libs/messageGuard.web.ts`).
- The web PDF export builds its container from nodes (the title as text, the note as DOMPurify's fragment), never parsing it
  again. The PDF title is escaped (`escapeHtml`) on every platform.

**Alternatives rejected:** a sanitizer of our own (less tested against mutation XSS); a sandboxed iframe without
`allow-same-origin` (the keyboard shortcuts, find/replace and the editor bridge read the iframe's document); sanitizing on the
React Native side (no DOM on the phone).

**Verified (2026-10-21):** 329 real note HTML samples (pell's output for 265 toolbar cases from the rich text audit, legacy
shapes, what the app writes, hand-written ones) come out as the browser alone makes them, except a trailing space in a `style`
and Word's empty `<o:p>`/`<meta>`; 25 payloads through 5 sinks: 37 runs without the hooks, none with them. In the web build the
editor's content, a note edited and reopened, and the screenshots are identical before and after; a payload note ran code 13
times before (11 in the app's own page), never after.

With the tighter configuration (same day): the same samples change only by a link's `target`; the policy, the message guards
(another frame and a popup are not heard, the app, the page itself and its ports are), the drop handler and the PDF export are
checked in Chrome; in the web build the content is identical, and the payload note no longer reloads the editor when clicked.

**Trade-offs:** ~34 KB of script in the editor's page (only the note route's chunk on web). The HTML a note keeps can differ
from what was stored in insignificant ways (attribute whitespace) once it is edited.

---

## ADR-022: Desktop Window Shown Once Drawn; on macOS Closing It Leaves the App Running

**Status:** Accepted (2026-10-21, user request for desktop 2.0.0)  
**Context:** The window opened at once: ~0.4 s of an empty dark window, then the logo screen, then home (measured on the release
build, warm start). The Tauri splash window tried before (logo + progress bar) was too much. On macOS, closing the window quit
the app, so reopening it meant loading again; the user asked for Notes' behavior (the app stays in the Dock, right click → Quit
ends it).

**Decision:**

- The main window starts hidden (`visible: false`) and the frontend shows it once home is drawn (`windowReady()` in
  `app/home.tsx` → `window_ready`, after Geist or 300 ms), or as the first launch's logo animation starts. Rust shows it after 5
  s anyway (a frontend that failed to load). This first show doesn't take the focus (a slow start after the user moved on to
  another app); the Dock, a second launch and the menu's commands do. A reload doesn't show it again.
- macOS: the close button / Cmd+W hide the window and the frontend flushes pending edits (`fastmemo://hidden`, no exit, nothing
  waits for it: the app goes on running); the Dock icon, opening the app again (`RunEvent::Reopen`), a second launch and the
  menu's commands (New Note, Settings…) show it, on the Space the user is on (2026-10-22, user request: on every Space while
  shown, then back on the current one; size and place kept). Cmd+Q keeps the held quit (ADR-015). A full screen window leaves full screen
  first and is kept hidden from the end of that animation (LL-061); asking for it back meanwhile cancels that.
- Windows and Linux: closing the window quits after the flush. While the local MCP server is on, with its "keep running" switch
  (ADR-032, 2026-11-06), it hides the window instead, with the same `fastmemo://hidden` flush, and a tray icon stays, with Open and
  Quit; switching either off restores the quit at once.
- `tauri-plugin-window-state` (approved): size, position and zoom remembered; not the visibility (it would show the window
  before it's drawn) nor full screen. A quit in full screen (even while leaving it to be hidden) keeps the window as it was
  before: its last ordinary frame, zoomed or not (window-state alone would save a zoomed window filling the screen:
  `save_windowed_frame` rewrites its entry on `RunEvent::Exit`, after the plugin's save).
- A hidden window's page keeps running, throttled (WebKit's default policy): the sync engine stays on (listeners, the 5-minute
  poll), so the notes are current when the window comes back, as for a window left open behind others. The first showing at
  launch isn't a return to the foreground (`SyncOnProvider` resumes only after a hide). Measured on macOS for 36 minutes, and what
  Windows and Linux with MCP on rest on (the results per OS: ADR-032).
- The desktop update check runs at launch and again every 6 h while the app runs (an hourly tick, and the window coming back): a
  Mac app now runs for days. A version already offered isn't offered again in that run (Settings still shows it).
- Later (after 2.0.0, user decision): a real JS-only OTA for desktop (a signed web bundle served in place of the bundled one,
  same origin, a runtime version as Expo's fingerprint, rollback when it doesn't reach `window_ready`). Until then a desktop
  hotfix is a signed release: the **publish** workflow's `desktop_only` run (tag `desktop-vX.Y.Z`, never GitHub's latest, the
  latest release's `latest.json` pointed at it; prepare-release skill).

**Measured (2026-10-21, test build, release, warm):** before: window at ~0.4 s, empty, home at ~0.65 s; after: window at ~0.6 s
with home drawn. The first launch after an install/reboot takes ~2.5 s. A never-shown window boots at full speed: the page is
`hidden` but its script, IndexedDB and React run (same times with WebKit's throttling `disabled`, `throttle` or default). Of the
~0.6 s, ~0.1 s is the Rust shell and ~0.2 s the page (6.3 MB of JS to home): splitting the bundle (Sentry, PDF, Firebase,
locales, Lottie) would save tens of ms, not done. Verified by hand on macOS: close/Dock/reopen/second launch, a menu command
while hidden, full screen close (and reopen during it), menu Quit (flushed, ~0.2 s), Dock-style Quit, size/position restored.
Windows (WebView2) and Linux (WebKitGTK) not tried yet: the first show must come from `window_ready`, not the 5 s fallback.

**Alternatives rejected:** a splash window (another window to keep in sync, and the old one felt heavy); `visible: true` with a
CSS splash in `index.html` (still a flash, then a second screen); a menu bar (tray) app (not what the user asked; reversed for
Windows and Linux only, and only while MCP keeps the app running: ADR-032).

**Trade-offs:** for ~0.6 s (~2.5 s cold) there's no window (on macOS the Dock icon, briefly; on Windows/Linux not even a taskbar
button). A hidden FastMemo (on Windows and Linux, only with MCP on) keeps its memory (~a browser tab) and keeps syncing (Firestore
reads as for an open window). A protected note left open is still open when the window comes back (as when minimized). Dock Quit /
logout with the window open still skip the flush (ADR-015); with it closed the flush already happened.

---

## ADR-023: Rich Text Line Types Handled by a Script in the Editor's Page

**Status:** Accepted (2026-10-21, user decision: the line types are exclusive, the button of the current type turns the line
back into text, H1 takes a bullet out of its list, Backspace at the start of a bullet removes it, Enter twice leaves a code
block, a code block is a plain `<pre>`)  
**Context:** pell's heading, code and list buttons are bare `execCommand`s that nest and never turn off (LL-062). RichToolbar
sends them to the page itself, with no prop to replace them, and pell's page keeps its actions in a closure.

**Decision:**

- `src/libs/richTextEditor.ts` holds `RICH_TEXT_SCRIPT` and `RICH_TEXT_STYLE` (the editor's style). The script is plain ES5, run
  by `RichEditor.command` once pell is up (`editorInitializedCallback`; a second run does nothing) and exposed as `window.__fm`.
  `LabeledRichToolbar._onPress` sends heading, code and the two lists to `window.__fm.toggle(type)` after
  `focusContentEditor()`, which restores pell's saved selection. Every other button goes to RichToolbar. The image picker
  inserts through `window.__fm.insertImage`.
- Every change is an `execCommand` on whole elements (select the element's contents, then `formatBlock`), so the browser's undo
  keeps working. Only the repair of nested markup from saved notes (unwrapping) is a DOM edit that undo skips.
- Enter in a code block is handled by a capture listener on the document, ahead of pell's keydown handler, which loses the caret
  in a `<pre>` without pell's `<code>` lines. A keyboard that sends a new line as `beforeinput` instead of a key goes through
  the same code. A new line in a code block is `insertLineBreak` (a `\n`), never the browser's new paragraph, which splits the
  block on Android's WebView 134. The `\n`s become `<br>`s when the block turns into text (`formatBlock`), so the selection's
  character offsets skip them.
- `scripts/richtext.test.mjs` runs the real page in headless Chrome (`createHTML` with the app's options, the note sanitizer
  (ADR-021) and the script), with the messages RichEditor posts and real key events.

**Alternatives rejected:**

- patching pell: patch-package is a new dependency, and the page's actions live in a closure;
- replacing whole blocks with `insertHTML`: it merges them with the neighboring blocks and adds stray markup;
- DOM edits for the line types: they break undo;
- another editor (TipTap, Lexical): a rewrite of the screen and of the stored HTML.

**Trade-offs:**

- about 8 KB more script in the editor's page;
- the editor's behavior now lives in two places (pell and the script), so a pell update must pass `scripts/richtext.test.mjs`;
- the code button still never shows as selected: pell has no state for it.

---

## ADR-024: Image Options in Text Notes: a Menu in the App, the Changes in the Editor's Page

**Status:** Accepted (2026-10-21, user decision: size S/M/L/Full keeping the aspect ratio, align left/center/right, delete,
full-screen viewer with zoom, rotate 90°, share/save; the menu and the viewer as built here were not discussed further)  
**Context:** A text note's images are `data:` URLs in its HTML (the picker stores JPEG at 0.3), shown at their own width with no
way to resize, align, turn, look at closely, share or remove them other than with the keyboard. The editor is pell in a WebView
(Android) or an iframe (web, desktop), extended by the page script of ADR-023.

**Decision:**

- **The page reports a tap and the app shows the menu.** A touch on an image that didn't move more than 10 px, or a click, is
  `preventDefault`ed so it places no caret and opens no keyboard. A long press (over 400 ms) is left to the browser, which
  selects the image, and the click it makes afterwards is ignored. The page script posts `FASTMEMO_IMAGE` with the image's
  index, key, `src`, natural size, width, its line's alignment, the point tapped, whether the note is editable, and what can be
  done to the image (`alignable`, `rotatable`). NoteTextEditor adds the editor's window position and opens `NoteImageMenu`
  there. That is a `PopupMenu` in its `at` mode: opened at a point instead of under a trigger, centered on it, and flipped above
  it near the screen's bottom.
- **The choice comes back as `window.__fm.image(index, key, change, value)`** (`imageCommand`, which writes every value as a
  JSON literal, so a message can't add code to the command). The key (the `src` length and its last 32 characters) makes a
  choice on an image that changed since (another device's edit) do nothing. A read-only note changes nothing, and its menu
  offers only view and share. The page refuses what the menu doesn't offer.
- **Every change is an `execCommand`, so undo works.** Size and rotation replace the image with a changed copy through
  `insertHTML`. An image in a link is replaced along with the whole link, since an `insertHTML` of the image alone drops the
  link. The alignment is `justify*` on the image's line, and delete is `delete` on the image. The selection is put back
  afterwards (LL-065).
- **Size is a width in % of the note** (25/50/75/100) with the height left to the ratio, so it fits every screen. Alignment is
  the line's `text-align`, shared with any text on that line. It isn't offered in a code block, which stays a plain `<pre>`
  (ADR-023): `justify*` would put a `<div>` in it.
- **Rotation re-encodes the image in a canvas,** in its own type. A JPEG or a WebP gets the best of 0.8, 0.5 and 0.3 that keeps
  it within 15% of its size. The picker's JPEG at 0.3 grew 1.6 to 2.3 times at 0.7, measured on three images, and a note has a
  size limit. A PNG stays a PNG for its transparency. Rotation is offered for JPEG, PNG and WebP `data:` URLs only: a GIF would
  stop moving, and a linked image taints the canvas. An image the canvas still can't read posts `FASTMEMO_IMAGE_FAILED`, and the
  app shows a toast.
- **The viewer is native** (`ImageViewer`: an RN `Modal` with gesture-handler pinch, pan and double tap, and Reanimated), not
  inside the WebView. It covers the screen, has the app's chrome, and Back closes it. It is mounted only while shown, and opens
  once the menu has closed, never two modals at once.
- **Share and save:** a phone writes the image to the cache folder and opens the share sheet with its MIME type (`exportImage`).
  Only the last image shared is kept there, and the next share removes it. The web downloads it, and the desktop opens the save
  dialog (`saveFileWeb`). `utils/dataUrl.ts` reads the `data:` URL.
- `scripts/richtext.test.mjs` (section 5) clicks and taps images in the real page. It runs every change with undo and checks:
  the stale key, a PNG, read-only, the caret cases, links, the size after a turn, code blocks, GIFs, a long press, and a message
  that tries to add code.

**Alternatives rejected:**

- a menu drawn inside the page: another UI to style and translate, with the WebView's own selection and keyboard in the way;
- drag handles to resize: fiddly on a phone, and the four sizes are what was asked for;
- rotation as a CSS `transform`: the box doesn't turn (the image overlaps the text), and exports, the share sheet and other apps
  see the image unturned;
- DOM edits for the changes: they break undo.

**Trade-offs:**

- every tap sends the image's `data:` URL over the bridge, since the menu and the viewer need it;
- rotation re-encodes a JPEG, which is lossy, at a lower quality when a higher one would make it bigger;
- the alignment applies to the whole line, text included;
- `insertHTML` lets Blink add inline styles to the copy (`font-size: 1em`, with no visible effect).

## ADR-025: A Lighter Mobile Startup: Fonts Built In, kotlin-reflect Warmed Up, No Animation into Home

**Status:** Accepted (2026-10-22, user request: a faster startup on mobile, and no animation from the splash into home, the
intro keeps its fade)  
**Context:** The user found the startup slow on a fast phone, and the passage from the splash into home sometimes stuttered.
Measured on a non-debuggable build (LL-066), the JS mostly waited: the app drew nothing until `useFonts` had loaded the 4 Geist
files, and the store's rehydration waited behind the first file read, which paid for kotlin-reflect's first use on Expo's one
async queue. Home then faded in while it was still drawing its first frame. The WebView warm-ups of the rich text and code
editors come after home is shown and stay as they are.

**Decision:**

- **The Geist fonts are built into the apps** with the expo-font plugin's `fonts` (`GEIST_FONTS` in `app.config.ts`): there is
  nothing to load, and the first frame has them. On Android the file name is the family name, so `FONT` keeps its names. The web
  loads them as before: `useAppFonts` is split, a no-op in the apps and `useFonts` on the web, which draws without waiting.
- **kotlin-reflect is warmed up in `MainApplication.onCreate`** by a config plugin in `app.config.ts`
  (`withKotlinReflectWarmup`): a thread of its own reads the constructors of expo-file-system's legacy option classes while the
  JS engine starts, so the first read finds kotlin-reflect ready. The classes are named as strings: a class renamed in an
  expo-file-system update only skips its warm-up (`runCatching`), and the build doesn't break.
- **No animation into home** (`animation: "none"`), from the logo, the intro, or a note that can't open. The intro keeps its
  fade.
- The DEV test APKs are built non-debuggable: a debuggable one runs its Java/Kotlin interpreted (CONVENTIONS #44).

**Alternatives rejected:**

- calling `getInfoAsync` without options first: the first call with an options object pays for kotlin-reflect anyway, whatever
  the call, and the notes' reads take options;
- loading the fonts after the first frame: the first screens have text, which would show in the system font and then change;
- splitting the JS bundle or lazy screens: the JS from its start to home's first frame is ~240 ms on the emulator, mostly the
  first render of home, and expo-router's lazy routes made the desktop show an empty screen before every screen (see the
  `asyncRoutes` comment in `app.config.ts`);
- moving the editors' warm-ups later: the user wants them, and they run after home is shown.

**Trade-offs:**

- the warm-up is native: it needs a store build (not an OTA), and a local build needs `npx expo prebuild -p android` after
  pulling this change;
- the warm-up's class list follows expo-file-system's legacy API, which the note store uses: if the store moves to another API,
  the list must follow it, or the warm-up stops helping (nothing breaks).

## ADR-026: The Note Size Limit Comes from the Cloud; a Note Too Large for It Goes Offline

**Status:** Accepted (2026-10-22, user decision: a FastMemo server sets its own limits, and a switch to a cloud with smaller
ones must not end badly; option "B" over one limit for every cloud)  
**Context:** Firestore takes documents up to 1 MiB; a FastMemo server takes notes up to `MAX_NOTE_MB` (5 by default). The app
had one limit, 1 MB of text, too much for Firestore once encrypted (LL-067) and less than a server allows. A user can also move
from a server to Firebase, or the server's admin can lower `MAX_NOTE_MB`: notes that fit before may not fit any more. The device
limit needed nothing new: each cloud already refuses a device over its limit when it connects.

**Decision:**

- **Each cloud says how big a note may be,** as it measures it: `CloudBackend.maxNoteBytes`, the UTF-8 bytes of the note's JSON
  as sent, encrypted (`jsonBytes` in `libs/cloud/size.ts`). Firebase: 1,000,000 (the 1 MiB document, less room for field names).
  The server: `maxNoteBytes` from `/v1/info` and `/v1/devices` (an optional field, protocol 1). Asked with the device's token
  (the device list), not the access key; null until the server said it.
- **A cloud doesn't send a note over its limit:** `push` returns it in `PushResult.tooLarge`, without trying. With the limit
  unknown (null), nothing is held back: the server refuses what's too big (`rejected`), as before. A note is never made offline
  on a guess.
- **The engine makes such a note offline** (`detachNote`, as the offline notes feature does): it leaves the cloud, and every
  device keeps its own copy, marked offline. The user is told once (`onTooLarge` → the `tooLarge` sync event → a toast in
  `SyncOnProvider`). It isn't a sync failure (LL-004) but a change to the notes the user has to know about.
- **The text editor's limit is the cloud's,** turned into text (`noteTextLimit`: three quarters of it, less 4 KB for the other
  fields): about 0.71 MB of text on Firebase, 3.75 MB on a server with `MAX_NOTE_MB=5`. An offline note, or no cloud: the app's
  1 MB. Over the limit only what makes the note smaller goes in, so a note already over it can be cut down. Lists, kanban boards
  and code notes have no limit in their editors: the check at sending covers them.
- Back to syncing: cut the note down, then "Sync to cloud", which publishes it as a new note (" (2)"), as for any offline note.

**Alternatives rejected:**

- one limit for every cloud (what Firebase takes, ~0.75 MB of text): simple and every note can move anywhere, but a server's
  owner couldn't allow bigger notes;
- splitting a big note over several Firestore documents: more reads and writes on a quota that's tight already, and another
  format to keep in step on both clouds;
- leaving a note the cloud refuses in the outbox (as before): it never syncs, and nobody knows.

**Trade-offs:**

- a note that went offline for its size no longer syncs: each device's copy goes its own way;
- the editor shows less than `MAX_NOTE_MB` (the limit counts the encrypted note);
- a server older than 1.0.0 doesn't say its limit: its refusals stay silent, as before.

## ADR-027: A Category Suggestion Is Previewed, and Offers Its Runner-Up When the Model Was Torn

**Status:** Accepted (2026-10-22, user decision: a before/after like the other AI actions; the choice between two only when the
AI isn't sure, over always two or a list of every category)  
**Context:** "Suggest category" applied the model's answer straight away, with a check on the button as the only sign. Unlike
the title or a rewrite, the user couldn't turn it down, and a note that fits two categories got one of them silently.

**Decision:**

- **It's a preview** (`PREVIEW_ACTIONS`): before = the note's category ("All" translated), after = the suggestion, Apply/Cancel.
  It doesn't stream (a name half written means nothing): a spinner, then the answer. A suggestion that is already the note's
  category, with nothing close, opens nothing: a toast says so (`ai.editor.category_unchanged`). Applying checks the category
  hasn't changed meanwhile (`source`), as a title does.
- **The runner-up comes from the model's own probabilities,** not from a second question: the completion asks for `n_probs: 10`,
  and `categoryAlternative` (`libs/ai/helpers.ts`) walks the answer's tokens. A candidate that leaves the answer's path starts
  another category's name; its probability against the token taken says how close it came. The sampler reports them after the
  temperature (0.2 for this action), which sharpens them: a ratio r there was r^0.2 before, undone. At 30% of the first or more
  (`CATEGORY_ALTERNATIVE_RATIO`), both are offered as radio rows, the model's pick ticked, with `ai.editor.category_unsure`.
- What the model picks doesn't change: the grammar still allows only the category names (or none).

**Alternatives rejected:**

- always two suggestions (a grammar for two names): the small models fill the second slot with anything;
- every category under the suggestion: a long list for a choice the model was sure about;
- scoring each category with its own completion: one run per category, seconds each on a phone.

**Trade-offs:**

- top_p (0.8, before the temperature) drops a candidate when the first token holds 80% or more: such a pick is offered alone;
- a name split inside a multi-byte character (accented letters) is shown by llama.rn as bytes: its runner-up is missed, the pick
  still works;
- the 30% threshold is a guess, to tune on a phone with real notes.

## ADR-028: The AI Model Downloads Through Android's DownloadManager, Across Restarts

**Status:** Accepted (2026-10-22, user decision: the system download, over a third-party library or only keeping the in-app one
running)  
**Context:** A model is 0.5 to 2.7 GB: minutes of download. The app downloaded it itself (`createDownloadResumable`), only while
its process lived: the screen kept no hold on it (reopened, it showed "Not downloaded" while the file was still growing), a
download that died left its file behind at its catalog name (not counted as an old model, never cleaned), and Android stops a
background app's network work. The user had to stay on the screen with the screen on.

**Decision:**

- **A local Expo module, `modules/fastmemo-downloads`** (Kotlin, Android only, no new dependency), hands the download to the
  system's `DownloadManager`: it goes on with the screen off and the app in the background or closed, resumes after the network
  drops, and shows its progress in a notification (none once done: tapping it would try to open the model file).
- **Staging, then a rename.** The download manager reserves the file's whole size at the start, so a cut-off file would pass the
  size check: it writes into `files/model-downloads/` on the app's shared-storage folder, and only a finished download moves
  (rename, same storage) into `files/models/` there, where models are looked for. The download manager can't write the app's
  private files, so new models live in that folder; models downloaded before stay in the private `files/models/` and are still
  read (`modelDirs`). Moving them would need their size free twice.
- **Written down, picked up.** The download under way (model, file, id) is kept in `model-download.json` in the private files.
  At the AI module's load and each time the app comes back to the foreground, `resumeModelDownload` follows it, or finishes one
  done meanwhile; the settings (`modelDownloaded`, `enabled`) are set by the module when it ends, not by the screen, which may
  be closed by then (it used a stale copy of the settings).
- **The screen follows the module** (`getModelDownload`, the status listener): opened again it shows the download under way,
  "Waiting for the network" while the system holds it, and says so when it fails (no space, or any other error).
- **Leftovers:** a catalog file short of its size counts as an old model (offered for deletion, removed at the next download),
  unless the in-app download is writing it; at the app's start, without a download under way, the staging folder is emptied.
- A binary without the module (an old dev client) downloads in the app, as before.

**Alternatives rejected:**

- `react-native-background-downloader`: the same through a library (a new dependency);
- a foreground service: a Play Console declaration for its type, and a notification of our own to keep up;
- keeping the in-app download running when the screen closes: Android still stops it with the screen off for long.

**Trade-offs:**

- new models sit in the app's folder on the shared storage (`Android/data/<package>/files/models`): deleted with the app,
  like the private files, and not readable by other apps;
- the progress shows in a system notification with the download manager's look, title the model's name;
- a download that ends while the app is closed is moved into place at the next start: until then the AI stays off.

## ADR-029: A Cloud Out of Reach Gets a Quiet Line in the Home

**Status:** Accepted (2026-10-22, user decision: "niente di invasivo, niente spam"; a line under the title, in place of the
category, over an icon in the header or a status in the settings only)  
**Context:** Cloud sync is silent by design (LL-004): offline is not an error and the outbox retries. With Firebase, a device
online that can't reach the cloud is rare. A self-hosted FastMemo server makes it common and actionable: a server reached
through a VPN (WireGuard) the user forgot to turn on, a server at home that's down. The app then looked synced while nothing
left the device.

**Decision:**

- **The engine tells whether the cloud answers** (`SyncEvents.onReachability`): a read that answers (a snapshot from the
  server, a pull, the vault) or fails (a listener error, a failed pull or vault read). Only on a change: `failingSince` set when
  the reads start failing with no answer since, null when one answers again or the engine stops; `lastContact` its last
  answer. Pushes don't count: a refused push is not an unreachable cloud.
- **`sync.ts` turns it into what the home shows** (`getCloudStatus`, the `reachability` sync event): unreachable once the cloud
  has failed for 30 s (`UNREACHABLE_AFTER_MS`), a timer from the first failure. `useCloudStatus` adds the network: offline,
  nothing (the user knows).
- **The line** (`CloudUnreachableLine`) takes the place of the category and count under the home's title: "Server
  unreachable · 3 waiting" (or Firebase), in yellow on the category's pill. A tap opens a dialog: the changes stay on the device
  and go out by themselves, the notes waiting, the last sync, for a server a hint to check the VPN; Close or Retry
  (`reconnectNow`: reopen the connection, pull, push).
- Nothing else: no toast when it goes or comes back, nothing in Redux, nothing per note.

**Alternatives rejected:**

- an icon in the header: quieter, but its meaning has to be guessed;
- a status in Settings → Cloud Sync only: never seen when it matters;
- a toast when the cloud stops answering: the spam LL-004 rules out (flaky networks, a server restarting).

**Trade-offs:**

- the category and count aren't shown while the line is (the sidebar still marks the category);
- 30 s with a server that times out slowly can mean a minute before the line shows;
- Firebase rarely fails while online: the line will mostly be seen with a server.

**Update (2026-10-22, user request: "un pallino verde che fa ping [...] che si capiscano a vista d'occhio"):**

- **A status dot** next to Settings → Cloud Sync (`CloudStatusDot`, `BlinkingDot` with `animation`): green and pinging when the
  cloud answers, grey when the device is offline, red when it doesn't answer while online (`CLOUD_STATE_COLOR`). Nothing while
  not connected or before the first answer. Only the green one moves: the state reads without the color too. It adds to the
  home's line, it doesn't replace it (the "status in Settings only" rejected above was about it being the only signal).
- **The Cloud Sync page** shows the state in words under the switch ("Server reachable", "Server unreachable" with Retry and
  what to check, "No internet connection"), naming the cloud in use, not the one being picked in the form.
- **The devices screen** says why it has no list: offline, the cloud doesn't answer (no answer in 5 s, or
  `listDevices` → `"unreachable"`), or an error; with Retry, which also asks the engine (`reconnectNow`). A list that comes later
  replaces the message.
- **No answer vs an error:** `listDevices` returns `CloudDevice[] | CloudFailure`. On a server, no answer is a fetch that
  failed, a timeout, or a proxy saying the server behind it didn't answer (502-504, Cloudflare's 52x and 530); on Firestore,
  `unavailable` / `deadline-exceeded`.
- **A listener that loses the cloud says so** (`subscribeDevices`' `onLost`): Firestore when it serves its cache, the server's
  poll when it gets no answer (it then asks for the state at once on the next poll, to hear when the server is back). Before,
  the server's poll retried silently and a server down mid-session went unnoticed until the 5-minute poll (LL-069).
- `useCloudStatus().state` is `"ok" | "offline" | "unreachable" | null`; the engine also reports its first answer and its stop
  (`lastContact` null), so the dot doesn't show a cloud nobody has asked yet.
- **Time offline doesn't count** toward the 30 s: back online, a cloud still failing gets its 30 s again (`sync.ts` follows
  NetInfo, in the same tick as `useNetInfo`), and the server's poll starts its backoff over when woken on purpose. A stopped
  engine, and a task from before a stop, report nothing (sync turned off while a read was timing out showed the line).


---

## ADR-030: Release Texts Written for People: a Short Changelog and Release Notes with Details

**Status:** Accepted (2026-10-22, user decisions after the v4.0.0 release: the GitHub release was "un papiro" with ADR numbers and
a line on the developer's role in About, "overkill, over-engineered"; then: the release page may go further on the technical
side, in nested bullets, for curious readers, while `/api/version` stays short)  
**Context:** Each release had two changelogs: `docs/CHANGELOG_MOBILE.md` / `CHANGELOG_DESKTOP.md`, a complete developer log
(every fix, refactor, SDK bump, ADR/LL references) that the `publish` workflow put in the GitHub release; and the user changelog
in the 7 locales (≤5 bullets), shown in the app, on Play and by the desktop updater. The release page showed the log.

**Decision:**

- **The changelog** stays the user changelog in the locales (`changelog.mobile` / `changelog.web`, `description_X_Y_Z`): the
  app, Play, `latest.json`. `scripts/changelog-notes.mjs` reads the English one; `publish` fails early if it's missing.
- **The release notes** are `docs/RELEASE_NOTES.md`, rewritten for each release: the same bullets in English, each explained
  in nested bullets (how it works, what made it faster), then a "Full changes" comparison link added by `publish`. Its
  headings must name the versions going out, or `publish` stops (a stale file is last release's text).
- **`/api/version`** (website) serves the short version: the release's top-level mobile bullets as plain text, the desktop
  ones from `latest.json`.
- Both texts are for people: no ADR/LL numbers, refactors, CI or trivia. `docs/CHANGELOG_*.md` are removed: the history is in
  the GitHub releases and git.

**Alternatives rejected:**

- the release built only from the short changelog: right for the API, too thin for the release page;
- keeping the developer logs: nobody reads them, the commits and ADRs already hold that detail.

---

## ADR-031: A GitHub APK That Updates Itself, Next to the Play Build

**Status:** Accepted (2026-10-28, user decisions: an APK on GitHub for anyone without Google Play, the same app and modules as
the Play build; in-app install over a browser download; OTAs for both builds, published twice, over an APK without OTAs; the
first APK ships as 4.0.0)  
**Context:** FastMemo was only on Google Play. Users without Google services, or who don't want to depend on a store, had no
way to install it on Android. An APK published on GitHub can't update through Play: it needs its own updater. Installing an
APK from inside an app needs `REQUEST_INSTALL_PACKAGES`, which Google allows only to apps whose core function is installing
packages: it can't be in the Play build.

**Decision:**

- **Two builds, one channel.** The `production-apk` EAS profile extends `production` (same EAS environment, channel
  `production`, `buildType: apk`, `autoIncrement: false`) and sets `FASTMEMO_DISTRIBUTION=github`.
- **The updater exists only in the APK.** `modules-apk/fastmemo-installer` (a plain React Native module, Kotlin) declares
  `REQUEST_INSTALL_PACKAGES` and opens the system installer on a downloaded APK. `react-native.config.js` links it only when
  `FASTMEMO_DISTRIBUTION=github`: Expo modules can't be linked conditionally (`expo.autolinking` is read from `package.json`
  only), React Native ones can. Outside `modules/`, which Expo scans and would link everywhere. The Play build's native code
  and fingerprint don't change (4.0.0's `689318…` stayed the same).
- **The JS knows the build by the module** (`isApkBuild()`: `NativeModules.FastmemoInstaller` present). Not by an app config
  field (an OTA's manifest replaces it, and it would move the Play build's fingerprint), not by the installer package (wrong for a
  Play APK from a mirror).
- **The update.** `/api/version` gives `mobile.apkUrl` (the latest release's first `.apk` asset). On a newer version the APK's
  icon opens a dialog with the release's short notes; Install downloads the APK into the cache (`createDownloadResumable`,
  a progress bar in the dialog, cancel; tapping outside hides it and the download goes on), flushes the editors, and hands it to the
  installer (a content URI from expo-file-system's provider). The first time, Android asks to let FastMemo install apps.
  Settings → Check updates asks the API again. A release without an APK: the icon opens its GitHub page.
- **Only FastMemo, signed by its key.** The app downloads only from `https://github.com/ontech7/fastmemo-app/releases/download/`
  (`isTrustedApkUrl`: the site relays the URL, it isn't trusted to choose it), and the native module checks the file before
  the installer opens: the same package name and the same signing certificates as the installed app (`getPackageArchiveInfo`),
  else `E_NOT_VERIFIED` and a toast. Android would refuse a wrong signature anyway, but only after the user confirmed. The
  dialog shows the APK's size (`mobile.apkSize`) before the download; a newer release seen during a download doesn't replace
  the one being downloaded. Download errors reach Sentry, the user gets a translated message.
- **OTAs for both.** The APK's fingerprint differs, so each OTA is published twice from the same code: once as before, once
  with `FASTMEMO_DISTRIBUTION=github` (Publish OTA workflow, `builds` input to finish a half-done run). `ota-guard.sh` checks
  both fingerprints: an OTA that would reach no APK is refused instead of published unseen.
- **Releases:** after the Play build, `npx eas-cli build -p android --profile production-apk` (no `package.json` script: the
  scripts are in the fingerprint, LL-071), and the APK uploaded to the GitHub release (`FastMemo-X.Y.Z.apk`).

**Alternatives rejected:**

- the browser downloads the APK (no permission, identical builds): a detour through the browser's downloads and its own "install
  unknown apps" grant, for every update;
- the permission in both builds: Play review rejects it;
- no OTAs for the APK (a new APK as the hotfix): simpler, but the two builds drift apart; the user wanted them 1:1;
- an app config flag or a config plugin writing native code: an OTA's manifest replaces the flag, and a plugin writing Kotlin
  into `android/` is fragile.

**Trade-offs:**

- each OTA is published twice (twice the upload and the workflow's time); an APK build is needed for every version, or the
  OTA guard stops;
- the Play and APK builds are signed with different keys: switching between them means uninstalling (and losing local data not
  in the cloud);
- the APK gets a new version as soon as the GitHub release is out, Play users after the review;
- a cancelled install downloads the APK again next time.

---

## ADR-032: A Local MCP Server on Desktop: a Bridge, a Private Socket, the Tools in the Page

**Status:** Accepted (2026-11-06, user decisions: desktop only; the nine tools and their defaults; locked and hidden notes out
of reach with no switch; flags only tightened; the session rule for `edit_note`; the server reachable with the window closed,
through a tray on Windows and Linux. Calls made on the user's behalf, which can be overturned: off by default, no one-click
connection, no start at login, HTML with no Markdown converter, notes synced as any other, webhooks fired, tool texts in
English)  
**Context:** While talking to an AI agent (Claude Code, Claude Desktop, Cursor, Codex) the user wants to say "save a note about
what we discussed" and find a summary in Fast Memo, with a short title and the right type and category; or "read my note X"; or
to ask how a feature works. It won't be used constantly, so the tool set stays small and safe by default, and not read-only,
which would make it useless. The notes live in the page: Redux and IndexedDB inside the webview (ADR-018). Rust can't read them,
so every call has to go through the running app.

**Decision:**

```
AI client --stdio JSON-RPC--> bridge (--mcp) --local socket--> Fast Memo (Rust) --event/command--> page (Redux + note store)
```

- **A bridge and a socket, no network port.** The client starts the app's own binary with `--mcp`, handled in `main.rs` before
  Tauri and its single-instance plugin: no window, no Dock icon, no `externalBin` on four build targets. It relays
  newline-delimited JSON-RPC; stdout carries JSON-RPC only. No TCP means web pages can't reach it (no DNS rebinding to think
  about), there's no port to clash, and who may connect is the operating system's business. It listens only while MCP is on, and
  each identifier has its own, so a test build can't reach the real app.
  - **macOS and Linux:** a Unix socket in a 0700 directory, a stale one removed at bind. Always under `$HOME` (macOS
    `~/Library/Application Support/<id>/mcp/sock`, Linux `~/.local/share/<id>/mcp/sock`), not `XDG_RUNTIME_DIR`: the official
    SDK's stdio client passes its child HOME but not that.
  - **Windows:** a named pipe only its owner can open (`D:P(A;;GA;;;OW)`), remote clients rejected,
    `FILE_FLAG_FIRST_PIPE_INSTANCE`. A new name for each start (identifier + pid + time), published in
    `%APPDATA%\<id>\mcp\pipe-name`, which the bridge reads on connect: a pipe's name stays alive while an idle client holds a
    handle, so a fixed name couldn't be created again after a restart with a bridge connected, and a name that can't be
    predicted is pointless to squat.
- **The app away is an answer, not a failure.** The bridge answers `initialize`, `server/discover` and `tools/list` from the
  definitions compiled in, so the client doesn't mark the server as failed, and every call gets "isn't reachable, check it's
  open and that MCP is on". It connects again on the next line: opening the app needs no client restart. A call lost after it
  was sent isn't sent again ("may have run: check before retrying").
- **Two protocol eras, written by hand, no SDK** (`mcp/protocol.rs`): 2026-07-28 (`server/discover`, `_meta` on every request),
  and 2025-11-25 and 2025-06-18 (`initialize`), which clients of older revisions still need. No `tools.listChanged`: a client
  can hold an old list, so a tool switched off is refused at call time.
- **The tools run in the page.** Rust owns the listener, the protocol, the switches, the session rights and the write cap; a
  call goes out as `fastmemo://mcp-request` and comes back through `mcp_reply` (`libs/mcp/bridge.web.ts`, installed in `_layout`
  like `installFlushOnExit`; the `.web` split keeps it out of the Android bundle). Rust gives up after 10 s ("isn't
  responding... may still run"). The page refuses until the store has rehydrated and the notes were read (LL-029, LL-039), and
  commits the editors' pending edits before acting (ADR-013).
- **Answered only once it's on disk.** After a write `flushNow()` runs before the success, so a quit right after can't lose the
  note. A write that couldn't be saved says what's true: the note exists, so "don't create it again", not "try again". Webhooks
  fire after the save, not before: a failed write isn't announced. They do fire, as for the app's own changes.
- **One filter: `libs/mcp/policy.ts`.** Locked and hidden are flags the UI enforces with the secret code, not encryption, so
  this is the only barrier, whatever "show hidden" says. Every tool gets at the notes through it. An id out of reach gets the
  answer of an id that doesn't exist, and a word found only in such a note matches nothing. A note created as locked answers
  "Created." with no id. Read-only notes can be read, not changed or trashed. Never exposed, with no switch: removing a lock or
  read-only, unhiding, permanent deletion, emptying the trash, import/export, settings, cloud, installing an update.
- **The switches stay out of Redux.** `mcp.json` in the app's config directory, owned by Rust, read and written through
  `mcp_get_settings` and `mcp_set_settings`: they're per device, must not sync, Rust needs them before the page loads, and the
  store's structure is left alone (NEVER #2). Missing or corrupt means off. A change applies from the next call, with no client
  restart.
- **A session is a connection.** With `edit_note` off, an agent may still edit the notes it created on this connection; with it
  on, any note the rules allow. So the tool stays listed while `create_note` or its own switch is on. The right lives in Rust's
  memory per connection and dies with it, or with an app restart, which errs on the safe side. It doesn't cover `trash_note`,
  and it's suspended rather than erased while the note is locked or read-only: checks run per call, and only the user can lift
  those flags. **Known limit:** MCP over stdio doesn't say which conversation a call belongs to. Claude Code starts one process
  per session, so this works as described there; Claude Desktop and Cursor, as far as we know, keep one process while they run,
  so the right lasts until the client closes, not the chat.
- **What an open editor sees.** `edit_note`, `set_note_flags` and `trash_note` tell it as another device's change would
  (`notifyNoteChanged` in `libs/cloud/sync.ts`, `full: true` so no toast; `useLiveNote` reloads), or its next commit would write
  the old copy, and the old flags, back. Pending typing is committed first, so it moves the revision and the agent gets the
  conflict: an edit needs the `rev` it read, and a stale one is refused with the typing kept.
  The desktop hook renders the incoming note with `flushSync` (`useNoteEditor.web.ts`), so the editors' refs (`noteRef`) hold it
  before any later message: a keystroke right after a lock would otherwise build its note from the copy before the lock and
  write `locked: false` back. Nothing in `scripts/` exercises it (no DOM in the dependencies): a hand check.
- **Tool shapes.** `false` for `readOnly` or `locked` on `create_note` just means not set (a new note has nothing to loosen);
  only `set_note_flags` refuses it. Search and read page with `offset`/`nextOffset`, one vocabulary. Kanban columns are
  `{ name, color?, cards: string[] }`: plain text is what an agent writes, the ids are the server's. `edit_note`'s title and
  category follow `create_note`'s rules (`MAX_TITLE`, newlines to spaces; a category only by exact or case-insensitive name,
  never created). Text is HTML, cleaned on arrival with `AGENT_HTML_CONFIG`: the app's `NOTE_HTML_CONFIG` (ADR-021) plus no media
  and nothing that fetches when the note opens (images, video, audio, frames, SVG, `src`/`srcset`/`poster`/`background`, inline
  `style`), so an agent can't make a note phone home; links stay. A read replaces images with a placeholder
  and returns 100,000 characters at a time; a search compares the text with images removed, not the placeholder, which the user
  never wrote; `replaceHtml` is refused for a note holding images. The writes per connection are capped at 30 a minute and 300 an
  hour (`session.rs`), so at worst 7,200 a day per connection against Firestore's 20,000 free writes (NEVER #11). That slows a
  looping agent, it doesn't bound a day by itself: the device document's fan-out isn't counted, and each new connection starts its
  count again. A refused write says which limit it hit and when to retry. The server's `instructions` say note content is data, not
  instructions, and tools carry MCP annotations.
- **The window closed** (`src-tauri/src/tray.rs`). macOS: unchanged (ADR-022). Windows and Linux, only while MCP is on and its
  "keep running" switch with it: closing hides the window and a tray icon stays, with Open and Quit (`flush_then_exit`). This
  reverses the "no tray" decision of desktop 2.0.0. With MCP off there's no tray and closing quits as before, at once when it's
  switched off; if the icon couldn't be built, closing quits too, since nothing would bring the window back.

**The hidden page, per OS.** A suspended page never answers, so this decided whether the design holds; Tauri's schema says a
hidden view may be suspended after about 5 minutes.

- **macOS: pass, with default throttling and no keep-alive.** Before the feature, a throwaway build: window hidden for 36
  minutes on an awake Mac, one round trip a minute through an event, IndexedDB and a command: no timeouts, slowest 454 ms,
  `hidden` throughout. With the feature, on the test build: window closed for 15 minutes with no calls at all, then a call on a
  bridge connected all along answered in 39 ms, one on a new bridge in 9 ms, and a write, on disk before its answer, in 52 ms.
  Not measured: a Mac that went to sleep meanwhile.
- **Windows (WebView2): pass, with no keep-alive.** The user's hand run on their desktop PC (2026-11-08, the test build of all
  of desktop 2.1.0, run 42520557700) passed the whole Windows checklist: `scripts/mcp-e2e.test.mjs` on a clean install, the tray,
  and a call after 35 minutes with the window closed answering within the 5 s bound (`--wait-minutes 35`); the exact times
  weren't recorded. So neither fallback was needed (a held Web Lock, then `SetIsVisible(true)` while hidden): they stay the
  answer if a later WebView2 suspends the page. CI on `windows-latest` also builds the pipe code and runs the `mcp::` tests,
  named pipes included (60 passed, run 42272924109).
- **Linux (WebKitGTK): untested by hand** (user decision: no Linux desktop is available, as for every desktop release so far).
  Linux is built, ships the same feature and isn't a gate for anything. The tray is unverified too: Tauri sends no click events
  there, so the icon has only its menu, and some GNOME setups, as far as we know, don't show tray icons at all. The "keep
  running" switch is the way out of that. The deb's tray dependency is `libayatana-appindicator3-1`, which Debian 12 and later
  still carry (`libappindicator3-1` is gone from Debian): CI installs `libayatana-appindicator3-dev` (`publish.yml`) so that
  tauri-cli names the ayatana package in `Depends`. It applies to every user of the deb, MCP on or off.

**With a real client** (Claude Code 2.1.319, Haiku, headless, 2026-11-06, on the test build). It negotiated 2026-07-28, so
`initialize` has been exercised only by the fake client. "Save a note about this" gave a text note with a short title and no
category; a shopping list, with no type asked for, a todo; "read my note" a search and a read; a question on the trash an answer
from `help`; an update check, on a build with no updater endpoints, the tool error saying the check failed. Asked from a folder
whose path named this project, with Bash allowed by the user's settings, the same question on the trash went to the source code
instead of `help`.

**Sync while hidden** (read in the code, not run against a cloud: connecting a test build needs typed credentials). A note
written by a tool goes into the outbox in its reducer like any other, and the engine's store subscription `kick()`s a push from
that same page (200 ms, at least 2 s after the last one): nothing waits for the window, and the page is awake, having just
answered the call. If the transport wedged, as it can while hidden (`SyncOnProvider`), the push waits: the 5-minute poll
re-opens the transport once a task has stalled for 60 s, and the window coming back resumes the engine. So at worst the note
reaches the cloud when the window returns, with no message to the user (NEVER #16); the outbox is on disk, so nothing is lost
meanwhile. **`engine.resume()` after a write isn't called:** the kick already pushes, and it isn't free: `reconnect` drops the
connection and re-attaches the listeners, and `pull` reads the vault and every device doc from the server, 1 + N reads per write
(N devices) against none. A Windows or Linux app kept in the tray costs what a hidden macOS one costs today: no new listeners or
periodic writes (NEVER #23).

**Nothing reaches mobile.** No change in `package.json`, `yarn.lock`, `app.config.ts`, `.gitignore` or `android/`, so the
fingerprint can't have moved; the tests run with `node scripts/...`, never as `package.json` scripts (LL-071).
`scripts/mcp.test.mjs` covers the filter and the tool logic, `cargo test --lib mcp::` the protocol and the socket, and
`scripts/mcp-e2e.test.mjs` is a fake client over stdio against a real test build. Any test showing or returning notes runs on a
throwaway identifier with an empty store, because the test build's store may hold real notes; that script refuses a store
holding notes it didn't make.

**Alternatives rejected:**

- HTTP on localhost: a port to clash, reachable by web pages, a token to manage;
- a sidecar binary: `externalBin` on four build targets, for what the app's own binary does before Tauri starts;
- Rust reading the notes itself, as Colloqua's `colloqua-mcp` opens its database: they're in the webview's IndexedDB;
- the switches in Redux: above;
- an owner check by FFI on a fixed Windows pipe name (`GetSecurityInfo`): more unsafe code for what a name nobody can predict
  gives;
- `backgroundThrottling: "disabled"`: fixed when the window is created and applied to everyone, including users with MCP off;
- a read-only server: it couldn't save the note this is for.

**Trade-offs:**

- it needs the app running: after a real quit or a reboot the tools say it isn't reachable, and the user opens it (no start at
  login);
- what an agent reads goes to the provider of its model: the warning sits next to the main switch;
- on Windows and Linux with MCP on, a closed window keeps the app's memory (~a browser tab), as on macOS;
- a text note's content is HTML, so an agent that writes Markdown gets it as plain text;
- the protocol is ours to keep up with, with no SDK: a new MCP revision means a change in `protocol.rs`.

## ADR-033: The Desktop Window Is an App, Not a Browser

**Status:** Accepted (2026-11-06, user decisions: the dark theme forced and the app's colour on Windows 11's title bar, Windows
10 and Linux without it; the right-click menu trimmed, the page paused while minimised on Windows and the browser's keys
blocked, as in drezimo-soundboard; `webview2-com` and `windows-core` approved on 2026-11-08. Cmd+B/I/U on macOS reported by the
user on 2026-11-08)  
**Context:** macOS already drew the title bar in the app's colour (`titleBarStyle: Transparent` over `backgroundColor`). Windows
showed a light system bar, a right click anywhere opened the browser's menu (back, reload, print, and in a text field Edge's own
items: emoji, writing assistance), Ctrl+P printed the page, Ctrl+F opened WebView2's find bar where the app had nothing to find,
and a minimised window's page went on as if on screen, WebView2 not being told. On macOS, Cmd+B did nothing in a text note:
WebKit leaves bold, italic and underline to an app's Format menu.

**Decision:**

- **Dark theme** in the window's config (`theme: "Dark"`, Windows and macOS; Linux follows the system theme).
- **Title bar colour** (`window_chrome.rs`, Windows): `DwmSetWindowAttribute(DWMWA_CAPTION_COLOR)` with `#05091A`. Windows 10
  refuses the attribute and keeps the dark theme's bar.
- **Right-click menu:** the page prevents it except over a text field or over the text the user selected
  (`useKeyboardShortcuts.web.ts`, in the window and the editors' iframes), so a read-only note can still be copied from.
  Elsewhere WebKit's menu would offer Reload, which drops the edits not yet saved. WebKit on macOS selects the word under the
  pointer before `contextmenu`, so the selection is read when the button goes down (right button, or Ctrl+click on a Mac), and
  the word it selected is dropped with the menu. On Windows, WebView2's menu keeps only cut, copy and paste
  (`ContextMenuRequested`, `window_chrome.rs`).
- **Browser keys** blocked with Cmd (Mac) or Ctrl: print, find next (also F3), save, open, zoom (+, -, =, 0), view source (U,
  outside a text field: in the editor it underlines), caret browsing (F7), and Cmd/Ctrl+F where the app has nothing to find.
  Ctrl+letters on a Mac move the caret in text fields: untouched.
- **Minimised (Windows):** `SetIsVisible(false)` on the WebView2 controller, `true` again when restored
  (`WindowEvent::Resized`). The page gets `visibilitychange`: it flushes the edits not yet written and, back on screen after a
  minute or more, the sync reconnects (`RESUME_AFTER_HIDDEN_MS`, `SyncOnProvider`: a reconnect reads the vault and the devices,
  1 + N reads, too many for every minimise; macOS's hidden window gains the same limit).
- **Cmd/Ctrl+B/I/U** done by the text editor's page (`RICH_TEXT_SCRIPT`), only while it's editable, preventing the browser's own
  so Chromium doesn't apply them a second time.

**Trade-offs:**

- `webview2-com` and `windows-core` must stay at the versions `wry` uses (Cargo.lock) when Tauri is updated, or the WebView2
  types won't match;
- a minimised page is throttled like a background tab: the local MCP server still has to answer it within its timeout (a check
  of the Windows run, ADR-032);
- the menu over selected text is still the browser's on macOS and Linux (copy, look up, share…): only Windows' is trimmed;
- on Windows, Ctrl+F used to open WebView2's find bar on screens with no find of their own (code, to-do and kanban notes, help):
  blocked as the user asked, those screens have no find now (CodeMirror's search could give code notes one);
- a restored window gets the keyboard focus back without help (the user's Windows run, 2026-11-08); if a later WebView2 loses
  it: `MoveFocus` on the controller after `SetIsVisible(true)`.

## ADR-034: On-Device AI on Desktop: llama.cpp in a Library of Its Own

**Status:** Accepted (2026-11-08, user decisions: llama.cpp inside the app through `llama-cpp-2` 0.1.161, `llama-server` as a
separate process rejected; Metal on Apple Silicon, CPU on Windows and Linux; the same three models at the same pinned files, no
bigger ones; the phone's AI menu and flow on desktop, with three adjustments; a platform where the engine can't run ships
without AI rather than with a slower build; the macOS entitlement `disable-library-validation`, in production too. Calls made on
the user's behalf, which can be overturned: the engine as a library of its own, half the cores, the desktop context sizes and
long-note parts, the 2B as the default, no GPU on Windows and Linux, Intel Macs on the CPU, a download that doesn't restart by
itself)  
**Context:** The phone has had the AI since 4.0 (ADR-004). On desktop the editors had no AI button and the settings and Help
left it out. The user wanted the same features on the computer, not bigger models: fast, with the fewest mistakes, "without
straining the PC". At most a wider context, and what a computer allows that a phone doesn't. llama.rn is a React Native module
and doesn't run in the Tauri shell, so the desktop needs an engine of its own.

**Decision:**

```
page (libs/ai/context.ts, shared with the phone)
  --> engine.web.ts / models.web.ts --Tauri commands (ai_*)--> src-tauri/src/ai/ --libloading, JSON C ABI--> fastmemo_ai (ai-engine/)
```

- **The engine is a library the app opens, never links.** `src-tauri/ai-engine/` is a crate of its own (its own workspace,
  `cdylib` named `fastmemo_ai`, `llama-cpp-2` pinned with `=0.1.161`, default features off, `metal` only on macOS aarch64, no
  OpenMP). `src-tauri/src/ai/library.rs` opens it with `libloading` at the first command that needs it (`ai_info`, `ai_load`),
  so the app and the `--mcp` bridge, which is the same executable (ADR-032), start whatever the library's state. A missing file,
  an empty one, the stub, another ABI version, a symbol absent, a system that won't load it, or an x86_64 CPU without AVX2/FMA/
  F16C all mean the same: no AI, and the app works. The page shows "AI isn't available on this computer"
  (`ai.unavailable_computer`) and no AI button. This was the user's plan B for the case that a platform can't meet the start-up
  guarantees; the cost of having it is one library file to bundle per platform.
- **A JSON C ABI.** Three functions (`fm_ai_abi_version`, `fm_ai_call`, `fm_ai_free`) in `ai-engine/src/ffi.rs`: a request
  `{"op": …}` in, `{"ok": …}` or `{"error": "…"}` out, streamed text through a callback, a stop flag the caller owns. A panic is
  caught at the boundary (`{"error":"panic"}`, the engine is built with `panic = "unwind"` where the app is `abort`), and each
  request is checked before llama.cpp sees it so that no input reaches one of its asserts. `ABI_VERSION` is 1; a stub build of
  the crate (no `llama` feature) answers 0, and `STUB_TARGETS` in `scripts/build-ai-engine.mjs` is where a platform that can't
  build the engine would go (empty today: all four builds run the real one).
- **Where the library sits.** macOS: `Contents/Frameworks` (`bundle.macOS.frameworks` in `tauri.macos.conf.json`), install name
  `@rpath/libfastmemo_ai.dylib`, ad-hoc signed by the build script. The app is ad-hoc signed with the hardened runtime, whose
  library validation refuses a library of another Team ID (an ad-hoc one has none), so `Entitlements.plist` carries
  `com.apple.security.cs.disable-library-validation`. The rest of the hardened runtime stays on; with a Developer ID certificate
  the key could go. Windows and Linux: the resources folder `ai/` (`tauri.windows.conf.json`, `tauri.linux.conf.json`).
- **The build.** `scripts/build-ai-engine.mjs` runs as the first step of `beforeBuildCommand` and `beforeDevCommand`, builds for
  `TAURI_ENV_TARGET_TRIPLE` (the host's if unset; `universal-apple-darwin` builds both and joins them with `lipo`) and puts the
  library in `src-tauri/ai-engine/dist/`. Cargo always runs from `src-tauri/ai-engine`, with `--target`: its
  `.cargo/config.toml` is read from the working directory, and `--target` keeps the rustflags off the build scripts. `build.rs`
  leaves an empty file where the library would be, so a plain `cargo build` or `cargo test` works and the app runs without AI.
  - **x86_64 needs AVX2, FMA and F16C** (rustflags): `llama-cpp-sys-2` builds ggml from the Rust target features and the default
    target has none. The app's own code stays at the baseline. `system::cpu_supported()` checks the three at run time and the
    library isn't opened otherwise.
  - **Windows needs no Visual C++ runtime:** `+crt-static`, `LLAMA_STATIC_CRT=1` and `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`.
    The first alone isn't enough (LL-073).
  - **GPU:** Metal on Apple Silicon, every layer. Intel Macs build with `GGML_METAL=OFF` and run on the CPU: on the CI's Intel
    runner Metal made the engine's test take 101 s against 4.73 s. Windows and Linux run on the CPU (user decision; Vulkan or
    CUDA depend on each card's driver, can't be tried on enough PCs, and a driver crash would close the app).
  - bindgen makes C enums `i32` under MSVC and `u32` under clang (LL-074).
- **The commands** (`src-tauri/src/ai/mod.rs`): `ai_info`, `ai_load`, `ai_tokenize`, `ai_complete` (tokens over a `Channel`),
  `ai_stop`, `ai_release`, `ai_model_files`, `ai_download`, `ai_download_cancel`, `ai_delete_files`, `ai_save_eval_report`. One
  engine call at a time: a second answers `busy` and never waits; `ai_release` and the quit stop the running call and wait
  for it (30 s and 2 s: on a CPU the stop lands between prompt batches of 512 tokens, about 5 s on the 4B). A stop sent
  right after a start is kept (counted, not a flag that the start resets), and nothing starts once the app is quitting.
  The page names a model by its bare file name; Rust knows the folder, and `ai_load` refuses a `.part`.
- **The same logic on both platforms.** `libs/ai/context.ts` keeps the prompts, sampling, grammars, guards and long-note
  handling, and reaches the engine through `engine.ts` (llama.rn) or `engine.web.ts` (the commands), and the files through
  `models.ts` (DownloadManager, ADR-028) or `models.web.ts`. What differs is `platformConstants.ts` /
  `platformConstants.web.ts`. Qwen3.5's prompt is built in Rust (`prompt.rs`; `llama-cpp-2` applies only llama.cpp's built-in
  templates, not the model's jinja), with thinking off, and a test compares it with the GGUF's own `tokenizer.chat_template`.
  Sampling is llama.cpp's common order (penalties over the last 64 tokens, top-k, top-p, min-p, temperature, pick) with the
  grammar enforced on each pick. Text is streamed in whole UTF-8 characters, and a possible start of a stop word is held back. A
  long note's rewrite runs one completion per line under the same system prompt: Qwen3.5's recurrent layers can't be trimmed
  back to a prefix, so the engine keeps a snapshot of the sequence's state after the system turn and restores it
  (`state_seq_get` / `state_seq_set`).
- **The model files** are in `app_local_data_dir()/models/` (local, not roaming: 2.7 GB must not travel with a domain profile;
  Fast Memo Test has its own folder). One model at a time, as on the phone. `ai_download` takes only Hugging Face URLs and a
  bare file name, writes `<file>.part`, resumes it with a `Range` request (or starts again if the server ignores it), and
  renames the file only after its size and its SHA-256 match. The three hashes are in `AI_MODELS`; the phone still checks only
  the size. A cancel deletes the `.part`; an interruption (network, app closed) keeps it. A download doesn't restart by itself
  at launch (call): 2.7 GB starting unasked on a metered connection would be unwelcome. A full disk reports `no_space`.
- **Threads: half the logical cores** (at least 1), for reading the prompt and for writing (`system::inference_threads`). Memory
  bandwidth limits writing more than the cores do, so it loses nothing and the PC stays usable. Measured below.
- **The desktop's constants** (`platformConstants.web.ts`): context 8192 for the 0.8B and 16384 for the 2B and 4B (the phone:
  4096 / 8192 / 8192); no `mlock`; default model the 2B (the phone: the 0.8B); `SUMMARY_PART_TOKENS` 6000 (phone 1500),
  `REWRITE_PIECE_TOKENS` 1200 (phone 600). A desktop install stored the 0.8B as its default from before the AI existed there:
  `desktopDefaultModelToStore` changes it to the 2B once (AsyncStorage key `@aiDefaultModelChecked`), only if the AI is off and
  no model file is on the computer, so an explicit choice is never overwritten (NEVER #10). `MODEL_SPEED` holds the M5's CPU
  numbers, until a computer's own completions replace them.
- **The UI.** The phone's AI menu runs on desktop with three user-chosen adjustments: the language picker and the preview are
  centered cards at most `MAX_WIDTH.dialog` (560) wide, Esc closes them (cancel), and there's no new shortcut and Enter doesn't
  apply. `supportsAI()` is true only in the Tauri shell; a plain browser keeps `ai.unavailable_web`. `useEngineSupport` asks
  `ai_info` once and the screens decide on its answer. The evaluation's report is saved by Rust (`ai_save_eval_report`, folder
  `ai-eval/` of the local data) and shared through the save dialog. The AI evaluation takes an optional fixed seed, which the
  app's actions never pass. `engine.web.ts` flushes the open note (`flushNow`, ADR-013) before each completion, since a fatal
  error in llama.cpp closes the app.
- **Resources.** The model loads when an action needs it (or `prewarmContext`), with mmap; the page's idle release (3 minutes)
  and the release when the page is hidden are the phone's code. A model loaded by a page that has since reloaded is released by
  the next `ai_load`, which carries a page id.
- **Dictation stays on the phone**, so `clean_transcript` and `transcript_to_items` never run on desktop. No AI tool in the
  local MCP server (ADR-032).

**Measured** (Apple M5, 10 cores 4P+6E, 16 GB, `ai-engine/examples/bench.rs`, 2026-11-08):

| config                | prefill tok/s | generate tok/s | max RSS  | 30-line rewrite, with / without the reuse |
| --------------------- | ------------- | -------------- | -------- | ----------------------------------------- |
| Metal 0.8B, ctx 8192  | 4945          | 163            | 0.82 GiB | 2.9 / 3.1 s                               |
| Metal 2B, ctx 16384   | 2561          | 82             | 1.54 GiB | 5.9 / 6.0 s                               |
| Metal 4B, ctx 16384   | 1045          | 39             | 2.91 GiB | 12.3 / 12.7 s                             |
| CPU, 5 threads, 0.8B  | 463           | 114            | 1.33 GiB | 5.0 / 7.6 s                               |
| CPU, 5 threads, 2B    | 225           | 59             | 2.84 GiB | 10.1 / 15.5 s                             |
| CPU, 5 threads, 4B    | 96            | 27             | 5.70 GiB | 23.1 / 37.1 s                             |
| CPU, 10 threads, 0.8B | 575           | 96             |          | about the same                            |
| CPU, 10 threads, 2B   | 311           | 53             |          | about the same                            |
| CPU, 10 threads, 4B   | 122           | 23.5           |          | about the same                            |

- **Half the threads kept.** Writing was 10-14% faster than on all the cores, reading the prompt 24-36% slower, and a rewrite
  took the same. The rule for the wider 4B context was to drop it to 8192 only if it cost over 1 GiB more: it cost 0.24 GiB on
  the CPU, so the 4B keeps 16384.
- **On the CPU the resident set is about twice the model file:** llama.cpp repacks the Q4 weights for it. That's why the 4B
  takes 5.7 GiB there, against 2.9 on Metal.
- **The AI evaluation** (27 fixtures, seed 42; desktop on Metal against the Android emulator's CPU): total 12.8 s against 191 s
  (0.8B), 19.9 s against 451 s (2B), 40.9 s against 1078 s (4B); the app's peak memory 876 MB, 1638 MB and 3394 MB. The desktop
  is deterministic (the 2B twice: 27 of 27 identical). Against Android 13, 14 and 16 of 27 outputs are byte-identical and the
  rest differ in both directions (Metal against ARM CPU arithmetic, another llama.cpp build): judged no worse.
- **The phone is unchanged:** after the split of `src/libs/ai/`, the Android test build gives the same evaluation, 27 of 27
  outputs identical to the reference taken before it, on all three models; the OTA fingerprint is the branch base's.
- **A made-up note of 21,000 tokens on the 2B:** the summary finishes in under a minute with every part read; grammar and
  translation say "too long for this model"; the app's memory 1.6 GB, no crash.
- **CI** (the engine test on the 0.8B, run 42504755203 of a test workflow): Windows x64 (NSIS), the Intel Mac and Linux (deb and
  AppImage) build, ship the library, open it from the installed app and pass. Apple Silicon was checked by hand.
- **Windows by hand** (the user's desktop PC, 2026-11-08, the test build of all of desktop 2.1.0, run 42520557700): the whole
  checklist passed (download and its resume, every action, a long note, the app with no engine library). The speeds weren't
  recorded, so `MODEL_SPEED` there is still the M5's CPU: only a long note's first time estimate, before the PC's own
  completions replace it (`getModelSpeed`). Linux is never tried by hand (as for every desktop release).

**Alternatives rejected:**

- `llama-server` as a separate process: a local HTTP port, one more executable to sign per platform, and orphans holding
  gigabytes when the app dies. Its one advantage, a crash that doesn't close the app, is the first trade-off below;
- the engine linked into the app: the app would need AVX2 to start (or per-CPU builds), and the `--mcp` bridge too;
- per-CPU libraries chosen at run time (`dynamic-backends`): replaced by one build per platform once the engine was apart;
- a build without AVX2 for older CPUs: it runs anywhere, several times slower, and the 4B would be unusable. Those PCs get "not
  available";
- a CMake build of llama.cpp of our own, or another binding: `llama-cpp-2` was approved with its dependencies;
- bigger models (7B, 9B): not what the user asked for.

**Trade-offs:**

- the engine runs in the app's process: an abort inside llama.cpp, or a driver fault on Metal, closes the app, and the release
  profile is `panic = "abort"`. Hence the flush before each completion, the checks before llama.cpp sees a request, and a
  library that catches Rust panics at its boundary. What an edit loses in such a crash is at most what the editor hadn't yet
  committed, and the flush takes that to nothing;
- no GPU on Windows and Linux, and on Intel Macs: a long note on the 4B takes minutes there;
- a CPU without AVX2, FMA and F16C (before about 2013-2015) has no AI;
- macOS loads the library only because of an entitlement that turns library validation off for the whole app; a Developer ID
  certificate would remove the need;
- a second Rust workspace with its own `Cargo.lock` and a CMake build of llama.cpp: a longer, heavier CI for every desktop
  build;
- `llama-cpp-2` is pinned exactly: updating it means checking the prompt fixture, the sampling order and the evaluation again;
- the RAM the CPU path needs is twice the model's file: on a 8 GB PC the 4B is a stretch, and the settings' RAM gate counts the
  installed memory (`ai_info`), not what is free.
