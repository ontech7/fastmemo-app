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

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/20 **Status:** Open (first attempt reverted, see LL-022)

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
- `src/app/settings/ai-assistant.tsx:18-21` -- `let aiLib = null; if (Platform.OS !== "web") aiLib = require("@/libs/ai")` even
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
- `src/app/settings/ai-assistant.tsx` -- replaced the `aiLib = require("@/libs/ai")` dance with direct static imports; the web
  bundle uses the existing `index.web.ts` no-op stubs.
- `src/utils/toast.ts` -- split into `toast.ts` (native, `react-native-root-toast`) + `toast.web.ts` (web, `react-hot-toast`).
- `src/app/_layout.tsx` -- extracted `<WebToaster>` into `src/components/WebToaster.tsx` + `WebToaster.web.tsx`.
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

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/50 **Status:** Open

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

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/49 **Status:** Open

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

**Fix:** Added `react-native-get-random-values@1.11.0` and imported it as the **first line** of `src/app/_layout.tsx` (before
any crypto-using module), which installs `global.crypto.getRandomValues` backed by the OS CSPRNG. It is a **native module**, so
it requires a dev-client rebuild (`npx expo prebuild` + rebuild) -- the same constraint as `expo-crypto`.

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

## Template for New Entries

Copy this template when adding a new lesson:

```markdown
### LL-NNN: Title

**Date:** YYYY-MM-DD **Severity:** Critical | High | Medium | Low **Category:** Bug | Performance | Architecture | Convention |
Platform **What happened:** **Root cause:** **Fix:** **Rule:**

**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/NNN **Status:** Open

<!-- When resolved, add: **Resolved:** YYYY-MM-DD **Resolved in:** <commit SHA or PR #> and set Status to "Resolved" -->
```
