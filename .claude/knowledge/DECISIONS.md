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
versions moved. See `docs/CHANGELOG_MOBILE.md` v3.2.0.

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

**Status:** Accepted (models revised 2026-10: Qwen 2.5 -> Qwen3.5, see "Revision")  
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
- Not available on web (no-op stubs provided)
- Only one model loaded at a time (singleton context pattern)
- RAM-intensive: minimum 3GB for smallest model, 6GB for the 4B

**Revision (2026-10, `docs/AI_QWEN35_UPGRADE.md`):**

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

- The main window starts hidden (`visible: false`) and the frontend shows it once its first screen past the logo is drawn
  (`windowReady()` → `window_ready`, after Geist or 300 ms), or as the first launch's logo animation starts. Rust shows it after
  5 s anyway (a frontend that failed to load) and on a second launch. A reload doesn't show it again.
- macOS: the close button / Cmd+W hide the window after the usual flush (`fastmemo://hidden`, no exit); the Dock icon, opening
  the app again (`RunEvent::Reopen`), a second launch and the menu's commands (New Note, Settings…) show it. Cmd+Q keeps the
  held quit (ADR-015). A full screen window leaves full screen first and hides when that animation ends (LL-061).
- Windows and Linux: unchanged, closing the window quits after the flush.
- `tauri-plugin-window-state` (approved): size, position and zoom remembered; not the visibility (it would show the window
  before it's drawn) nor full screen.
- The webview keeps WebKit's default background policy: a hidden window's page is throttled/suspended (the sync engine resumes
  when it's shown again, as on a phone).

**Measured (2026-10-21, test build, release, warm):** before: window at ~0.4 s, empty, home at ~0.65 s; after: window at ~0.6 s
with home drawn. The first launch after an install/reboot takes ~2.5 s. A never-shown window boots at full speed: the page is
`hidden` but its script, IndexedDB and React run (same times with WebKit's throttling `disabled`, `throttle` or default). Of the
~0.6 s, ~0.1 s is the Rust shell and ~0.2 s the page (6.3 MB of JS to home): splitting the bundle (Sentry, PDF, Firebase,
locales, Lottie) would save tens of ms, not done.

**Alternatives rejected:** a splash window (another window to keep in sync, and the old one felt heavy); `visible: true` with a
CSS splash in `index.html` (still a flash, then a second screen); a menu bar (tray) app (not what the user asked).

**Trade-offs:** for ~0.6 s (~2.5 s cold) there's no window, only the Dock icon bouncing, as with native apps. A hidden FastMemo
keeps its memory (~a browser tab). A protected note left open is still open when the window comes back (as when minimized). Dock
Quit / logout with the window open still skip the flush (ADR-015); with it closed the flush already happened.
