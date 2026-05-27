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

---

## ADR-004: On-Device AI (llama.rn) over Cloud AI APIs

**Status:** Accepted  
**Context:** Need AI features (title generation, summarization, item suggestions) without requiring internet or external API
costs.  
**Decision:** llama.rn 0.12 with Qwen 2.5 GGUF models (0.5B to 7B parameters).  
**Rationale:**

- Complete privacy: no data leaves the device
- No API costs or rate limits
- Works offline
- Four model tiers let users choose quality vs. device capability
- GBNF grammar constrains output format (e.g., JSON arrays for suggestions)

**Trade-offs:**

- Models are large downloads (hundreds of MB to several GB)
- Generation quality varies significantly with model size
- Not available on web (no-op stubs provided)
- Only one model loaded at a time (singleton context pattern)
- RAM-intensive: minimum 3GB for smallest model, 8GB for 7B

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

**Status:** Accepted  
**Context:** Need a desktop app for macOS, Windows, and Linux.  
**Decision:** Tauri 1.x (Rust backend) wrapping the web build.  
**Rationale:**

- Tauri produces significantly smaller binaries than Electron (~10-20 MB vs ~100+ MB)
- Uses the OS native WebView (no bundled Chromium)
- Rust backend for system-level operations (file access, auto-updater)
- Shares the web build output -- no separate desktop codebase

**Trade-offs:**

- Tauri 1.x is less mature than Electron's ecosystem
- Some web APIs differ in WebView context (Tauri provides polyfills via `@tauri-apps/api`)
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

- **Crypto must be synchronous.** Note encryption runs inside Redux reducers (see LL-017), and the queue path is synchronous.
  WebCrypto is async and absent on native RN; a native AES-GCM module would not run in the Tauri WebView. So we use
  **`crypto-js`** (pure-JS, identical on iOS/Android/web/Tauri) for PBKDF2-SHA256 + AES, with secure randomness from
  `@/utils/secureRandom` (OS CSPRNG), never CryptoJS's `Math.random`-backed `WordArray.random`.
- **Authenticated by a marker, not by the cipher.** AES-CBC is unauthenticated, so a wrong key decrypts to valid-looking garbage
  ~90% of the time without throwing. `CryptNote.encrypt` prepends `CONTENT_MAGIC = "=FMV1=enc="` before AES; `tryDecryptNote`
  requires the marker, making wrong-key / foreign-DEK content reliably detectable so it is **skipped, never stored or
  re-encrypted as garbage** (see LL-024).
- **Non-destructive migration v1->v2.** Create the vault first (atomically), then sweep legacy notes: skip any note that can't
  be decrypted with the legacy key, and treat an empty legacy key as "skip" (never overwrite). See LL-023.

**Trade-offs:**

- Pure-JS PBKDF2 at 100k iters blocks the JS thread ~1-2s on unlock/setup/password-change (acceptable: not per-note, and the UI
  yields a frame so the spinner paints -- see LL-025/LL-026). Iteration count is stored in the vault doc so it can be raised
  later without breaking old vaults.
- Note **titles** and metadata (id/type/dates/category) remain plaintext for sync keying/ordering; full title encryption is a
  deferred follow-up.
- AES-CBC + an app-level marker is weaker than authenticated AES-GCM, chosen deliberately for cross-platform synchronous
  interop; the marker covers the data-loss concern, not tamper-proofing.
- Lose both password **and** recovery key => data is unrecoverable by design (true E2E).
- A new layer of screens/state (vault setup/unlock/recover/change/reset) and a pub/sub session (`vaultSession`) that all sync is
  gated on.

---
