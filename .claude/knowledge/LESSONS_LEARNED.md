# FastMemo Lessons Learned

> **Read this before starting work.** This is a living document. After every significant bug, mistake, or discovery, add an
> entry here. This is how the AI "learns" over time.

## How to Add Entries

After a bug fix, failed approach, or important discovery:

```markdown
## LL-NNN: Short title

**Date:** YYYY-MM-DD **Severity:** Critical | High | Medium | Low **Category:** Bug | Performance | Architecture | Convention |
Platform **What happened:** Brief description of the problem. **Root cause:** Why it happened. **Fix:** What was done to fix it.
**Rule:** Preventive rule for the future.
```

## Tracking and Resolution Protocol

Every LL entry that is actionable should be tracked via a GitHub issue. When an entry is turned into an issue, add a line:

```markdown
**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/NNN **Status:** Open
```

When a tracking issue is **closed** (bug fixed, refactor landed, regression prevented), the agent MUST, in the same session that
lands the fix:

1. Update the entry here: set `**Status:** Resolved` and add `**Resolved:** YYYY-MM-DD` +
   `**Resolved in:** <commit SHA or PR #>`.
2. If the fix introduces a new convention or forbids a pattern, update `.agents/knowledge/CONVENTIONS.md` accordingly.
3. If the fix changes architecture (store shape, module boundaries, persistence), update `.agents/knowledge/ARCHITECTURE.md`.
4. If the fix invalidates or supersedes a prior decision, update `.agents/knowledge/DECISIONS.md`.
5. If the fix changes a rule visible in the quick reference, update the `NEVER Do` / `ALWAYS Do` lists in `AGENTS.md`.
6. Leave the LL entry in this file even after resolution -- do not delete it. The history is the learning.

The skill `.agents/skills/github-issue-template/SKILL.md` defines the canonical issue format and the creation workflow.

---

## Known Issues (Discovered During Codebase Audit)

These are pre-existing issues found during the initial architecture analysis. They are documented here so AI agents are aware
and do not introduce similar patterns.

---

### LL-001: Bug in addNote reducer -- sort condition always truthy

**Date:** 2025-04 (discovered during audit)  
**Severity:** Medium  
**Category:** Bug  
**What happened:** In `notesSlice.ts`, the `addNote` reducer has a condition that is always truthy:

```ts
if (state.filters?.order || "desc") {  // ALWAYS true
```

The `||` operator evaluates to `"desc"` (truthy) when `state.filters?.order` is falsy, making the entire expression always
truthy.

**Root cause:** Incorrect use of `||` for defaulting + comparison. The intent was to check if the sort order is descending.

**Fix:** Should be `if ((state.filters?.order ?? "desc") === "desc") {`  
**Rule:** Always use `??` for defaults with comparison, never `||` in boolean contexts where the default is a truthy string.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/18 **Status:** Resolved **Resolved:** 2026-04-22 **Resolved
in:** PR #30

---

### LL-002: Side effects in Redux reducers

**Date:** 2025-04 (discovered during audit)  
**Severity:** High  
**Category:** Architecture  
**What happened:** Three reducers contain side effects:

- `setLanguage` calls `AsyncStorage.setItem()` and `i18n.changeLanguage()` inside the reducer
- `wipeNotes` calls `deleteCollectionInCloud()` inside the reducer
- `wipeCategories` calls `deleteCollectionInCloud()` inside the reducer

**Root cause:** Expedient implementation that avoided creating thunks for simple operations.

**Fix:** Migrated to thunks. `setLanguageThunk` now owns `AsyncStorage.setItem` and `i18n.changeLanguage`; `wipeNotesThunk` and
`wipeCategoriesThunk` own `deleteCollectionInCloud`. Reducers (`setLanguage`, `wipeNotes`, `wipeCategories`) are now pure state
mutations. Callers (`SectionItem_AppLanguage`, `SectionItem_WipeData`) dispatch the thunks.  
**Rule:** Reducers must be pure functions. Side effects belong in thunks, middleware, or useEffect.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/19 **Status:** Resolved **Resolved:** 2026-04-22 **Resolved
in:** PR #TBD

---

### LL-003: Unnecessary double-persist layer

**Date:** 2025-04 (discovered during audit)  
**Severity:** Low  
**Category:** Performance  
**What happened:** The store wraps individually-persisted slice reducers inside a root-level `persistReducer` with an empty
blacklist, creating redundant serialization work.

**Root cause:** Defensive approach to ensure persistence works reliably during initial development.

**Fix:** Still open. A first attempt (PR #114, closed unmerged) removed the outer `persistReducer` and added a one-shot
`AsyncStorage.removeItem("persist:root")` cleanup. It broke note visibility on a real device: the cleanup deleted state that was
actually being read back on boot, proving the assumption "all real data lives under per-slice keys only" was wrong for this
codebase. A correct fix requires a rehydrate audit (inspect AsyncStorage contents on an installed device to determine where each
slice's data physically ends up) and, if the outer layer is removed, a migration that copies existing data out of `persist:root`
into the per-slice keys _before_ purging.  
**Rule:** When modifying persistence layout, never assume storage contents -- verify empirically on a device with real user
data. Any "orphaned key" cleanup must be gated on first confirming the data has been migrated to its new home.

**Update (2026-10-19):** The audit was done empirically (emulator, release build, staged AsyncStorage + FS contents: real legacy
data, divergent copies, missing/truncated FS file, a `persist:root` row over Android's 2MB CursorWindow). Findings: both copies
of the notes were live -- whichever REHYDRATE landed last won -- and every edit re-serialized all notes into the `persist:root`
AsyncStorage row (2.5MB: ~4s per write, an 81s write queue while typing; past 2MB Android can't even read it back). The notes
are now **folded** out of the outer blob before the first persist (`src/libs/storage/legacyRootNotes.ts`): the blob's copy is
saved under `backup:root-notes`, merged into the notes storage (stored notes win; the copy only adds missing ids and newer
`updatedAt` versions; its outbox is ignored), then dropped from `persist:root`; a marker makes it run once. Only after that is
`notes` blacklisted from the root config (`dropLegacyRootNotes` migrate guards against a downgrade re-adding them). The outer
layer still persists `categories`/`settings` (KB-sized, deliberately kept). Still to do: verify on a **real device with real
user data** before release (LL-022 rule 1). **Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/20 **Status:**
Resolved for notes (outer layer kept for categories/settings) **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-004: No loading/error state for cloud sync thunks

**Date:** 2025-04 (discovered during audit)  
**Severity:** Medium  
**Category:** Architecture  
**What happened:** Neither `notesSlice` nor `categoriesSlice` handles `.pending` or `.rejected` thunk states. If cloud sync
fails, it fails silently -- the items remain in the outbox queue (implicit retry) but there is no user feedback.

**Root cause:** Cloud sync was added incrementally without comprehensive state management.

**Resolution (by design, not code):** After review, this was closed as `wontfix`. Silent behavior on transient failures is the
intended UX for cloud sync and the current design already covers the legitimate failure modes:

1. **Offline is not an error.** `SyncOnProvider.tsx:149,197,253` gates every sync loop on `netInfo?.isConnected`. When the
   device is offline the thunks are never dispatched -- there is nothing to "fail" and nothing to report. Reconnection
   automatically resumes the sync.
2. **Retry is automatic.** Thunks in `src/slicers/thunks/{notes,categories}.ts` only return the items whose primary + secondary
   Firestore writes both succeeded. The slice's `.fulfilled` reducer removes only those from the outbox, so non-confirmed items
   naturally stay queued and are retried on the next tick -- no error state is needed to drive retry.
3. **Real disconnections are already surfaced.** `useCloudSync.ts` handles the handshake flow with a dedicated `Handshake.Fail`
   alert (`cloudsync.handshakeFailed`), and `SyncOnProvider` emits a `disconnected` toast when the device is evicted from the
   cloud. These are the user-actionable failures; transient Firestore errors are not.
4. **Surfacing transient errors would violate the UX contract.** Showing a banner/toast for every Firestore hiccup (rate-limit,
   network blip, token refresh) would spam users who are simply offline or on flaky connections, for a system designed to be
   eventually consistent.

Adding `syncStatus`/`syncError` fields without consuming them in UI would produce dead state, grow the persisted store, and
increase maintenance cost with zero user benefit. If a specific observability need arises in the future, the correct place is
Sentry breadcrumbs around the thunk, not Redux state.

**Rule (updated):** Do **not** add user-facing loading/error indicators to cloud sync thunks. Cloud sync is silent by design.
The outbox pattern + `netInfo` gate + implicit retry is the supported mechanism for eventual consistency. Only handshake-level
failures (which imply the connection itself is invalid) are surfaced to the user.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/21 **Status:** Resolved (wontfix, by design)  
**Resolved:** 2026-04-22  
**Resolved in:** docs/issue-21-ll-004-wontfix (LESSONS_LEARNED + CONVENTIONS)

---

### LL-005: Duplicated boilerplate across note editor components

**Date:** 2025-04 (discovered during audit)  
**Severity:** Medium  
**Category:** Convention  
**What happened:** All four editor components (NoteTextEditor, NoteTodoEditor, NoteKanbanEditor, NoteCodeEditor) contain nearly
identical code:

- 4-5 webhook selector calls
- `useDispatch` + `updateNoteGlobal` callback
- `dirtyRef` tracking logic
- BackHandler registration
- Keyboard visibility tracking

**Root cause:** Each editor was built independently without extracting shared logic.

**Fix:** Extract shared logic into a `useNoteEditor` custom hook.  
**Rule:** When building a new editor component, use the shared hook pattern. Do not copy boilerplate from existing editors.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/22 **Status:** Open

---

### LL-006: Mixed import path styles (relative vs @/ alias)

**Date:** 2025-04 (discovered during audit)  
**Severity:** Low  
**Category:** Convention  
**What happened:** Several files mix `@/` alias imports with relative `../` imports in the same file. Notable offenders:
`useCloudSync.ts`, `SyncOnProvider.tsx`.

**Root cause:** Inconsistent developer habits across different development sessions.

**Fix:** Enforce `@/` alias for all cross-module imports.  
**Rule:** Never use relative imports across module boundaries. The `@/` alias covers all paths under `src/`.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/23 **Status:** Open

---

### LL-007: Selector naming inconsistency (get* vs selector*)

**Date:** 2025-04 (discovered during audit)  
**Severity:** Low  
**Category:** Convention  
**What happened:** `notesSlice` and `categoriesSlice` use `get*` prefix. `settingsSlice` mixes `get*` with `selector*` and even
`selectorWebhook_snakeCase`.

**Root cause:** Different naming conventions adopted at different development stages.

**Fix:** Standardize on `get*` prefix for new selectors.  
**Rule:** New selectors must use `get` prefix: `getLanguage`, `getCloudConnected`, `getWebhookAddTextNote`.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/24 **Status:** Open

---

### LL-008: TodoItemData interface duplicated across platform files

**Date:** 2025-04 (discovered during audit)  
**Severity:** Low  
**Category:** Convention  
**What happened:** `TodoItem.web.tsx` and `TodoItem.native.tsx` both define identical `TodoItemData` interfaces.

**Root cause:** Platform-split files were developed independently.

**Fix:** Move shared types to `@/types/` and import in both files.  
**Rule:** Shared types across platform-split files must live in `@/types/`.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/25 **Status:** Open

---

### LL-009: Italian locale has a typo in help section

**Date:** 2025-04 (discovered during audit)  
**Severity:** Low  
**Category:** Bug  
**What happened:** In `it.ts`, `help.how_create_category` section has `testo_2_1` instead of `text_2_1`. Also,
`webhooks.exporData` exists in multiple locales (typo for `exportData`).

**Root cause:** Copy-paste with manual renaming.

**Fix:** Correct the keys in the locale files.  
**Rule:** After adding translation keys, verify key names match exactly across all 7 locale files.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/26 **Status:** Open

---

### LL-010: useStore() used for direct state access bypassing React reactivity

**Date:** 2025-04 (discovered during audit)  
**Severity:** High  
**Category:** Bug  
**What happened:** In `home.tsx`, `store.getState().notes.temporaryItems` is accessed directly with `@ts-ignore`, bypassing
React's subscription model. Changes to `temporaryItems` will not trigger re-renders.

**Root cause:** Quick workaround to read state without subscribing to changes.

**Fix:** Replace with a proper `useSelector` call.  
**Rule:** Never use `store.getState()` in components. Always use `useSelector` for reactive state.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/27 **Status:** Open

---

### LL-011: Sentry DSN hardcoded in source

**Date:** 2025-04 (discovered during audit)  
**Severity:** Low  
**Category:** Convention  
**What happened:** The Sentry DSN is embedded directly in `configs/index.ts` rather than pulled from environment variables.

**Root cause:** DSNs are public-facing (not secret), so it was hardcoded for simplicity.

**Fix:** Move to `EXPO_PUBLIC_SENTRY_DSN` environment variable for per-environment flexibility.  
**Rule:** All external service identifiers should come from environment variables.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/28 **Status:** Open

---

### LL-012: AbortSignal.timeout polyfill modifies global at import time

**Date:** 2025-04 (discovered during audit)  
**Severity:** Low  
**Category:** Architecture  
**What happened:** `webhook.ts` adds a polyfill for `AbortSignal.timeout` at module-level, modifying the global `AbortSignal`
object as a side effect of importing the file.

**Root cause:** Needed for environments where `AbortSignal.timeout` is not available.

**Fix:** This is acceptable as a polyfill but should be documented. Do not add more global-modifying side effects in utility
files.  
**Rule:** Utility files must not have import-time side effects (polyfills are the only exception, and must be documented).

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/29 **Status:** Open

---

### LL-013: Explicit `.native` / `.web` suffix imports bypass Metro platform resolution

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** Medium  
**Category:** Platform  
**What happened:** Three imports reference `.native` / `.web` suffixes explicitly, bypassing Metro's automatic platform-file
resolution:

- `src/components/notes/NoteTodoEditor.tsx:27` -> `"@/components/todo/TodoItem.native"`
- `src/components/notes/NoteTodoEditor.web.tsx:3` -> `"@/components/buttons/VoiceRecognitionButton.web"`
- `src/components/notes/NoteTodoEditor.web.tsx:35` -> `"../todo/TodoItem.web"`

**Root cause:** When the developer did not see an obvious barrel/default `Component.tsx`, they imported the suffixed file
directly "to be safe". This is the wrong instinct because Metro picks the correct variant automatically when you import the
suffix-less path.

**Fix:** Always import the base name (no `.web`, no `.native`). Metro/Webpack picks the right variant at bundle time. If a
default `.tsx` is missing, consider renaming the `.native.tsx` to `.tsx` (native is the default) rather than forcing suffixed
imports.  
**Rule:** Never import a module with an explicit `.web` or `.native` suffix. Always use the suffix-less path.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/31 **Status:** Open

---

### LL-014: Runtime `require()` used as a platform switch when a file split was already available

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** Medium  
**Category:** Platform  
**What happened:** Multiple sites use dynamic `require(...)` to pick between platform-specific modules at runtime, defeating
Metro's file-based resolution. Notable cases:

- `src/libs/haptics/index.ts:3` --
  `Platform.OS === "web" ? require("./haptics.web").default : require("./haptics.native").default` even though both files
  already exist as platform variants.
- `app/settings/ai-assistant.tsx:18-21` -- `let aiLib = null; if (Platform.OS !== "web") aiLib = require("@/libs/ai")` even
  though `libs/ai/index.web.ts` already exports safe stubs for every API.
- `src/utils/toast.ts:7, 22` -- per-function `require("react-hot-toast")` / `require("react-native-root-toast")`.
- `src/hooks/useNetInfo.ts:50`, `src/hooks/useSecret.ts:45`, `src/libs/localization.ts:22`, `src/libs/firebase.ts:111`,
  `src/components/settings/items/advanced/SectionItem_ExportImportData.tsx:25-29` -- all use dynamic require behind a
  `Platform.OS === "web"` gate where a file split would be cleaner.

**Root cause:** Dynamic `require` was used as a way to avoid importing native-only packages in the web bundle. It works but has
three costs: (1) Metro statically analyzes the literal `require(".//...")` string anyway, risking bundle leaks; (2) it hides the
platform boundary inside function bodies; (3) it defeats typechecker + tree-shaking clarity.

**Fix:** Use the file-based platform split pattern (`module.ts` + `module.web.ts`, or `module.native.ts` + `module.web.ts` with
an `index.ts` barrel only when strictly needed). Consumers import the suffix-less path. Metro picks the correct file and the
other file is never bundled for the non-target platform.  
**Rule:** Never use dynamic `require(...)` to gatekeep platform-specific modules when a `.web.ts` / `.native.ts` / `.tsx` file
split is viable. Use file-based platform resolution. Dynamic `require` remains legitimate only for Metro asset imports (e.g.
`require("../assets/x.png")`) and for Tauri detection-based code paths inside an already-web file.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/117 (umbrella, consolidates former sub-issues #83, #84, #85,
#86, #87, #88, #89, #90, #91, #92, plus #93 configs/platform and #94 settings/data splits) **Status:** Resolved **Resolved:**
2026-04-24 **Resolved in:** PR #TBD

**Resolution summary:** Every site listed in the umbrella was migrated to a file-based platform split:

- `src/libs/haptics/` -- removed the runtime-`require` barrel; `index.ts` (native) + `index.web.ts` now resolve via Metro.
- `app/settings/ai-assistant.tsx` -- replaced the `aiLib = require("@/libs/ai")` dance with direct static imports; the web
  bundle uses the existing `index.web.ts` no-op stubs.
- `src/utils/toast.ts` -- split into `toast.ts` (native, `react-native-root-toast`) + `toast.web.ts` (web, `react-hot-toast`).
- `app/_layout.tsx` -- extracted `<WebToaster>` into `src/components/WebToaster.tsx` + `WebToaster.web.tsx`.
- `src/hooks/useNetInfo.ts` -- split into native (static `@react-native-community/netinfo` import) + web (`fetch` +
  `online`/`offline` listeners, Tauri-safe).
- `src/hooks/useSecret.ts` -- split into native (static `expo-local-authentication`) + web (biometrics disabled, always routes
  to the secret-code screen).
- `src/libs/localization.ts` -- split into native (`expo-localization`) + web (`navigator.languages`).
- `src/libs/firebase.ts` -- extracted `getDeviceInfo()` to `src/libs/device.ts` + `src/libs/device.web.ts`.
- `src/utils/export.ts` -- split into native (`expo-print`, `expo-sharing`, `expo-file-system`) + web (`jsPDF`, `html2canvas`,
  Tauri dialogs); pure HTML helpers moved to `src/utils/html.ts`.
- `src/components/settings/items/advanced/SectionItem_ExportImportData.tsx` -- four module-scope `require` calls replaced by the
  new `useExportImport` hook, backed by `src/libs/dataIO/index.ts` + `index.web.ts`.

No remaining dynamic `require(...)` is used as a platform gate. Tauri detection via `isTauri()` is still used, but only inside
already-web files (legitimate per the rule).

---

### LL-015: Platform.OS branching inside Redux selectors

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** Medium  
**Category:** Architecture  
**What happened:** `src/slicers/settingsSlice.ts:175` contains a `Platform.OS === "web"` branch inside the
`selectorVoiceRecognition` selector, returning a different object literal per platform. Combined with the `|| {...}` fallback
pattern, this also makes the selector unstable on web (returns a fresh object reference every call).

**Root cause:** Platform defaults were inlined in the selector instead of being defined in platform-split constants.

**Fix:** Selectors must be pure, platform-agnostic functions. Platform-specific defaults belong in a constants module with a
`.web.ts` / `.ts` split. The selector reads `state.settings.voiceRecognition ?? DEFAULT_VOICE_RECOGNITION` with a stable
module-scoped constant.  
**Rule:** Never put `Platform.OS` checks inside reducers, selectors, or thunks. Platform defaults belong in platform-split
constants imported as stable references.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/98 **Status:** Open

---

### LL-016: Factory selectors returning a new `createSelector` per call

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** High  
**Category:** Performance  
**What happened:** Four selectors are declared as factory functions `(arg) => createSelector(...)`. Called inside
`useSelector(...)`, they instantiate a new `createSelector` on every render, invalidating Reselect's memoization cache and
recomputing `.filter`/`.reduce` over the full notes array on every store update.

Sites:

- `notesSlice.ts:447` -- `getNotesFilteredPerCategory` (consumed by `home.tsx:61`).
- `notesSlice.ts:456` -- `getNotesSizePerCategory` (consumed by `OrganizeCategoryCard.tsx:43` -- once per list item).
- `notesSlice.ts:461` -- `getTrashedNotesFilteredPerCategory` (consumed by `temporary-trash.tsx:35`).
- `categoriesSlice.ts:185` -- `getUnusedCategories` (consumed by `categories/create.tsx:40`).

**Root cause:** The factory signature was introduced to pass per-render arguments (current category, show-hidden flag) into
`createSelector`. Without a keyed cache, each invocation creates a fresh selector instance.

**Fix:** Use Reselect 5 `weakMapMemoize` / `argsMemoize` or wrap the factory with a `Map<key, selector>` so the same argument
reuses the same memoized selector. Alternative: refactor to return a `Record<key, derived>` once at store level (e.g.
`selectNotesSizeByCategory` returns a `Record<iconId, number>`) and look up by key in the component.  
**Rule:** Memoized selectors must be declared at module scope with stable input arrays, not returned from factories. If a
selector needs per-key arguments, use a keyed cache to preserve selector identity across calls.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/43 **Status:** Open

---

### LL-017: CryptNote.encrypt runs inside reducers on every keystroke

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** High  
**Category:** Performance  
**What happened:** `notesSlice.ts` calls `CryptNote.encrypt(note)` in 14 reducer paths. The `addNote` reducer fires on every
keystroke in a note editor when cloud sync is enabled. For code/kanban notes, `CryptNote.encrypt` iterates every column/item/tab
and performs AES on each (O(columns \* items) ops per keystroke). CryptoJS also generates a random IV per call, so unchanged
plaintext produces a different ciphertext each time -- Firestore sees every note as "changed", wasting writes against the 20K/
day free-tier quota.

Additionally, having side-channel behavior (random IV + reading module-scope state) inside a reducer violates the pure-reducer
principle (see LL-002).

**Root cause:** Encryption was colocated with the outbox-queuing logic in the reducer for simplicity.

**Fix:** Move encryption out of reducers into a `createListenerMiddleware` that reacts to note mutations and dispatches pure
`enqueueCloudAdd` / `enqueueCloudDelete` actions with the encrypted payload. Add a content-hash cache
(`Map<noteId, { plaintextHash, ciphertext }>`) so unchanged plaintext reuses the last ciphertext.  
**Rule:** Never perform encryption, hashing, or any CPU-expensive deterministic-output operation inside a reducer. Reducers must
be pure and fast. Side effects and deterministic transformations of data belong in middleware, thunks, or selectors with
memoization.

**Update (2026-10-19):** Mitigated, not fixed: editors now commit to Redux in batches (LL-032), so `addNote` -- and the
encryption it triggers -- runs once per pause in typing (at most every 2s) instead of per keystroke. Encryption still lives in
reducers.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/47 **Status:** Open

---

### LL-018: Inline style objects on memoized list items break memoization

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** Medium  
**Category:** Performance  
**What happened:** `NoteCard.tsx:93` and `TrashedNoteCard.tsx:107` use inline `style={{ width: ... }}` objects on components
wrapped in `memo()`. A new object reference is created on every parent render, defeating the memo bailout and causing every list
item to re-render on any parent state change. Also affects `style={{ fontWeight: "600" }}` on date text in both files.

**Root cause:** The conditional width seemed too specific to the component's delete-mode state to warrant a StyleSheet entry.

**Fix:** Pre-declare the width variants in `StyleSheet.create` and apply conditionally via a stable array:
`style={[styles.base, isDeleteMode && styles.deleteMode]}`. Pre-declared style references are stable across renders.  
**Rule:** Already documented (NEVER rule #3 in AGENTS.md). This LL entry reiterates the rule after finding the exact violation
the rule warned against.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/39 **Status:** Open

---

### LL-019: FlashList passes object-literal extraData and inline renderItem

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** Medium  
**Category:** Performance  
**What happened:** Multiple FlashList consumers pass `extraData={{ isDeleteMode, ... }}` (new object each render) and inline
`renderItem` (new function each render), defeating FlashList's internal bailouts. Also miss `estimatedItemSize` and
`getItemType` which severely reduces recycling on variable-height/typed lists.

Sites: `home.tsx:388-405`, `temporary-trash.tsx:145-162`, `settings/webhooks.tsx:70-86`,
`components/lists/FavoriteCategoryList.tsx:45-64`.

**Root cause:** Developer convenience -- object literals are easy to write and the performance cost is invisible at small list
sizes.

**Fix:** Stabilize `renderItem` with `useCallback`; pass a primitive or `useMemo`d `extraData`; provide `estimatedItemSize` and
`getItemType` for typed recycling.  
**Rule:** For any `FlashList`/`FlatList`:

- `renderItem` must be `useCallback`-stable.
- `extraData` must be a primitive or a stable memoized object; never an inline literal.
- Provide `estimatedItemSize` for variable-height cards.
- Provide `getItemType` when rows render structurally different layouts (e.g. per note type).
- All handlers flowing into the row must be `useCallback`-stable.

**Update (2026-10-19):** `home.tsx` fixed: `useCallback` renderItem, `useMemo` extraData, module-level `keyExtractor` (the other
sites are still open). With 400 notes this matters most on home, which re-renders on every focus change and quick-note bar
resize.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/50 **Status:** Open (home fixed)

---

### LL-020: useEffect deps subset of captured values causes BackHandler re-subscription per keystroke

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** Medium  
**Category:** Bug  
**What happened:** All four note editors register `BackHandler.addEventListener(...)` inside
`useEffect(..., [updateNoteWebhook])`. `updateNoteWebhook` depends on the full `note` object, which changes on every keystroke.
Consequence: the effect re-runs on every character typed -- the back handler is subscribed and removed thousands of times in a
typing session.

Sites: `NoteTextEditor.tsx:211-220`, `NoteTodoEditor.tsx:262-271`, `NoteKanbanEditor.tsx:222-231`, `NoteCodeEditor.tsx:240-248`.

**Root cause:** The effect was written to always use the latest callback closure; the ref-pattern alternative was not applied.

**Fix:** Store the latest callback in a `useRef` updated via a separate effect, and subscribe the back handler once with `[]`
deps, reading from the ref. The same pattern is already correctly used for `onChangeRef` in `CodeEditorWebView.tsx:28-29`.  
**Rule:** When subscribing an imperative event listener (BackHandler, Keyboard, AppState, WebView messages, etc.), the
subscription effect must have stable deps (usually `[]`). Use a ref to read the latest version of the handler callback inside
the listener body. Never include an unstable callback as an effect dependency for subscriptions.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/51 **Status:** Open

---

### LL-021: Firestore writes are not batched (quota waste)

**Date:** 2026-04-22 (discovered during follow-up audit)  
**Severity:** Medium  
**Category:** Architecture  
**What happened:** Every cloud-sync code path loops sequential `setDoc`/`deleteDoc` calls instead of using Firestore
`writeBatch`. Additionally, `setElementInCloud` internally calls `updateLastSyncInCloud` -- so each element write becomes two
writes. For a user with 100 notes + 10 categories the initial upload costs ~220 writes (1% of the daily 20K Spark-plan quota for
one action).

Sites: `useCloudSync.ts::uploadCloudData`, `thunks/notes.ts::processNotes`, `thunks/categories.ts`,
`firebase.ts::deleteCollectionInCloud`, `firebase.ts::removeDeviceFromDevicesToSync`.

**Root cause:** Incremental feature work; batching was never adopted.

**Fix:** Use `writeBatch` (up to 500 ops/batch). Bump `lastSync` once per batch, not per element (or include it in the batch).
Document the estimated op count reduction in the PR description per CONVENTIONS.md rule #16.  
**Rule:** Already documented as NEVER #11 / CONVENTIONS rule #16 ("never waste Firestore operations"). This LL entry reiterates
the rule after finding widespread violations. Every PR touching a Firestore write path must estimate the op count delta.

**Update (2026-10-19):** Partial fix: the note/category push thunks write with `noUpdateLastSync` and bump `lastSync` once per
batch (`lastSync` is only displayed in the devices list). A synced note now costs 2 writes with other devices (note doc +
fan-out entry) instead of 4, 1 instead of 2 alone, plus 1 per batch. `writeBatch` is still not adopted.

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/49 **Status:** Open (lastSync part fixed)

---

### LL-022: Destructive cleanup based on an unverified assumption about storage layout

**Date:** 2026-04-22  
**Severity:** High  
**Category:** Bug  
**What happened:** While attempting to resolve LL-003 / issue #20, the agent removed the outer `persistReducer` in `store.ts`
and added `AsyncStorage.removeItem("persist:root")` as a one-shot cleanup on app start, reasoning that "all real data lives
under the per-slice keys `persist:root_notes` / `persist:root_categories` / `persist:root_settings`; the outer key only holds
duplicated metadata". On a real device with existing user data, this made notes disappear after the update: the deleted
`persist:root` key actually contained state that the app read back on boot.

**Root cause:** The assumption about redux-persist's nested-persistor behavior was not verified empirically. With nested
`persistReducer`s, the outer layer in this codebase stored content that was not fully duplicated under the per-slice keys, or
the per-slice REHYDRATE path did not reconstruct the UI-visible state without the root blob. The fix was shipped without
inspecting AsyncStorage on a real device to confirm where each slice's data physically ended up.

**Fix:** Reverted the change on the same branch (PR #114 closed unmerged, revert committed). Issue #20 remains open and requires
a proper rehydrate audit before any further attempt.  
**Rule:** Never ship a migration or cleanup of persisted state based on a theoretical model of "which key holds what". Before
deleting or restructuring any persisted key:

1. Inspect the storage contents on a real installed device (AsyncStorage dump, IndexedDB inspector, FS directory listing).
2. Confirm empirically which keys contain which fields and which keys are actually read during rehydrate.
3. If the new layout is a strict subset of the old one, write (and test on a device with real data) a migration that copies data
   from the old key into the new key _before_ deleting anything.
4. The cleanup step must be idempotent, side-effect-free on fresh installs, and guarded so a failure cannot leave the store in a
   half-migrated state.

Extends NEVER #10 in AGENTS.md: "never ship breaking changes to persisted data without a migration path" -- and specifically,
never trust a model over observed device state.

**Tracking issue:** (not filed; rule captured here for future reference) **Status:** Resolved **Resolved:** 2026-04-22
**Resolved in:** c014cb0

---

### LL-023: Fail-soft reads + fail-soft decrypt feeding irreversible writes = silent data loss

**Date:** 2026-05-27  
**Severity:** Critical  
**Category:** Bug  
**What happened:** While building per-vault E2E encryption (ADR-012), an audit found several paths where a _soft_ failure (a
Firestore read that errored or returned empty, or a decrypt that produced garbage) was treated as _authoritative truth_ and then
fed into an _irreversible_ write, destroying notes or categories:

- **Migration:** `migrateLegacyVault` decrypted legacy notes with the global key and overwrote them unconditionally. An empty or
  wrong legacy key destroyed note bodies, and a retry was non-idempotent (re-encrypted already-encrypted content).
- **Transient read = "absent":** a failed `readVault` was indistinguishable from "no vault yet", so a network blip could trigger
  vault _creation_ that overwrote a real vault.
- **Empty/failed cloud read wiped local:** `retrieveCloudData` dispatched `setNotes(fromSync)` / `setCategories(fromSync)` even
  when the read failed or returned 0 rows while local still had data -- `setCategories` _replaces_ local categories, so one
  transient failure wiped every user category and stripped every note's category association on the next upload.

**Root cause:** Reads and decrypts were modeled as binary (got data / got nothing) instead of tri-state (present / absent /
error), and "nothing" was allowed to drive destructive writes.

**Fix:**

- `readVault()` returns tri-state **present / absent / error**; `probeVault` propagates `error`; create/migrate proceed **only
  on proven absence**; every caller (handshake, `requestVaultAccess`, connect UI, `SyncOnProvider`) bails on `error`.
- `migrateLegacyVault` writes the vault **first** (atomic `createVaultExclusive`), then runs a **non-destructive** sweep: skip
  any note that doesn't decrypt (`tryDecryptNote`), and `if (!legacyKey) continue` so an empty key never overwrites.
- `retrieveCloudData` guards every read with `categoriesReadOk` / `notesReadOk` flags and **never** dispatches the
  replace-everything sync actions on a failed/empty read while local still holds data. Note-category reassignment is gated on
  `categoriesReadOk`.

**Rule:** Model every cloud read and every decrypt as **tri-state (present / absent / error)**, never binary. An `error` or
`empty` result must never drive a destructive or irreversible write (overwrite, replace-all, delete, re-encrypt). When in doubt,
**skip and keep local** -- a missed sync self-heals on the next tick; a wrongful overwrite is permanent. Extends NEVER #15.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-05-27 **Resolved in:** dev (per-vault E2E
work)

---

### LL-024: AES-CBC is unauthenticated -- a wrong key decrypts to valid-looking garbage instead of throwing

**Date:** 2026-05-27  
**Severity:** Critical  
**Category:** Bug  
**What happened:** The vault work assumed a wrong decryption key would throw (CryptoJS does throw "Malformed UTF-8"
_sometimes_). In reality, decrypting AES-CBC ciphertext with the wrong key yields syntactically valid UTF-8 garbage roughly 90%
of the time **without throwing**. So a device with the wrong DEK (e.g. after another device reset the vault) would
"successfully" decrypt notes into garbage and then re-upload that garbage as the new truth -- silent corruption.

**Root cause:** AES-CBC provides confidentiality but **no authentication**. There is no built-in way to tell "right key" from
"wrong key" at decrypt time. (Authenticated AES-GCM would solve this, but it is async/native-only and unusable here -- see
ADR-012.)

**Fix:** `CryptNote.encrypt` prepends an app-level auth marker `CONTENT_MAGIC = "=FMV1=enc="` to the plaintext before AES.
`tryDecryptNote` (strict) requires the marker after decrypt and returns `null` otherwise, so wrong-key / foreign-DEK content is
reliably detected and **skipped** (0 false-accepts over 500 wrong-key trials in `scripts/vault.test.mjs`). `CryptNote.decrypt`
stays lenient (strips the marker if present, else returns the raw text) so it can still read legacy pre-marker notes during
migration. The marker changed the wire format, so any DEK-encrypted notes written before the marker existed are unreadable and a
test vault from that window must be reset.

**Rule:** Never trust that a decrypt "succeeded" just because it didn't throw -- unauthenticated ciphers (AES-CBC) happily
produce garbage on the wrong key. Carry an explicit authentication marker (or use an AEAD cipher) and **verify it before
treating decrypted output as real**. Any decrypt feeding a write path must use the strict, marker-checked variant.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-05-27 **Resolved in:** dev (per-vault E2E
work)

---

### LL-025: crypto-js needs `global.crypto.getRandomValues`, absent on Hermes/RN

**Date:** 2026-05-27  
**Severity:** Critical  
**Category:** Platform  
**What happened:** Every vault operation threw `Native crypto module could not be used to get secure random number` **on the
phone**, while working fine on web/Tauri. The error came from `crypto-js` generating its internal IV/salt for AES/PBKDF2: it
looks for `global.crypto.getRandomValues`, which the browser/WebView provides but **Hermes/React Native does not**. This single
missing global was the real reason all native vault ops failed.

**Root cause:** `crypto-js` was adopted (over WebCrypto/native GCM) because note encryption must be synchronous (ADR-012), but
it silently depends on a Web Crypto global that RN's JS engine lacks.

**Fix:** Added `react-native-get-random-values@1.11.0` and imported it as the **first line** of `app/_layout.tsx` (before any
crypto-using module), which installs `global.crypto.getRandomValues` backed by the OS CSPRNG. It is a **native module**, so it
requires a dev-client rebuild (`npx expo prebuild` + rebuild) -- the same constraint as `expo-crypto`.

**Rule:** A pure-JS crypto library running on Hermes is not automatically self-contained -- it may depend on Web Crypto globals
that RN lacks. When adding such a library, install the `react-native-get-random-values` polyfill at the app entry point and
remember it is native (dev-client rebuild required). Verify crypto paths **on a device**, not just web/Tauri, because the
WebView masks this class of bug.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-05-27 **Resolved in:** dev (per-vault E2E
work)

---

### LL-026: Synchronous PBKDF2 blocks the JS thread, so a loading spinner never paints

**Date:** 2026-05-27  
**Severity:** Medium  
**Category:** Bug  
**What happened:** After tapping a vault action, the user got no visual feedback for ~1-2s, then a result. `setLoading(true)`
was called immediately before the synchronous `crypto-js` PBKDF2 (100k iters), which blocks the JS thread. React never got a
frame to render the spinner before the freeze, so the spinner appeared only _after_ the work finished (i.e. never,
perceptually).

**Root cause:** A synchronous CPU-bound operation in the same tick as a state update that is supposed to render a loading
indicator -- the render is queued behind the blocking work.

**Fix:** Added `src/utils/ui.ts` `yieldToUI()` (`new Promise(r => setTimeout(r, 50))`) and `await yieldToUI()` right after
`setLoading(true)` in all four vault submit handlers, giving React a frame to paint the spinner (a native `ActivityIndicator`,
which keeps animating on the UI thread during the freeze). Also `VaultButton` calls `Keyboard.dismiss()` on press, since the
full-screen spinner was rendering behind the open keyboard.

**Rule:** When a synchronous, CPU-bound operation (PBKDF2, large encrypt/decrypt, heavy serialization) follows a `setLoading`
state update, `await` a yield (`setTimeout(0/50)`) between them so the loading UI paints before the thread is blocked. Prefer a
native `ActivityIndicator` (animates off the JS thread) over a JS-driven animation for the spinner.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-05-27 **Resolved in:** dev (per-vault E2E
work)

---

### LL-027: Authoritative reads must bypass the Firestore client cache (getDocFromServer)

**Date:** 2026-05-27  
**Severity:** High  
**Category:** Bug  
**What happened:** After resetting encryption on device A (which overwrites the `vault` doc with a new DEK/canary), device B
sometimes did **not** show the "unlock" prompt — cross-device reset detection silently missed the change, and it kept missing it
**even across app restarts**. The user reported it as intermittent ("a volte", "pur riavviando").

**Root cause:** `readVault()` in `firebase.ts` read the vault doc with plain `getDoc()`, which can be served from Firestore's
**local persisted cache**. Device B still had the OLD vault doc cached; that cached doc matches device B's stale DEK, so
`dekMatchesVault()` returned true → "not stale" → no lock, no prompt. Because Firestore's cache is persisted to disk, the stale
read survived restarts until the cache happened to refresh. Every other authoritative read in the app already used
`getDocsFromServer`; `readVault` was the lone exception using the cache-eligible `getDoc`.

**Fix:** Switched `readVault()` to `getDocFromServer(...)`. Offline now throws → caught → returns `"error"`, which all callers
already treat as "skip" (never lock or create a vault on a non-definitive read), so there is no false lock/false create. This
makes cross-device reset/replace detection reliable both during a live session (the 10s `syncToLocal` check) and on restart (the
`SyncOnProvider` restore-effect validation).

**Rule:** Any read whose result drives a security or data-integrity decision (vault presence, DEK staleness, "has another device
changed this?") MUST use a server read (`getDocFromServer` / `getDocsFromServer`), never cache-eligible `getDoc`/`getDocs`. The
Firestore local cache is for UX latency, not for authoritative cross-device state. Treat an offline/error read as "unknown →
skip", not as a definitive answer.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-05-27 **Resolved in:** dev (per-vault E2E
work)

---

### LL-028: Legacy migration skipped every note because SECRET*KEY was empty at runtime (non-`EXPO_PUBLIC*` env stripped from the bundle)

**Date:** 2026-05-27  
**Severity:** Critical  
**Category:** Bug  
**What happened:** After migrating pre-encryption (legacy v1) cloud data to the per-vault model, the legacy notes did **not**
appear on the device — they silently vanished. Reproduced via the seed flow (inject legacy notes + delete the `vault` doc, then
migrate): `migrateLegacyVault` created the vault but re-encrypted **zero** notes, and `retrieveCloudData` then discarded them
(undecryptable under the new DEK). Worst hit: a user migrating with **no local copy** of their notes (reinstall / new phone /
fresh device) would see **all** pre-vault cloud notes disappear. The ciphertext stays in Firestore (sealed with the empty key)
but the migrate path never re-runs once the vault is "present", so the notes are effectively lost from view.

**Root cause:** Two things compounding. (1) `configs.cloud.secretKey = process.env.SECRET_KEY || ""`, but `SECRET_KEY` lacks the
`EXPO_PUBLIC_` prefix. In Expo (SDK 53) only `EXPO_PUBLIC_*` vars are inlined into the client bundle; `app.config.ts` sees the
value (it runs in Node at build time) but the app runtime does not, so `process.env.SECRET_KEY` is `undefined` → `""`. Every
pre-vault note was therefore AES-sealed with the **empty key** `""`, on all platforms, regardless of what `.env` contained. (2)
`migrateLegacyVault` had a guard `if (!legacyKey) continue;` meant to skip a "misconfigured empty key" — but on this app `""` is
the genuine and only legacy key, so the guard skipped **every real legacy note**.

**Fix:** Two coordinated changes (the empty-key guard was duplicated). (1) Removed `if (!legacyKey) continue;` in
`migrateLegacyVault` so legacy notes are read with the legacy key (`""`) and re-sealed under the new DEK. (2)
`CryptNote.decrypt` had the same flaw — `if (!key) return { ...note }` returned the ciphertext **unchanged** for an empty key,
so the migration would have re-sealed ciphertext-as-plaintext into permanent garbage; changed to `if (key == null)` (getDEK()
returns `null`, never `""`, when absent, so this cleanly distinguishes "no key" from the empty legacy key). `CryptNote.encrypt`
stays fail-closed (`if (!key) throw`) — we never encrypt with an empty key; the migration encrypts with the DEK. The
`if (tryDecryptNote(note, dek) !== null) continue;` check still protects already-migrated (marker-bearing) notes. Seed script
(`scripts/seed-legacy-vault.mjs`) and `scripts/vault.test.mjs` updated to encrypt with `""` so they reproduce production
faithfully (test section [9]).

**Rule:** Client secrets cannot live in a non-`EXPO_PUBLIC_` env var (stripped from the bundle) — and even `EXPO_PUBLIC_*` /
`extra` are embedded in plaintext, so they were never truly secret. This is exactly why the per-vault model derives keys at
runtime from a user passphrase. When reading **legacy** data, the legacy key is whatever the old build actually used **at
runtime** (here `""`), not what the `.env` said; never treat an empty legacy key as "unreadable → skip" when empty is the real
key, or you silently drop the data the migration exists to preserve.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-05-27 **Resolved in:** dev (per-vault E2E
work)

---

### LL-029: redux-persist's default 5s `timeout` rehydrates an empty state that then overwrites storage

**Date:** 2026-10-19  
**Severity:** Critical  
**Category:** Bug  
**What happened:** No config set `timeout`, so redux-persist v6 used its default of 5000ms. If reading a key takes longer (2.5MB
of notes took 0.6s on a loaded emulator; tens of MB of notes with inline images on a low-end phone, or a busy JS thread at boot,
can exceed 5s), `persistReducer` rehydrates `undefined` -- the empty initial state -- and seals itself, so the real data that
arrives later is ignored. The persistoid then writes that empty state over the stored notes on the next change: total data loss,
silently.

**Root cause:** `persistReducer` treats a timeout like "nothing stored" (`_rehydrate(undefined, err)`), and rehydrated state is
written back like any other.

**Fix:** `timeout: 0` on every persist config in `store.ts` (wait for the read however long it takes).  
**Rule:** Every `PersistConfig` must set `timeout: 0`. A slow read must never be treated as an empty one.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-030: Non-atomic file writes: a process kill mid-write truncates the notes file, and the next write erases everything

**Date:** 2026-10-19  
**Severity:** Critical  
**Category:** Bug  
**What happened:** The vendored `FSStorage` wrote `persist:root_notes` in place. A kill during the write (OOM killer, swipe from
recents, crash) leaves truncated JSON; redux-persist can't parse it, rehydrates the empty state, and its next write replaces the
file with no notes. redux-persist also issues overlapping `setItem`s for the same key without waiting.

**Root cause:** In-place writes plus no per-key ordering in the storage adapter.

**Fix:** `src/libs/storage/fsStorage.ts`: write `<file>.tmp`, then `moveAsync` over the file (atomic rename on Android; on iOS a
remove+move, where the complete `.tmp` survives an interruption); per-key operation queue that skips superseded writes;
`getItem` falls back to a complete `.tmp`, and sets an unreadable file aside as `.corrupt-<ts>` instead of returning garbage.
Verified on the emulator: 8 type-then-SIGKILL runs always left valid JSON; a truncated file + valid `.tmp` recovers the
`.tmp`.  
**Rule:** Persisted state that redux-persist rewrites wholesale must be written atomically (temp file + rename) and serialized
per key. Never trust that the previous write completed.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-031: Every keystroke re-serialized and rewrote all notes

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Performance  
**What happened:** Editors dispatched `addNote` per keystroke. With 400 notes (2.5MB), 30 typed characters caused 120
`JSON.stringify` calls of ~2.5MB (1.4s of JS), 30 FS writes and 20 AsyncStorage writes of 2.5MB (the latter queued for 81s),
with 20 JS stalls over 50ms. Right after every boot redux-persist also re-serialized and rewrote all notes, though nothing
changed.

**Root cause:** Per-keystroke commits, the double persist (LL-003), and redux-persist writing every key back after rehydrate.

**Fix:** `useNoteEditor` (`.ts` / `.web.ts`) keeps edits in local state and commits them in batches (debounce 500ms / max wait
2s on native, 300ms / 1s on web), and right away on blur, unmount, back, leaving the foreground and before any action on the
stored note (`flushNote`). The notes persist config reuses the JSON a value was rehydrated from (`serializeNotes` /
`deserializeNotes` in `store.ts`), and `FSStorage` skips the first write if it would only rewrite the bytes it just read. Result
(same 30 keystrokes): 4 big stringifies, 2 FS writes, a single 2KB AsyncStorage write; JS stalls over 50ms 20 (1.75s) -> 7-10
(0.8-1.2s), none while idle; boot to home frame 2.7-3.3s -> 1.7-2.2s. What is left is the cost of one commit (stringify and
write all notes, 100-300ms at 2.5MB), which grows with the total size of the notes, not with the edit.  
**Rule:** Never dispatch a persisted-slice update per keystroke. Editors use `setNoteAsync` (batched), and any code that acts on
the stored note (delete, detach, sync, change category, webhook) calls `flushNote()` first.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-032: JS timers don't fire while an Android app is in the background

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Platform  
**What happened:** With batched commits (LL-031), an edit that reached JS after the app was backgrounded (a late WebView
message, an AI or voice result) scheduled its commit with `setTimeout` -- which React Native doesn't run while the host is
paused (timers are driven by frame callbacks). If the OS then killed the app, the edit was lost. Reproduced by typing and
pressing HOME in the same instant: the editor message arrived ~0.5s after `onHostPause`, after the AppState flush had already
run.

**Root cause:** Debounced work assumes timers keep running; on Android they don't in the background.

**Fix:** `src/libs/flushOnExit.ts` (installed in `_layout`) flushes pending editor batches (`registerPendingFlush` /
`flushPending` in `registry.ts`) and `persistor.flush()` when the app leaves the foreground; `setNoteAsync` commits and flushes
at once (`flushNow`) when an edit arrives while the app isn't active. `flushOnExit.web.ts` does the same on `visibilitychange` /
`pagehide`, and on Tauri waits for the writes in `onCloseRequested` (max 2s).  
**Known limit:** the flush still rewrites all notes, so the batch typed just before leaving is safe only once that write lands
(0.3-1.2s at 2.5MB on the emulator, much less on real flash). A kill 1s after HOME, 0.3s after the last key, lost that last
batch in 2 of 3 runs (the rest of the note was always intact); 2s after HOME it was kept. Writing only the changed note would
close the window.  
**Rule:** Never rely on a timer for work that must complete before the process may die. Flush synchronously on background, and
treat "edit while not active" as "write now".

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-033: Cloud outbox dequeued newer versions, and fan-out queues replayed a restore as a trash

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Bug  
**What happened:** Three sync bugs, all reproduced end-to-end (Android + web on a test Firebase project):

1. Lost update: the `fulfilled` handlers removed processed ids from the outbox, including a newer version queued while the
   upload was in flight -- that edit was never uploaded.
2. A note could sit in both the local `add` and `delete` queues; both were processed.
3. Fan-out: the device doc kept the same id in `addNotes` and `deleteNotes`; receivers apply adds before deletes, so trashing
   then restoring a note before another device synced left it **in that device's trash** while it was alive everywhere else (no
   self-heal: the queues are then cleared).

**Root cause:** Queue entries keyed by id with no "latest operation wins" rule, at each of the three levels.

**Fix:** (1) `dequeueProcessed` only removes an entry if it is still the object that was uploaded
(`original(queue)[id] === note`). (2) `queueCloudAdd` / `queueCloudDelete` remove the id from the opposite queue. (3)
`exclusiveQueueEntry` (`libs/firebase.ts`) publishes the id in its queue and `deleteField()`s it from the others in the same
write (notes and categories). Old app versions still write non-exclusive queues until updated. (1) and (2) were first done for
notes only; the categories outbox got the same helpers in review (`feat/ota-pbkdf2-a11y`), plus a delete of the old icon's
document when an edit changes a category's icon (the cloud keys categories by icon).  
**Rule:** A queued sync operation must be exclusive per id at every level (local outbox, fan-out doc): the latest operation
replaces the others, never coexists with them. Never dequeue by id alone after an async upload.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-034: Barrel imports evaluate every module (heroicons cost ~100ms of boot)

**Date:** 2026-10-19  
**Severity:** Medium  
**Category:** Performance  
**What happened:** Metro doesn't tree-shake and Expo's default `inlineRequires` is off, so
`import { XIcon } from "react-native-heroicons/outline"` evaluates all ~300 icons of the barrel at startup. Measured with a
module probe on the emulator: outline 52-71ms + solid 49-80ms.

**Root cause:** Named imports from package barrels.

**Fix:** Deep imports everywhere (`import XIcon from "react-native-heroicons/outline/XIcon"`, 68 files + `constants/icons.ts`).
Also cached the `Intl.DateTimeFormat` used by `formatDateTime` (constructing one per card is expensive on Hermes).  
**Rule:** Import icons by their deep path, never from the `outline` / `solid` barrels. Check any new barrel-style dependency for
its startup cost.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-035: Composed translations break word order (and a misspelled key hid it)

**Date:** 2026-10-19  
**Severity:** Medium  
**Category:** Convention  
**What happened:** The todo progress line was built as `t("note.completed") + count + t("note.on") + total`. It read "completed
0 on 1" in English, used nonsense in Chinese ("完全的 … 上に", a Japanese word) and Japanese ("オン"), and in Spanish and German
showed English, because the key there was misspelled `completati` and i18next fell back to `en`.

**Root cause:** Translating sentence fragments forces one language's word order on all of them, and missing keys fail silently
to the fallback language.

**Fix:** One interpolated key per locale (`note.progress`, e.g. `"<hl>{{done}}</hl> of {{total}} completed"`) rendered with
`<Trans>`, the count styled through the `hl` component. Also fixed 25 Italian `a'`/`e'` accent typos.  
**Rule:** A sentence containing values is one key with interpolation (`<Trans>` when part of it is styled), never concatenated
fragments. When adding a key, add it with the **same name** to all 7 locales.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-036: Raw DOM elements in `.web.tsx` don't get react-native-web's `border-box`

**Date:** 2026-10-19  
**Severity:** Low  
**Category:** Platform  
**What happened:** The web/desktop intro carousel (Embla, raw `<div>` slides with `flex: 0 0 100%` and 20px padding) rendered
off-center: each slide was 40px wider than the viewport, and `containScroll: "trimSnaps"` aligned the first one to the left
edge. The width also came from a module-level `Dimensions.get("window")`, frozen at load on a resizable desktop window.

**Root cause:** react-native-web applies `box-sizing: border-box` to its own views only; a raw `<div>` keeps `content-box`.

**Fix:** `boxSizing: "border-box"` on the slides and `useWindowDimensions()` in the component (`app/intro.web.tsx`).  
**Rule:** Raw DOM nodes in web files set `boxSizing: "border-box"` explicitly when sized with padding. Never read window
dimensions at module scope in UI that can be resized (web/Tauri); use `useWindowDimensions()`.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/upgrade-expo-58`

---

### LL-037: An unanchored `.gitignore` rule hid a native module's source from git and EAS

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Platform  
**What happened:** The new local Expo module `modules/fastmemo-crypto` (native PBKDF2) built and worked locally, but its
`android/` and `ios/` folders never appeared in `git status`. A commit would have left them out, and EAS Build (which uploads
what git doesn't ignore) would have produced binaries without the module. Nothing would have failed: the vault falls back to the
pure-JS PBKDF2 when the module is missing, so the regression would only have shown up as a slow unlock.

**Root cause:** The CNG rules `android` and `ios` in `.gitignore` match a directory with that name at any depth, including a
module's native source folders.

**Fix:** Root-anchored `/android` and `/ios`, plus `modules/*/android/build/` for the module's Gradle output.  
**Rule:** Ignore rules for generated native projects are root-anchored. After adding native code, check
`git status --untracked-files=all` lists it. A graceful fallback can hide a missing native module: verify on a device that the
native path runs (e.g. per-thread CPU time), not only that the feature works.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/ota-pbkdf2-a11y`

---

### LL-038: A JS close-requested listener left desktop windows impossible to close

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Platform  
**What happened:** To flush pending note edits before the desktop window closes (ADR-013), `flushOnExit.web.ts` registered
`appWindow.onCloseRequested`. Caught in review before release: with it, the window's X button and Alt+F4 flushed the notes but
left the window open. On Windows/Linux there was no other normal way to quit.

**Root cause:** Tauri 1 cancels the close itself as soon as a JS close-requested listener exists (`manager.rs`
`api.prevent_close()`), and the JS API closes the window again after the handler resolves with `appWindow.close()`. That call
needs the `window > close` allowlist entry (and the `window-close` Cargo feature); without it, it rejects (`ApiNotAllowlisted`)
unhandled, in the background.

**Fix:** `"window": { "close": true }` in the allowlist, `window-close` in the `tauri` features.  
**Rule:** Registering `onCloseRequested` makes JS responsible for closing the window: grant the permission that close needs
(Tauri 2: `core:window:allow-destroy`) and test that the X button still closes it. Since Tauri 2 (ADR-015) the app has no JS
close listener: the Rust shell holds the quit and the frontend only flushes.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/ota-pbkdf2-a11y`

---

### LL-039: A storage read that throws wipes the notes, like a timed-out one

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Bug  
**What happened:** Found in review, never observed: LL-029 closed the timeout path, but a read that _throws_ (an I/O error, an
out-of-memory error reading a huge notes file on a low-RAM phone, IndexedDB's "connection lost" in WebKit) took the same route.
redux-persist rehydrated the empty initial state and its persistoid wrote it straight back over every stored note. Separately, a
one-off read error on the legacy root blob passed for "no legacy copy": the fold was marked done and the blob rewritten without
its notes (LL-022), with no backup.

**Root cause:** redux-persist treats every failed read as "nothing stored" (`_rehydrate(undefined, err)`), then persists
whatever state results.

**Fix:** `store.ts` wraps the notes storage: once a read (or `deserialize`, or the AsyncStorage migration read) fails, writes of
the notes are dropped for the rest of the session and the next launch reads them again. `fsStorage` treats only a `SyntaxError`
as a broken file (anything else is a failed read, not a reason to set the file aside). `foldLegacyRootNotes` retries the blob
read before giving it up as unreadable (a row past Android's 2MB cursor window fails every time).  
**Rule:** A failed read is "unknown", never "empty" (same as LL-023 for the cloud): after one, don't write over what couldn't be
read.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/ota-pbkdf2-a11y`

---

### LL-040: Last-writer-wins sync without revisions lost edits silently

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Bug  
**What happened:** Found in review (ADR-016), each a silent data loss: a receiver cleared a sender's fan-out queue with a
read-modify-write, dropping a change the sender queued in between; an incoming copy overwrote a local edit not yet pushed, and
the two devices then kept different versions for good; the connect/unlock full sync uploaded every note and then _replaced_ the
local notes with the cloud set, so a note whose upload failed (e.g. over 1 MiB) vanished and an offline device's stale copies
overwrote newer ones; with a third device offline, its pending queue entries were replayed to the others on every push and
brought trashed notes back; a long-offline device let its sender's queue doc grow past Firestore's 1 MiB limit, wedging that
sender's uploads.

**Root cause:** No notion of versions: every write was "the latest" by arrival order, and the shared queues were acknowledged
without checking what had been applied.

**Fix:** Revisions on every synced change (`rev`, `syncedRev`, `deletedAt`, tombstones) and a pure merge
(`libs/cloud/merge.ts`): stale versions are ignored, concurrent changes keep both versions (conflict copy), a deletion applies
only when newer. Acks are transactions over a content token; pushes refuse to overwrite a newer cloud version; the full sync
reconciles instead of replacing; queued entries degrade to references, then to a full-sync marker, before the doc limit.  
**Rule:** A sync write must say which version it's based on, and a sync read must be compared, not just applied. Never replace a
local set with a remote one: merge per item, and never drop on absence.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/sync-backend`

---

### LL-041: A new fan-out entry shape must fail old apps' decryption

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Bug  
**What happened:** Caught before release: the first reference entry (`{ id, rev, ref: true }`, queued when a note doesn't fit
the sender's doc) had no `type`/`text`. The released 3.2.0 `tryDecryptNote` decrypts only the fields a note type has, found
nothing to check, and returned the entry as a valid note: 3.2.0 would have stored a note without category or content (the note
list reads `category.index`).

**Root cause:** `tryDecryptNote` proves the key only through the fields it decrypts; an entry with none of them passes.

**Fix:** References carry `type: "text"` and a `text` that decrypts with no key, so every version's marker check rejects and
skips them (tested against the real `crypt.ts` in `scripts/sync.test.mjs`).  
**Rule:** Anything new put in a queue that older versions read as notes must fail their `tryDecryptNote`. Check new wire shapes
against the code of the oldest version still installed.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/sync-backend`

---

### LL-042: An undefined field made Firestore refuse a note for good

**Date:** 2026-10-19  
**Severity:** High  
**Category:** Bug  
**What happened:** Caught in a two-browser test before release: an edit of a synced note made in its open editor never left the
device, so the other device's open editor never updated. `addNote` copied the store's `syncedRev`/`local` onto the editor's copy
as explicit keys, so every note that isn't device-only got `local: undefined`. Firestore refuses an undefined field value as
`invalid-argument`, which the push treats as permanent (like a note over the size limit): the note was skipped until the next
app start. The unit tests passed because the in-memory backend clones through JSON, which drops undefined.

**Root cause:** Firestore rejects undefined values by default, while JSON (the persisted state, the test fake) silently drops
them: the bad note only existed in memory, between an edit and the next restart, and no test exercised the real write path with
it.

**Fix:** `initializeFirestore(..., { ignoreUndefinedProperties: true })`, so an undefined field is dropped as JSON would, and
`addNote` writes no undefined keys. The `CloudBackend` contract states that an undefined field is never a reason to reject.
Covered against real Firestore in `scripts/sync-firestore.test.mjs`, and in `scripts/sync.test.mjs`.  
**Rule:** A test double must refuse what the real backend refuses, or the case needs a test against the real one. A "permanent"
rejection is only for what the data itself can never fix (size): anything the app produced is a bug to fix at the source.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-19 **Resolved in:** branch
`feat/sync-backend`

---

### LL-043: A Firestore document hit the index-entry limit long before 1 MiB

**Date:** 2026-10-20  
**Severity:** High  
**Category:** Bug  
**What happened:** Found in the phase 3 review: the fan-out queues on a sender's device doc were budgeted by size only (~900
KB). Firestore also caps a document at 40,000 index entries, and every field of every map in it counts: a queued note is ~50
entries, a reference or deletion stub ~12. A few hundred queued notes (an offline device, a bulk change) stayed far under the
size budget and made every push of that device fail with a non-retryable error; the split that isolates a bad entry then blamed
each entry in turn, so the outbox stalled until the next launch, and again after it.

**Root cause:** The limits model knew one Firestore limit out of two, and the in-memory fake enforced neither.

**Fix:** `planFanout` budgets bytes and index entries (full notes 600 KB / 20k, references 900 KB / 30k, stubs 1 MB / 36k). Past
the budget the queues start over with the current push and the devices that hadn't pulled them get `fullSyncDue` (one full sync
each); deletions also write `tombstones/{id}` so that full sync can tell a deletion from a lost note. An entry refused alone is
retried without queueing before it's rejected. Covered against real Firestore (`scripts/sync-firestore.test.mjs`) and in the
fake, which now has a queue limit (`maxQueuedEntries`).  
**Rule:** Size anything that accumulates in one Firestore document by bytes **and** index entries, and give it a way to start
over that doesn't depend on the full document being writable.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/sync-backend`

---

### LL-044: A refused deletion looped pushes, each one waking every device

**Date:** 2026-10-20  
**Severity:** High  
**Category:** Performance  
**What happened:** Found in the phase 3 review. A deletion the cloud refused (another device had edited the note since) came
back as `superseded`, the merge restored the note but left the deletion queued, and the next push sent it again. Every push also
wrote the sender's device doc even when the cloud took nothing, and that write reached every listener, the sender's included:
its snapshot kicked a new push straight away, past the retry backoff. Result: a push loop costing a read on every device per
round, for as long as the app stayed open.

**Root cause:** Three small choices that were each harmless alone: a refused operation that stayed queued, a write made "for
bookkeeping" (`lastSync`) on a document others listen to, and a retry path (snapshot -> kick) that didn't go through the
backoff.

**Fix:** A newer version restored by the merge drops the deletion still queued for it; a push that applies nothing writes
nothing; a snapshot kicks a push only when no retry is scheduled; pushes go out at most every 2 s and acks wait for the sender
to be quiet (5 s, at most 30 s). The cost tests in `scripts/sync.test.mjs` count pushes, acks and device-doc writes.  
**Rule:** Never write a document others listen to when nothing changed, and route every retry through the backoff, whatever
wakes it.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/sync-backend`

---

### LL-045: Changes from an older app version looked like no change at all

**Date:** 2026-10-20  
**Severity:** High  
**Category:** Bug  
**What happened:** Found in the phase 3 review. 3.2.0 / 1.2.0 don't know revisions: they change flags or the category, or
restore from the trash, without a new `rev`, and their notes have none at all. The merge treated "same revision" as "already
have it", so those changes never reached updated devices; a note with no revision had no base, so the first edit made on an
updated device was pushed as if the cloud had never had it; and uploads left in the outbox by the older version had no revision
to be guarded with.

**Root cause:** The merge was tested with data written by the new app only. Revisions were designed as the whole truth, but for
notes an older version touched they're missing or stale.

**Fix:** The same revision with other content is a change: the cloud's version wins and an unsynced local change becomes the
copy; the push guard refuses an equal revision so the merge settles it. A note without a revision has its own version as base
(`baseOf`), recorded by its first change, and `adoptLegacyOutbox` stamps the uploads an older version left. Remaining limits (a
restore older than a deletion is undone) are in ADR-016.  
**Rule:** Test compatibility with fixtures written the way the old app writes them (no `rev`, unstamped changes, its outbox),
not only with the new app's data.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/sync-backend`

---

### LL-046: A change the editor sent before a live reload overwrote the reload

**Date:** 2026-10-20  
**Severity:** Medium  
**Category:** Bug  
**What happened:** Found in the review of live editing. The rich text and CodeMirror editors run in a WebView and report changes
asynchronously. A change message computed on the old content, still in flight when a remote version was loaded, arrived after
the reload and was taken as the user's edit: the remote change was silently reverted, then pushed back as newer. The same window
existed between the merge and the open editor being told, while the merge waited for the disk write.

**Root cause:** Messages across an async boundary carried no notion of which content they were computed on.

**Fix:** Every reload carries a sequence (CodeMirror `doc`; rich text echoes a `FASTMEMO_RELOAD_SHOWN` marker) and a change from
before the latest reload is dropped; the engine tells the open editor before persisting.  
**Rule:** Tag messages that cross an async boundary (WebView, worker, native module) with the version they were computed on, and
drop the stale ones.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/sync-backend`

---

### LL-047: The sync tests passed against a fake that was kinder than Firestore

**Date:** 2026-10-20  
**Severity:** Medium  
**Category:** Convention  
**What happened:** Most of the phase 3 review findings had a passing test next to them. The in-memory backend accepted what
Firestore refuses or does differently: no index-entry limit (LL-043), equal revisions applied, a merge-write that re-created a
removed device's doc (a "ghost" with no `uuid` that became a recipient nobody would ever ack for), recipients only ever added.
Mutation runs on the engine and merge also left guards that no test noticed being removed.

**Root cause:** The fake was written from the contract as intended, not from Firestore's behavior, and nothing checked that the
tests fail when a guard goes.

**Fix:** The fake now refuses and limits what Firestore does, and each behavior the engine relies on has a twin case against
real Firestore in `scripts/sync-firestore.test.mjs`; device updates use `updateDoc` and docs without a `uuid` are ignored; the
surviving mutants got tests.  
**Rule:** Every backend behavior the engine depends on is tested against the real backend once; a guard without a test that
fails when it's removed isn't tested.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/sync-backend`

---

### LL-048: Firebase was assumed outside the backend: a config limit and "not Google"

**Date:** 2026-10-20  
**Severity:** Low  
**Category:** Architecture  
**What happened:** With a FastMemo server allowing 10 devices, the devices screen said "2/3": it read Firebase's limit from
`configs.cloud.deviceLimit`. After a restart it would have shown the default even once fixed, because the server backend learned
its limit only in the connect handshake. The vault setup, the cloud screen, the intro and the help told server users that "not
Google" could read their notes and that their data lived "in your Firebase".

**Root cause:** Code and copy written when Firebase was the only cloud; the backend split (ADR-016) moved the I/O, not the
assumptions around it.

**Fix:** The screen asks `cloud.deviceLimit`; `GET /v1/devices` carries `maxDevices` and the server backend takes it; the texts
name both clouds or neither, in all 7 languages. Found by the two-device E2E through the app's screens, not by the adapter
tests.  
**Rule:** Above `CloudBackend`, nothing names a provider: per-cloud values come from `cloud`, per-cloud data is keyed by
`cloudScope`, texts stay neutral (CONVENTIONS #34).

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/self-hosted-server`

---

### LL-049: A restored backup could have made the server tell a device "nothing new" over new changes

**Date:** 2026-10-20  
**Severity:** Medium  
**Category:** Bug  
**What happened:** Writing the README's restore steps showed that the feed's page id (`cursor.lastSeq.count`) can repeat with
other content once a backup is restored: the seq counter goes back, other devices write again, and the same range gets the same
id. A device still holding the old page would have sent its id and been answered `{ same: true }`, skipping the new changes
until something else changed.

**Root cause:** The id is unique only while the counter only grows, which a restore breaks.

**Fix:** Page ids start with the server's boot id (a restore needs a restart), so a page from before never matches; a test
restarts a server on the same database and checks it. Each device gets its page in full once after a restart.  
**Rule:** An id a client caches across server restarts must not be derived from counters a restore rewinds alone.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** fastmemo-server
`dev`

---

### LL-050: Saving the cloud settings while connected made the device remove itself

**Date:** 2026-10-20  
**Severity:** High  
**Category:** Bug  
**What happened:** The code review of the server backend found that **Edit → Save** on a connected device ran the whole connect
flow again while the engine ran: re-init, vault screen, `registerDevice`. On a FastMemo server the new registration replaces the
token, so the long poll still in flight with the old one came back `401 device_unknown`; the backend took that for "removed
elsewhere", deleted the token from secure storage (the **new** one, just written) and the engine disconnected. A token that
couldn't be read at launch (a keystore hiccup) was treated the same way. Saving with another server's address left the old one's
registration and cached key behind. A request waiting for the token when the connection moved to another server could go out to
the old address with the new server's key.

**Root cause:** "No token" and "the server refused a token" were both read as "removed", without checking which token was
refused or whether the read had failed; and the edit path predates there being more than one cloud.

**Fix:** The edit path checks the new settings first on a connection of their own (`cloud.check`: a throwaway Firebase app, or a
second `ServerBackend`), so a typo leaves the device connected as it was. Then the same cloud only takes the new credentials
(engine stopped and idle, re-init, started again: no re-registration, no vault flow), and another cloud is left first, as
turning sync off does (unregister, forget the key, dispose, each step bounded by a timeout), then connected as usual.
`SyncEngine.stop()` now fences the task still running (`outlived`): it no longer reports a removal or a stale vault, pushes or
acknowledges on what may be another connection; `idle()` waits for it. The server backend keeps the token tri-state (read / not
stored / unreadable, read again), treats `device_unknown` as removal only for the token it holds and not during a registration,
serializes token writes, and drops a request whose connection changed while it waited. Verified through the web app (save
unchanged, wrong key, an unreachable server, a real switch) and in the sync suites.  
**Rule:** A removal is the server refusing the credential the device holds now, never a failed local read or a refusal of a
replaced credential (LL-023's tri-state, for tokens). Changing settings on a connected device must not re-enroll it, and new
settings are proven on the side before the working connection is touched. A task that outlives `stop()` must not act.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/self-hosted-server`

---

### LL-051: An oversized push got a broken connection instead of the 413, and was retried forever

**Date:** 2026-10-20  
**Severity:** High  
**Category:** Bug  
**What happened:** The push splits a request the server refuses with `413` until the oversized note is alone, then drops it. The
integration test started failing at random: the server answered `413` as soon as it read `Content-Length` and closed the
connection while the client was still uploading, so the client saw `EPIPE` ("fetch failed"), took it for a network error and
retried the same request forever: one big note would block the whole outbox.

**Root cause:** Answering before reading the body. Whether the client sees the answer depends on buffer sizes and timing.

**Fix:** The server reads an oversized body to its end (up to 4 × the limit, dropping it) before answering; a server test
uploads 1.5 MB to a 512 KB limit and fails without the fix. The client also halves its push and page sizes after a timeout (a
slow link), so a request too big for the link gets through smaller.  
**Rule:** An HTTP error the client must act on (413) has to be readable: drain the request first. Don't let "no answer" and "the
answer is no" share a retry path.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** fastmemo-server
`dev`, branch `feat/self-hosted-server`

---

### LL-052: A percent-encoded file name given to expo-file-system's `File` names another file

**Date:** 2026-10-20  
**Severity:** Critical (caught before release)  
**Category:** Bug  
**What happened:** The note store (ADR-018) found the previous notes file with
`new File(Paths.document, "reduxPersist", "persist%3Aroot_notes")`, the name fsStorage used. Reading expo-file-system before the
device test showed `Paths.join` encodes every segment after the first (`%` -> `%25`): the native side would have looked for
`persist%3Aroot_notes` while the file on disk is `persist:root_notes` (fsStorage put `%3A` in a URI, which the legacy API
decoded). The migration would have found no notes, and its first write would have stored an empty note list. The unit tests had
passed: the fake file system didn't encode segments.

**Root cause:** Assuming a path segment is used as given. With the new API it's encoded, then the URI is decoded once.

**Fix:** The legacy file is named as it is on disk (`persist:root_notes`); the note store's own names are escaped to characters
neither step touches (`[A-Za-z0-9-_.!~*'()]`, `_` standing for `%`). `scripts/_expo-file-system-fake.js` now encodes segments as
`Paths.join` does, and fails the migration tests with the old name. Verified on Android: an update over the old file migrated
every note.  
**Rule:** A name given to `File`/`Directory` must be the file's real name, with no `%`; check where an existing file really is
(`run-as ... ls`) before code reads it, and make test doubles encode and decode like the library.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/per-note-storage`  
**Update (2026-10-20):** the device backend now uses the legacy API (asynchronous, LL-053); its URIs are decoded once, so the
same rule holds: no `%` in a note store name, and the legacy file is addressed as fsStorage does (`encodeURIComponent(key)`).
The fake is `scripts/_expo-file-system-legacy-fake.js`.

---

### LL-053: A store that remembers what it wrote trusted it with another writer, and a skipped write resolved at once

**Date:** 2026-10-20  
**Severity:** High (caught in review, before release)  
**Category:** Bug  
**What happened:** Two reviews of the note store (ADR-018) found:

- **Two browser tabs lost a note.** Each tab kept a map of the entries it had written, to skip unchanged ones. Tab 2 trashed a
  note (wrote `t:W`, the `state` value, removed `n:W`); tab 1, stale, then saved anything: its `state` value still listed `n:W`,
  which its map said was stored. At the next launch the note was in neither list. With the single value, the stale tab rewrote
  everything, so this was new.
- **A flush resolved before the notes were stored.** A write superseded while it waited was skipped and resolved at once;
  `persistor.flush()` hands back exactly that promise, so the sync engine could ack a change before it was on disk, and the
  skipped write's success cleared the "last write failed" flag.
- **The device writes blocked the JS thread**: the synchronous file API took ~5 ms per file, 1.9 s for a migration of 400 notes,
  the app frozen meanwhile; and its `moveSync` with `overwrite` deletes the target before renaming (not atomic).
- A third review found two more tab cases: a save that failed before its `state` value, then another tab's launch cleanup, lost
  a new note (the failing tab still trusted its map); and a tab with nothing of its own to save put its older view over another
  tab's save.

**Root cause:** A cache of "what's stored" is only true while nothing else writes; "skip what's superseded" dropped the outcome
the caller was waiting for; a per-file API cost multiplied by the number of notes.  
**Fix:** Web Locks around reads and writes; a write that finds a `state` value it didn't write, or follows a failed one,
rewrites every entry that value doesn't list, and with nothing of its own doesn't write. A skipped write settles with the next
write that runs. The device backend uses the legacy asynchronous API (`writeAsStringAsync` + `moveAsync`, an atomic rename), 8
writes and 32 reads at a time: on the emulator the migration of 400 notes takes 607 ms with the JS thread never blocked over 113
ms; on a Pixel 10 Pro 231 ms, and a launch reads them in ~120 ms. Tests run the web backend with tabs, and a held backend with a
flush in flight.  
**Rule:** A cache of what's stored holds only while this is the only writer: where storage is shared (tabs), check what's there
before trusting it, under a lock. A write skipped for a newer one settles with that one, never at once. Time a per-item storage
call on a device before multiplying it by every note.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/per-note-storage`

---

### LL-054: A copy kept "just in case" outlived "Wipe data" and could come back

**Date:** 2026-10-20  
**Severity:** High (caught in review, before release)  
**Category:** Bug  
**What happened:** The note store's migration keeps the previous single value for a rollback. "Wipe data" emptied only the note
store: the old value (a full plaintext copy), its spare, the root fold's backup and the values set aside all stayed on the
device. Worse, "no `state` value and no entries" meant "not migrated": after a wipe (or deleting every note), a lost `state`
value brought every old note back. The rebuild of a lost `state` value folded the old notes in before taking the tombstones (a
note deleted for good came back), took the old deletion queues (sent again), and recorded no stamp (folded again next launch).

**Root cause:** Whether data was migrated was inferred from the absence of data, and the delete paths were written before the
copy existed.  
**Fix:** A `migrated` marker (the legacy notes taken into account, with their revisions), written after the first `state` value
(so it means the migration finished), made again when lost or cut, and taking in the notes of every fold; a fold brings a
missing note back only if the marker doesn't hold it at that revision. "Wipe data" removes every copy
(`noteStore.removeCopies()`) and the wiped notes' queued uploads; 14 days after the migration all those copies go, once a write
has stored what the launch folded from them. The web records a stamp too (length and hash), so an older tab still open across a
deploy has its saves folded in. The rebuild takes tombstones first, old queues only for an unfinished migration, and records the
stamp.  
**Rule:** Every copy kept "just in case" is data the user can't see: each delete and wipe path must reach it, and it needs an
end date. Record that a migration happened; never infer it from data being absent.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/per-note-storage`

### LL-055: An AI cancel sent while the model loaded was lost, and a cut-off answer counted as an answer

**Date:** 2026-10-20  
**Severity:** High (caught in review, before release)  
**Category:** Bug  
**What happened:** With the model pre-warmed when the AI menu opens, a tap on an action followed by Cancel during the load did
nothing: `cancelCommand` had no context to stop yet, and llama.rn resets its interrupt flag when a completion starts, so even a
stop sent just before that was dropped. The completion then ran to its token limit (minutes on the 4B) and every other action
failed "Context is busy". Leaving the note mid-action could also apply the stopped answer (half a JSON list of items appended to
the note), and a rewrite cut by `n_predict` passed the length guard, replacing a whole note or dictation with its first part.

**Root cause:** Cancelling was a call into the native completion instead of a state every step of the run checks, nothing
serialized completions on the one context, and the result flags (`interrupted`, `stopped_limit`, `truncated`) were ignored.  
**Fix:** A cancel generation taken when the action is called and checked after the queue, after the load and at every token;
completions queued in `whileBusy`; interrupted answers return `cancelled`, token-limited ones `too_long`; a rewrite's
`n_predict` is sized from its input's tokens; unmounting advances the run number before cancelling.  
**Rule:** A cancel must hold across the whole run (queue, load, generation), not only the native call. An answer that stopped
early is never applied.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-20 **Resolved in:** branch
`feat/ai-qwen35`

### LL-056: After updating from 3.2.0, the next edit from another device made a "(conflict)" copy of an unchanged note

**Date:** 2026-10-21  
**Severity:** High (found in the E2E cloud test, before release; no data lost)  
**Category:** Bug  
**What happened:** On the Pixel, 3.2.0 was connected to a vault shared with devices on the new version, then updated in place.
The first edit made on the web to a note the phone had received from a new device came in as the note, plus a "P1 ...
(conflitto)" copy of the version the phone had never touched.

**Root cause:** 3.2.0 stores a note it receives as it is: with the `rev` a newer version stamped, and no `syncedRev`. The merge
reads "a `rev` and no `syncedRev`" as "stamped here, never synced", so every such note counted as an unsynced change, and the
next newer version from the cloud kept it as a conflict copy. The unit tests modelled older versions' notes without a `rev`
(only `updatedAt`), never as a newer device's note received by an older version.

**Fix:** The notes' persist config has `version: 1`. Its migration, run only for state an older version stored (-1,
redux-persist's default), records such a note's `rev` as synced (`adoptLegacySyncState` in `libs/cloud/revision.ts`). That
covers the legacy single value the note store migrates from, AsyncStorage on native, and the web. One edited on 3.2.0 keeps
`updatedAt > rev`, so it still counts as changed. A failure leaves the state as it was, because a rejected migrate rehydrates
empty state over the notes. Verified on a real 3.2.0 → fixed update on the web (same origin, real Firestore) and on the Pixel:
after the update, edits from other devices arrive with no copy.

A review of the fix found more, and the branch fixes it:

- A 3.2.0 change still waiting to go out, made without renewing `updatedAt` (a flag, the category, a restore), went out as the
  cloud's own revision. It was refused as the version the cloud already has and became a conflict copy, so the flag never
  reached the cloud. This was already the case before, because `adoptLegacyOutbox` only stamps notes without a `rev`. Such a
  note now gets the received `rev` as its base and a revision of its own on top, so it goes through.
- When the note store rebuilds a lost `state` value, it copies the legacy settings, and that included the legacy `_persist: -1`.
  The migration would then have run again over this version's notes. The rebuild now leaves `_persist` out, and a state with no
  version is not migrated.

Accepted, in the safe direction or as for every note an older version wrote:

- A 3.2.0 change made with no upload waiting (vault locked, not connected) that didn't renew `updatedAt` isn't seen as a change,
  so the next newer version replaces it.
- Notes an older tab writes into the legacy value after the migration are folded in without being taken over. A later version of
  one of them can still make a conflict copy, but nothing is lost.
- Internal builds since the sync engine stored version -1 too, so they go through the migration once.

**Rule:** A change in what a persisted field means needs a versioned migration, never a guess at read time. Test older versions'
data as they really store it, including the fields a newer version wrote that they keep without understanding.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`fix/sync-legacy-synced-rev`

### LL-057: After a page refresh, creating a category left the web app on the splash logo

**Date:** 2026-10-21  
**Severity:** Medium (web/desktop; found in the E2E test, present since 3.2.0)  
**Category:** Bug  
**What happened:** The bug needed a page load on a route other than `/`: a browser refresh on `/home`, or a link. After that,
saving a new category showed only the splash logo on `/`. Only a reload brought the app back.

**Root cause:** The root stack's anchor (`unstable_settings.anchor: "index"`) puts the index screen under the loaded route. The
index screen sends the app to `/home` only from its mount effect. Saving a category calls `router.dismissAll()`, which pops to
that index screen. It was already mounted, so nothing sent it on.

**Fix:** Once it has sent the app to `/home`, the index screen does it again whenever it regains focus (`useFocusEffect`, both
`app/index.tsx` and `app/index.web.tsx`). This covers every way back to the root, not only `dismissAll`.

**Rule:** A screen that only redirects must redirect on focus, not only on mount. The stack can return to it.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`fix/splash-dismiss-all`

### LL-058: AI rewrites removed quotes and labels the user wrote, and a bold "Summary" line would have been replaced

**Date:** 2026-10-21  
**Severity:** Medium (the cleanup shipped with the rewrite actions; the summary detection was caught in review, before
release)  
**Category:** Bug  
**What happened:** Every free-text answer went through one cleanup that stripped a quote at either end and a "Title:",
"Summary:" or "Continuation:" label at the start, in 7 languages, whatever the action. Correcting `"Dune" by Frank Herbert` gave
`Dune" by Frank Herbert`, and dictating "Titolo: ..." lost the word. Once rewrites ran line by line (phase 7) it hit every line
that started or ended with a quote. The first draft of the summary on top had a similar flaw: it recognized an old summary by a
bold label in any language, so a note starting with the user's own bold "Riassunto" line would have lost the line under it.

**Root cause:** Both guessed what the model or the app had added from what the text looked like, instead of checking it against
the input or marking what the app writes.  
**Fix:** `cleanAnswer(action, input, answer)`: quotes or bold are removed only when they wrap the whole answer, not the input,
and no other quote of the kind is inside (a translated dialogue, two quoted words); a label only from a title or a summary. The
summary's label is written as `<b data-fm="summary">` and only that mark, at the very top, identifies it; if the mark shows up
again right after it (Enter copies it onto the next line), nothing is taken for the summary. Tests in `scripts/ai.test.mjs`.  
**Rule:** Remove from the user's text only what the app can prove it added: compare with the input, or mark what it writes.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`feat/ai-long-notes`

### LL-059: A server behind an http -> https redirect connected, then the phone read itself as removed

**Date:** 2026-10-21  
**Severity:** High (self-hosted server, not released yet; found in the review of the desktop's Rust network commands)  
**Category:** Bug  
**What happened:** A server typed as `http://` behind a reverse proxy that redirects to https (Caddy does it by default): the
phone connected, then dropped the connection as if another device had removed it. The web app did the same. A 404 that came
through a redirect or from the proxy itself read as a deleted note, and a captive portal's 200 page counted as a written vault.

**Root cause:** The phone's fetch (`expo/fetch`, on OkHttp) and the browser follow redirects by default. On the way to another
scheme or host they drop the `Authorization` header, but keep `X-Access-Key`: the handshake and the enrolment worked, the
device's token never arrived, and the server's `401 device_unknown` read as "this device was removed". The adapter read any
answer as the server's: a status without the server's error code, a 2xx body that isn't JSON.

**Fix:** `serverBackend.send()` asks for `redirect: "manual"` and treats any redirect as a transport error (retried, never a
refusal): the browser's opaque redirect, a 3xx (the phone's `expo/fetch` hands it back, verified on the emulator; the desktop
app's Rust client follows none) and, from a fetch that isn't a browser's (one that may follow), `redirected` or an answer from
another scheme, port or host name (IP and Unicode hosts, which may come back rewritten, are judged by scheme and port). A
browser's answer from https after it upgraded the request itself (HSTS, HTTPS-Only) is the server's: the token goes along. A 2xx
that isn't JSON is an error too, a vault counts as created only on the server's `{result: "created"}`, and `fetchNote` reads
only the server's own `not_found` as a deleted note. Tests in `scripts/sync-server.test.mjs` ("a redirect is never the server's
answer"; 12 of them fail on the code before the fix).

**Rule:** Interpret a status or a body only when the answer is the server's own: never one that came through a redirect, and a
meaning that destroys data (absent, removed) only with the server's error code.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`fix/server-redirect`

### LL-060: A note's HTML could run code in the app: the text editor and the web PDF export

**Date:** 2026-10-21  
**Severity:** High (present in every version with the rich text editor; found in the review of the desktop shortcuts)  
**Category:** Bug (security)  
**What happened:** A note containing `<img src=x onerror="...">` (from an imported backup, or another device) ran that code as
soon as it was opened: pell puts the note into its page with `innerHTML`. On web and desktop that page is a same-origin `srcdoc`
iframe, so the code reached the app's page (its storage, on desktop the Rust commands); measured in the web build, a note of
payloads ran 13 times, 11 of them in the app's own page. The web PDF export put the note, and its title unescaped, straight into
the app's page. The review of the fix found more ways in: on web pell runs as code the commands any window posts to its iframe,
and the app handed any window's message to the editor (a page that opened or framed the app could rewrite the open note); and a
note could still carry a fake login form, links to Android intents or app screens, a fixed overlay, and a form whose button
reloaded the editor empty.

**Root cause:** The note's HTML was trusted: nothing between the stored text and the DOM. Pasting is plain text, so the editor
itself never produced such HTML, but imports and synced notes don't come through the editor.

**Fix:** DOMPurify inside the editor's page, wrapping every way HTML becomes DOM there (ADR-021), injected before a note is
loaded; dropped HTML inserted as text; a configuration without forms, dialogs, overlays or links into the phone and the app; on
web, the editor iframe and the app read only each other's messages; the web PDF export built from DOMPurify's nodes, the title
as text, and escaped on every platform. Checked against 329 real note HTML samples (no change but attribute whitespace, Word's
empty tags and a link's `target`), 25 payloads through 5 sinks, the policy, the message guards and the drop in Chrome, and the
real editor before and after (identical content and screenshots, to-do boxes, reopening). Tests: `scripts/sanitize.test.mjs`.

**Rule:** Never turn a note's HTML or text into DOM unsanitized: DOMPurify (`NOTE_HTML_CONFIG` + `addNoteHooks`) for HTML,
`escapeHtml` or `textContent` for text. A note is data from elsewhere, even the user's own. A page that runs what it is sent
(pell's `command`) must check who sent it.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`fix/editor-sanitize`

---

### LL-061: A full screen window hidden while leaving full screen came back on screen

**Date:** 2026-10-21  
**Severity:** Medium (found while testing ADR-022, never released)  
**Category:** Platform (macOS)  
**What happened:** Closing the desktop window in full screen should leave full screen and hide it (hidden as it is, its Space
stays black). Hiding it right after `set_fullscreen(false)`, then once `is_fullscreen()` turned false, then once its size
changed: each time the window was back on screen ~0.4 s later, visible and focused.

**Root cause:** tao reports the window out of full screen (and resizes it) as the animation starts; macOS orders the window back
in as the animation ends (`windowDidExitFullScreen`), undoing an earlier `hide()`.

**Fix:** remember when the window was asked out of full screen; on every `Resized` / `Focused(true)` from 200 ms later on (the
end of the animation emits both) hide it, until 2 s, when it's hidden a last time if that request is still the current one.
Showing the window (Dock, menu, second launch) cancels the request. Measured: hidden as the animation ends and still hidden
later; reopened during the animation, it stays.

**Rule:** On macOS, act on a window leaving full screen only once the animation is over (the event at its end), never on the
state tao reports at its start.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`feat/desktop-startup`

---

### LL-062: H1 on a list item grew on every press and never turned off

**Date:** 2026-10-21  
**Severity:** Medium (in every version with the rich text editor; reported by the user)  
**Category:** Bug  
**What happened:** H1 on a list item made the text bigger on every press (32 -> 64 -> 128 px) instead of turning off. An audit
of the toolbar's block buttons (every kind of line, every kind of selection, in headless Chrome and the Android emulator's
Chrome) found more: code nested a code block per press, lists went inside headings and code blocks, H1 split a list (the numbers
restarted), neither H1 nor code ever turned off, the list buttons moved the caret to the line start, an image at the end of a
line left a stray `<br>` and the caret a line below, Enter twice left pell's code block with an empty code line, and Backspace
at the start of the first bullet did nothing. A saved note keeps `<h1><ul>` and `<pre><pre>` (the HTML parser flattens only
`<h1><h1>`, leaving an empty heading).

**Root cause:** pell's block buttons are bare `execCommand("formatBlock", "<h1>" / "<pre>")` (code also wraps each line in a
`<code>`) and list commands. Chromium's `formatBlock` wraps a list or a block of another kind instead of replacing it, nests
inside a multi-line `<pre>` or a list item, and has no "off". RichToolbar sends these buttons straight to the page, with no prop
to change them.

**Fix:** a script in the editor's page (`RICH_TEXT_SCRIPT`, ADR-023), with the toolbar's heading, code and list buttons routed
to it. A line is one of text, heading, code, bullet or numbered item, and the button of what it is turns it back into text. A
block is removed by selecting its whole content and running `formatBlock div` (clean, and undoable). The selection is kept by
character offset. Backspace at the start of a list item removes the bullet. Enter on an empty last code line leaves the block in
one undo step. Images go in at the caret, with the caret on a new line. CSS guards cover notes saved with the nested markup. The
check in the web app found one more case the hand-written test HTML didn't have: after H1 is turned off, Chrome keeps a line's
text in a style `<span>`, and the code exit looked for the empty line only among the block's direct children. Now it looks at
any depth. The check in the app, on the emulator's Android WebView 134, found another: there a new paragraph in a `<pre>`
(Enter, also Gboard's) splits it into two code blocks, where Chrome 148 adds a line. Pell's `<code>` lines had hidden that.
Enter in a code block is now a line break (`insertLineBreak`, a `\n` in the text), which `formatBlock` turns into `<br>`s when
the block becomes text, so the caret's offsets don't count the `\n`s. `scripts/richtext.test.mjs`: 623 checks on the real pell
page with the note sanitizer; pell's own buttons fail 141 of them.

**Rule:** Never send a block format or a list command to pell directly (`formatBlock`, `insertUnorderedList` /
`insertOrderedList`, pell's `heading1` / `code` actions): go through `window.__fm.toggle`. A change to the page script comes
with a case in `scripts/richtext.test.mjs` and a check in the real editor, also in the app's Android WebView (the emulator's is
134): Chrome adds style spans and wrappers that hand-written HTML doesn't have, and its editing commands change between
versions.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`fix/richtext-blocks`, `fix/richtext-code-lines`

---

### LL-063: Popup menus opened a status bar's height below their button on Android

**Date:** 2026-10-21  
**Severity:** Medium (found in the 4.0.0 test build, never released)  
**Category:** Platform (Android)  
**What happened:** The ⋮ menu of a note (every `PopupMenu`) opened ~24 dp below its button instead of right under it, as it did
in 3.2.0. Measured on the emulator: the first item 63 px lower than expected, the status bar's exact height.

**Root cause:** `PopupMenu` added `StatusBar.currentHeight` to the trigger's `measureInWindow` y, because the window used to
start below the status bar while the translucent `Modal` starts at the top of the screen. Since Expo SDK 58 the app draws edge
to edge: the window starts at the top too, so the offset counted the status bar twice.

**Fix:** no offset: the trigger's window coordinates are the Modal's.

**Rule:** On Android (edge to edge), `measureInWindow` coordinates and a `statusBarTranslucent` Modal share the same origin, the
top of the screen: never add the status bar's height to place an overlay. To be independent of it, measure the overlay's own
origin too and subtract it (as `TourSpotlight` does).

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`fix/popup-menu-offset`

---

### LL-064: The desktop app showed an empty screen before every screen it opened

**Date:** 2026-10-21  
**Severity:** Medium (found in the 2.0.0 test build, never released)  
**Category:** Platform (web/desktop) / Performance  
**What happened:** In the desktop app every screen (settings, a note, help...) opened on an empty screen for a moment before its
content, which 1.2.0 never did.

**Root cause:** Expo Router 58 turns async routes on by default on web (`asyncRoutes: { web: true }`): the web export had one
chunk per route (46 files), fetched and run on the first visit of each screen, with nothing drawn meanwhile. Measured on the web
export with the CPU slowed 4x: home -> settings drew its content after 325 ms with 37 empty frames.

**Fix:** `["expo-router", { asyncRoutes: { web: false } }]` in `app.config.ts`, as up to SDK 57: settings drawn after 45 ms, no
empty frame. Startup got faster too (first content ~2.3 s instead of ~2.7 s at 4x): the first screen no longer waits for its own
chunk after the main bundle. Native builds are unchanged (async routes are web-only in production).

**Rule:** Keep async routes off on web: the desktop app loads its code from disk, so splitting saves nothing and costs a blank
screen per navigation. After changing `asyncRoutes`, export with `--clear` (Metro's cache keeps the old split).

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`fix/web-sync-routes`

---

### LL-065: After an image change the image stayed selected, and the next key deleted it

**Date:** 2026-10-21  
**Severity:** Medium (found on the emulator before the image menu was merged, never released)  
**Category:** Bug  
**What happened:** The image menu (ADR-024) changed the image, but the caret moved next to it: after a new size or a quarter
turn it was by the image's edge instead of on the line where the user was writing. After an alignment the image itself stayed
selected, so the next key typed replaced it. The branch's review found that a new size or a turn also dropped a link around the
image, and that after a long press Chrome's click opened the menu anyway. While the image code was being written, a tap test
also crashed in the image's `touchend` handler.

**Root cause:** `execCommand` works on the selection, so each change selects the image first (`insertHTML` of a changed copy,
`justify*`, `delete`), and the browser leaves the selection where the command ends: after the inserted copy, or on the image for
`justify*`. An `insertHTML` over the image alone puts the copy outside the link the image was in. The crash: `refreshToolbar`
dispatches a bare `touchend` (no `changedTouches`) to make pell read the selection again, and the handler read
`e.changedTouches[0]`.

**Fix:** `__fm.image` saves the selection as a `Range` before the change (a range follows the edits around it) and selects it
again after. Three cases are different:

- a caret right after what gets replaced would end up before the copy, so it is put after the copy;
- a caret inside a link that gets replaced goes back by its place in the text;
- a note with no selection is left with none, so a change made while not editing the note doesn't open the keyboard.

An image in a link is replaced along with the whole link. The `touchend` handler ignores an event with no `changedTouches`, and
a click right after a touch on an image belongs to the touch. `scripts/richtext.test.mjs` checks each change with the caret on
another line, right after the image or its link, and with no caret, plus links with and without text and a long press. All of
these checks failed before the fix.

**Rule:** A page-script change that selects something to run an `execCommand` on it puts the user's selection back afterwards.
Never leave an element selected behind, because a key replaces it. An `insertHTML` that replaces an element inside a link must
replace the link. Handlers on the editor's content must accept `refreshToolbar`'s synthetic `touchend`.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-21 **Resolved in:** branch
`feat/richtext-images`

---

### LL-066: The startup looked slow on test builds, and its first file read waited for kotlin-reflect

**Date:** 2026-10-22  
**Severity:** Medium (the user found the startup too slow on a fast phone; the transition into home sometimes stuttered)  
**Category:** Performance / Platform (Android)  
**What happened:** The DEV test APKs were release builds marked debuggable (a local tweak of the generated `android/`, for
`run-as`). Measured on the emulator with timing marks in the JS, a cold start took ~7.5 s to home's first frame. The same build
not marked debuggable took ~0.6 s. The JS in between was mostly idle, waiting for the store's rehydration and for the fonts.
Even in the non-debuggable build, the first file read (the legacy notes' check) took ~120 ms for a tiny file, and the
rehydration and the fonts waited behind it. Then home faded in, while it was still drawing its first frame.

**Root cause:** A debuggable app runs its Java/Kotlin interpreted (ART uses no compiled code), so everything native at startup
was several times slower than in a store build. The slow read: Expo's async functions run on one queue, and the first one called
with an options object (`FileSystem.getInfoAsync(path, {})`) has expo-modules build that object through kotlin-reflect.
kotlin-reflect's first use loads its metadata (simpleperf on the queue thread: `KClassImpl.getConstructors` under
`ObjectConstructorFactory`): 1.6 s interpreted, ~120 ms compiled, on the emulator. Every Expo call behind it waited, and
`useFonts` loaded the 4 Geist files on that same queue at every launch, with the app drawing nothing until they were in. JS
sampling profiles are not available in release builds (`HermesInternal.enableSamplingProfiler` is undefined).

**Fix (ADR-025):**

- The fonts are built into the apps (the expo-font plugin's `fonts`), and only the web loads them (`useAppFonts`).
- A thread started in `MainApplication.onCreate` (a config plugin in `app.config.ts`) runs kotlin-reflect on expo-file-system's
  option classes while the JS engine starts, so the first read takes ~22 ms.
- No animation into home.

On the emulator (non-debuggable, median of 6 cold starts) home's first frame moved from 594 to 514 ms after the process start,
and with the 300 ms fade gone home shows ~380 ms sooner. The DEV APKs are no longer marked debuggable.

**Rule:** Measure startup and performance on a non-debuggable release build (CONVENTIONS #44), with marks that log `Date.now()`
(they reach logcat in release) and the process start from logcat. To find what a native thread does, use
`simpleperf record --app <pkg> -e cpu-clock -g` (on the emulator `cpu-cycles` isn't available; the app must be debuggable or
profileable). The first Expo async call with an options object pays for kotlin-reflect: keep it off the critical path or warm it
up.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-22 **Resolved in:** branch
`perf/startup-mobile`

---

### LL-067: On Firebase, a text note of 0.75 to 1 MB never synced, and nothing said so

**Date:** 2026-10-22  
**Severity:** Medium (found by reading the code while planning per-cloud limits; never reported by a user)  
**Category:** Bug / Sync  
**What happened:** The text editor allowed 1 MB of text (`configs.notes.sizeLimit`) on every cloud. A note is encrypted field by
field with AES, written in base64: a third bigger. A text note over ~0.75 MB therefore made a Firestore document over its 1 MiB
limit. The write was refused, the note stayed in the outbox as `rejected` (not retried until the next launch) and was refused
again at every launch. The other devices never got it, and cloud sync being silent (LL-004), nobody was told. The FastMemo
server had the opposite gap: it took 5 MB (`MAX_NOTE_MB`) but the app stopped at 1 MB.

**Root cause:** One app-wide limit on the plain text, while each cloud limits the note as it's sent, encrypted.

**Fix (ADR-026):** each cloud reports its limit (`CloudBackend.maxNoteBytes`: Firestore's, or the server's `MAX_NOTE_MB` from
`/v1/info` and `/v1/devices`) and doesn't send a note over it (`PushResult.tooLarge`). The engine makes such a note offline (the
detach of the offline notes feature), so every device keeps its copy, and tells the user once. The text editor's limit is the
cloud's, turned into text (`noteTextLimit`), and a note already over it can still be cut down. `scripts/sync.test.mjs` and
`scripts/sync-server.test.mjs` cover it.

**Rule:** a note's size limit comes from the cloud in use, measured as that cloud measures it (CONVENTIONS #45). A note a cloud
can't take is made offline, never left to be refused in silence.

**Tracking issue:** (not filed; captured here) **Status:** Resolved **Resolved:** 2026-10-22 **Resolved in:** branch
`feat/note-size-per-cloud`

---

## Template for New Entries

Copy this template when adding a new lesson:

```markdown
### LL-NNN: Title

**Date:** YYYY-MM-DD **Severity:** Critical | High | Medium | Low **Category:** Bug | Performance | Architecture | Convention |
Platform **What happened:** **Root cause:** **Fix:** **Rule:**

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/NNN **Status:** Open

<!-- When resolved, add: **Resolved:** YYYY-MM-DD **Resolved in:** <commit SHA or PR #> and set Status to "Resolved" -->
```
