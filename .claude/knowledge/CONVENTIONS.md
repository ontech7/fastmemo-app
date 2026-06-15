# FastMemo Coding Conventions

> **Read this before writing any code.** These conventions are derived from actual codebase analysis, not theoretical
> guidelines.

## Table of Contents

1. [Component Conventions](#component-conventions)
2. [TypeScript Conventions](#typescript-conventions)
3. [Import Conventions](#import-conventions)
4. [Redux Conventions](#redux-conventions)
5. [Styling Conventions](#styling-conventions)
6. [i18n Conventions](#i18n-conventions)
7. [Platform-Specific Conventions](#platform-specific-conventions)
8. [Backward Compatibility & Data Migration](#backward-compatibility--data-migration)
9. [Cloud Sync & Firestore Budget](#cloud-sync--firestore-budget)
10. [Naming Conventions](#naming-conventions)
11. [DO / DON'T Quick Reference](#do--dont-quick-reference)

---

## Component Conventions

### File Structure

Every component file follows this order:

```tsx
// 1. Imports (third-party, then @/ alias, then relative)
import { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { Note } from "@/types";
import { COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

// 2. Props interface (always named "Props", never exported)
interface Props {
  title: string;
  onPress: () => void;
  isLast?: boolean;
}

// 3. Component function
export default function MyComponent({ title, onPress, isLast = false }: Props) {
  const { t } = useTranslation();
  // ... hooks, state, effects, handlers
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

// 4. Styles at the bottom
/* STYLES */
const styles = StyleSheet.create({
  container: { ... },
  title: { ... },
});
```

### Export Patterns

**Standard components:**

```tsx
export default function ComponentName({ ... }: Props) { ... }
```

**Memoized components (list items, cards, settings sections):**

```tsx
function ComponentName({ ... }: Props) { ... }
export default memo(ComponentName);
```

Rules:

- Use `memo()` from `"react"` (not `React.memo()`)
- Memo-wrapped components: NoteCard, TrashedNoteCard, OrderedCategoryCard, CategoryFilterButton, UnusedCategoryButton, Section,
  VirtualNumberKeyboard, CodeEditorWebView
- Only memo components that render inside lists (FlashList, DraggableFlatList) or are expensive to re-render

### Props Interface Rules

- **Always** name it `Props` (never `ComponentNameProps`, never inline)
- **Never** export the Props interface
- **Always** use `interface` (not `type`)
- Optional props use `?:` syntax
- Callback props: `onPress?: () => void` or `onPress?: (() => void) | null`
- Sub-interfaces (e.g., `MenuItemProps`, `DialogActionConfig`) can be defined in the same file

### Pressable Elements

The standard interactive element is `TouchableOpacity` with `activeOpacity={0.7}`:

```tsx
<TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
  <Text>{label}</Text>
</TouchableOpacity>
```

### SafeAreaView

Always use the project's custom `@/components/SafeAreaView`, not the one from `react-native-safe-area-context` directly.

### Icons

All icons come from `react-native-heroicons/outline` (outline variant only). Standard size is 28.

---

## TypeScript Conventions

### Type vs Interface

- **`interface`** for all object shapes: components props, state shapes, API responses
- **`type`** only for unions and aliases: `type Note = TextNote | TodoNote | ...`, `type NoteType = "text" | "todo" | ...`

### Type-Only Imports

Always use the `type` keyword for type-only imports:

```tsx
import type { Note, Category } from "@/types";
import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";
```

### Discriminated Unions

The note type system uses interface extension with a `type` discriminant field:

```ts
interface NoteBase { id: string; type: NoteType; ... }
interface TextNote extends NoteBase { type: "text"; text: string; }
interface TodoNote extends NoteBase { type: "todo"; items: TodoItem[]; }
// ...
type Note = TextNote | TodoNote | KanbanNote | CodeNote;
```

Use `switch (note.type)` for type narrowing.

### Barrel Exports

Types are barrel-exported from `src/types/index.ts` using `export type { ... } from "./module"`. Import types from `@/types`
(the barrel), not from individual files.

---

## Import Conventions

### Path Alias

**Always** use the `@/` alias for cross-module imports:

```tsx
// CORRECT
import { COLOR } from "@/constants/styles";
import type { Note } from "@/types";
import { useRouter } from "@/hooks/useRouter";

// WRONG -- never use relative paths across module boundaries
import { COLOR } from "../../constants/styles";
import type { Note } from "../types";
```

Relative imports (`./`, `../`) are acceptable only within the same module (e.g., `types/note.ts` importing from `./common`).

### Import Order

Follow this order (not auto-enforced, but maintained manually):

1. React and React Native (`react`, `react-native`)
2. Third-party libraries (`expo-*`, `@shopify/flash-list`, `i18next`, etc.)
3. Internal modules via `@/` alias (`@/types`, `@/utils/*`, `@/libs/*`, etc.)
4. Type-only imports (grouped with their source or at the end)

### What to Import From Where

| Need             | Import From                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| Component types  | `@/types` (barrel)                                                             |
| Style constants  | `@/constants/styles`                                                           |
| Route navigation | `@/hooks/useRouter`                                                            |
| Redux state      | `@/slicers/notesSlice`, `@/slicers/categoriesSlice`, `@/slicers/settingsSlice` |
| Redux dispatch   | `react-redux` (`useDispatch`)                                                  |
| Typed dispatch   | `@/slicers/store` (`useAppDispatch`)                                           |
| Translations     | `react-i18next` (`useTranslation`)                                             |
| AI features      | `@/libs/ai` (auto-resolves platform)                                           |
| Config values    | `@/configs` (barrel)                                                           |

---

## Redux Conventions

### Slice Structure

Each slice follows:

```ts
const initialState: SliceState = { ... };

const slice = createSlice({
  name: "domain",
  initialState,
  reducers: {
    actionName: (state, action: PayloadAction<Type>) => { ... },
  },
  extraReducers: (builder) => {
    builder.addCase(thunkAction.fulfilled, (state, action) => { ... });
  },
});

export const { actionName } = slice.actions;
export default slice.reducer;

// Selectors at the bottom
export const getAllItems = (state: RootState): Item[] => state.domain.items;
```

### Selector Naming

Use `get` prefix for selectors (the `selector` prefix exists in legacy code but `get` is preferred for new code):

```ts
// Preferred
export const getCategories = (state: RootState): Category[] => state.categories.items;

// Existing (legacy, do not replicate)
export const selectorLanguage = (state: RootState): string => state.settings.language;
```

For memoized selectors, use `createSelector` from `reselect`:

```ts
export const getNotesFilteredPerCategory = (category: Category, showHidden: boolean) =>
  createSelector([getAllNotes], (notes): Note[] => { ... });
```

### Cloud Sync Outbox Pattern

Local mutations queue data for cloud sync via `only_if_cloudConnected()`, but only when the **vault is unlocked**
(`isVaultUnlocked()` reads the in-memory DEK from `libs/vaultSession`):

```ts
// Inside reducer (mutates Immer draft):
only_if_cloudConnected(state as unknown as RootState, () => {
  if (!isVaultUnlocked()) return; // no DEK -> cannot encrypt; do not queue plaintext
  state.cloud.items.add[note.id] = CryptNote.encrypt(note); // CryptNote reads the DEK from vaultSession
});
```

`CryptNote.encrypt` takes no key argument anymore -- it reads the per-vault DEK from `vaultSession` and **fails closed** if the
vault is locked (never emits plaintext). The old global `secretKey` argument and build-time `SECRET_KEY` are superseded by
per-vault envelope encryption (see ADR-012); the legacy key survives only as the migration `legacyKey` and is removed after the
migration window. Deletes/detaches use a content-stripped `deletionStub` so they need no DEK and propagate even while locked.

Thunks drain the outbox, and `extraReducers` cleans up on fulfillment. **Do not replicate this pattern in new reducers** -- the
cloud sync queuing should ideally move to middleware.

**Cloud sync is silent by design.** Do NOT add `.pending`/`.rejected` handlers to cloud sync thunks in order to surface
loading/error state to the user (banners, toasts, status fields). The offline-first flow is:

- `SyncOnProvider` gates every sync loop on `netInfo?.isConnected`; while offline, thunks are not dispatched at all.
- On transient failures, items stay in the outbox and are retried automatically on the next tick (implicit retry).
- Only handshake-level failures (invalid credentials, device evicted) are surfaced -- these use the existing
  `cloudsync.handshakeFailed` alert and `disconnected` toast in `useCloudSync.ts` / `SyncOnProvider.tsx`.

If observability is needed for a new cloud-sync feature, use Sentry breadcrumbs inside the thunk, not Redux state. See LL-004.

### Dispatching Actions

Components use `useDispatch()` from `react-redux`:

```tsx
const dispatch = useDispatch();
dispatch(addNote({ ...noteData }));
```

For thunks that need typed dispatch, use `useAppDispatch` from `@/slicers/store`.

---

## Styling Conventions

### StyleSheet Pattern

**Always** use `StyleSheet.create()` at the bottom of component files:

```tsx
/* STYLES */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.darkBlue,
    padding: PADDING_MARGIN.md,
  },
  title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.lg,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
```

### Style Constants

Always use constants from `@/constants/styles`:

| Constant         | Purpose                 | Key Values                                                                        |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `COLOR`          | All colors (dark theme) | `darkBlue` (bg), `softWhite` (text), `lightBlue`, `placeholder`, `red`, `yellow`  |
| `FONTSIZE`       | Font size scale         | `xs`, `sm`, `md`, `lg`, `xl`, `xxl`                                               |
| `FONTWEIGHT`     | Platform-aware weights  | `regular`, `medium`, `semiBold`, `bold` (iOS: "600", Android: "700" for semiBold) |
| `PADDING_MARGIN` | Spacing scale           | `xs: 3`, `sm: 8`, `md: 12`, `lg: 18`, `xl: 35`, `xxl: 50`                         |
| `BORDER`         | Border radius           | `small: 7`, `normal: 12`, `big: 20`, `rounded: 999`                               |

### Inline Styles

**Avoid inline `style={{}}` objects**, especially in:

- List item components (NoteCard, TodoItem, KanbanCard) -- these break memoization
- Components rendered in FlashList or FlatList

Acceptable uses of inline styles:

- Truly dynamic values: `style={{ width: calculatedWidth }}`
- Platform-conditional one-offs: `style={{ marginTop: Platform.OS === "ios" ? 20 : 0 }}`

### Common Style Patterns

```tsx
// Standard screen background
backgroundColor: COLOR.darkBlue

// Standard text color
color: COLOR.softWhite

// Standard input styling
cursorColor={COLOR.softWhite}
placeholderTextColor={COLOR.placeholder}

// Three-column header layout (repeated across screens -- candidate for shared component)
<View style={styles.header}>
  <BackButton />
  <Text style={styles.headerTitle}>{t("screen.title")}</Text>
  <View style={styles.headerSpacer} />
</View>
```

---

## i18n Conventions

### Key Structure

Translation keys follow a dot-separated `section.key` hierarchy:

```
t("home.title")              -> section: home, key: title
t("note.settings.delete")    -> section: note, subsection: settings, key: delete
t("ai.feedback.note_created", { title }) -> with interpolation
```

### Key Naming

- Use `snake_case` for keys: `title_placeholder`, `no_items`, `delete_all`
- Group by feature: `home.*`, `note.*`, `settings.*`, `ai.*`, `kanban.*`
- Top-level generic keys: `ok`, `confirm`, `cancel`, `delete`, `loading`, `error`

### Adding New Translations

When adding a new UI string:

1. Add the key to ALL 7 locale files: `en.ts`, `it.ts`, `es.ts`, `fr.ts`, `de.ts`, `zh.ts`, `ja.ts`
2. Place it in the correct section (or create a new section if it's a new feature)
3. Use interpolation for dynamic values: `"Created {{count}} notes"`
4. Use `useTranslation()` hook in the component: `const { t } = useTranslation();`

### Interpolation

```ts
t("trashednotes.countdown", { days: 3, hours: 12, minutes: 30 });
// -> "Delete in: 3 day(s), 12 hour(s) and 30 minute(s)"
```

Note: Pluralization currently uses manual "(s)" pattern rather than i18next's built-in plural system.

---

## Platform-Specific Conventions

### File Extension Pattern

When a component/module needs different web vs native behavior:

```
Component.tsx       -> Native implementation (default)
Component.web.tsx   -> Web-specific override
```

Metro auto-resolves the correct file. The import remains the same: `import Component from "./Component"`.

Use `.native.tsx` only when both variants exist alongside a barrel `index.ts`:

```
haptics/
  index.ts            -> Barrel (runtime Platform check)
  haptics.native.ts   -> Native implementation
  haptics.web.ts      -> Web implementation (no-op stubs)
```

### No-Op Stub Convention

For native-only modules on web, provide API-compatible stubs:

```ts
// libs/ai/index.web.ts
export function isNativeModuleAvailable(): boolean {
  return false;
}
export async function downloadModel(): Promise<boolean> {
  return false;
}
export async function generateEditorContent(): Promise<EditorActionResult> {
  return { success: false, error: "AI not available on web" };
}
```

### Dynamic Require for Native Modules (discouraged)

**Prefer file-based platform splits**. Dynamic `require(...)` as a platform gate is discouraged because (1) Metro still
statically analyzes the literal string and may include the non-target module in the bundle, (2) it hides the platform boundary
inside function bodies, and (3) it defeats TypeScript and tree-shaking clarity.

Legitimate remaining uses of dynamic `require`:

- **Metro asset imports:** `require("../assets/foo.png")` -- this is Metro's asset syntax, not a module require.
- **Inside an already-web file, for Tauri-only paths:** e.g. `await import("@tauri-apps/api/fs")` inside an `if (isTauri())`
  branch of a `.web.ts` file. Tauri shares the web bundle, so this is runtime detection, not bundle-time resolution.

If a module genuinely has no web equivalent (e.g. `expo-local-authentication`, `@react-native-community/netinfo`, `llama.rn`),
do NOT write:

```ts
// WRONG -- dynamic require as platform gate
if (Platform.OS !== "web") {
  const NetInfo = require("@react-native-community/netinfo");
  // use NetInfo
}
```

Instead, split the consuming file into `.ts` / `.web.ts`:

```
src/hooks/useNetInfo.ts         // native -- statically imports NetInfo
src/hooks/useNetInfo.web.ts     // web -- polls fetch() + visibilitychange
```

Consumers keep writing `import useNetInfo from "@/hooks/useNetInfo"` and Metro/Webpack picks the correct file at bundle time.

### Never Import with Explicit Platform Suffix

Consumers must ALWAYS import the suffix-less path. Never write `from "./Component.native"` or `from "./Component.web"` --
Metro's resolver picks the variant automatically.

```ts
// CORRECT
import TodoItem from "@/components/todo/TodoItem";

// WRONG -- bypasses platform resolution
import TodoItem from "@/components/todo/TodoItem.native";
import TodoItem from "@/components/todo/TodoItem.web";
```

### No Platform.OS Checks Inside Redux Reducers / Selectors / Thunks

Reducers and selectors must be pure and platform-agnostic. If a default value differs between native and web, put it in a
platform-split constants module:

```
src/constants/voiceRecognition.ts        // native default
src/constants/voiceRecognition.web.ts    // web default
```

Then the selector stays pure:

```ts
import { DEFAULT_VOICE_RECOGNITION } from "@/constants/voiceRecognition";
export const selectorVoiceRecognition = (state: RootState) => state.settings.voiceRecognition ?? DEFAULT_VOICE_RECOGNITION;
```

---

## Backward Compatibility & Data Migration

### Core Principle

Every feature or fix that changes data structures, Redux state shape, or persisted formats **must be backward compatible**.
Users have existing data on their devices and in Firestore -- breaking changes mean data loss or app crashes on update.

### Rules

1. **Never remove or rename fields** in persisted types (`Note`, `Category`, `SettingsState`) without a migration path. Old data
   without the new field must still load correctly.

2. **Always use optional fields with defaults** when adding new properties to existing types:

   ```ts
   // CORRECT -- existing notes without this field still work
   interface NoteBase {
     // ... existing fields
     newField?: string; // added in v2.10.0
   }

   // WRONG -- crashes when loading notes saved before v2.10.0
   interface NoteBase {
     // ... existing fields
     newField: string; // required field breaks old data
   }
   ```

3. **Always handle missing data gracefully** in reducers and components. Use nullish coalescing (`??`) or optional chaining
   (`?.`) when reading fields that may not exist in older persisted data:

   ```ts
   const value = note.newField ?? "default";
   ```

4. **Never change the meaning of existing field values.** If a field currently stores a string and you need a different format,
   add a new field rather than repurposing the existing one.

5. **Never change the Redux persist keys** (`root_notes`, `root_categories`, `root_settings`) or storage backends without
   implementing a `redux-persist` migration (`migrate` option in `PersistConfig`).

6. **Test with old data.** Before shipping a breaking change, verify that the app loads correctly with data persisted by the
   previous version. This applies to both local Redux Persist storage and cloud-synced Firestore documents.

7. **Cloud sync compatibility.** If user A updates to the new version and syncs, user B on the old version must not crash when
   receiving the new data format. New fields should be silently ignored by older clients (Firestore does this naturally, but the
   app code must tolerate unknown fields and missing new fields alike).

---

## Cloud Sync & Firestore Budget

### Context

Cloud sync uses **Firebase Firestore free tier (Spark plan)** with daily limits:

| Operation | Daily Limit |
| --------- | ----------- |
| Reads     | 50,000      |
| Writes    | 20,000      |
| Deletes   | 20,000      |

Most users operate within these limits. Every Firestore operation counts, so code must be designed to minimize unnecessary
reads, writes, and deletes.

### Rules

1. **Batch operations where possible.** When syncing multiple notes/categories, prefer Firestore batch writes (`writeBatch`)
   over individual `setDoc`/`deleteDoc` calls. A batch of 10 writes counts as 10 write operations but uses a single network
   round-trip and provides atomicity.

2. **Never sync unchanged data.** Before writing to Firestore, the outbox pattern in Redux already ensures only modified items
   are queued. Do not bypass this by writing items that have not changed locally.

3. **Never read entire collections when a single document read suffices.** Use `getDoc()` for single documents, reserve
   `getDocs()` with collection queries for bulk operations (initial sync, device handshake).

4. **Minimize polling reads.** `SyncOnProvider` polls on an interval and on app foreground. Each poll that reads cloud state
   counts against the 50K read limit. Keep polling intervals reasonable and avoid triggering unnecessary syncs.

5. **Debounce rapid changes.** When a user edits a note rapidly (typing), the system must debounce before queuing for cloud
   sync. The current `DEBOUNCE_NOTES_DELAY` in `SyncOnProvider` handles this -- do not bypass or reduce it.

6. **Delete operations are cheap but not free.** The 20K delete limit is generous, but bulk operations (wipe all notes, wipe
   categories) should still use batch deletes and warn the user if the operation is large.

7. **Count operations in new features.** When implementing a feature that interacts with cloud sync, estimate the Firestore
   operations per user action:
   - How many reads does it trigger?
   - How many writes?
   - Does it scale linearly with the number of notes/categories?

   Document the estimate in the PR description.

8. **Avoid redundant device sync.** The current thunk pattern processes a primary sync and an optional secondary device sync per
   item. When adding new sync logic, verify that you are not duplicating writes to the same document.

9. **Never store large blobs in Firestore.** Notes with embedded images should store references (URLs or base64 within the
   encrypted note body), not separate Firestore documents per image. Firestore documents have a 1 MB size limit.

10. **Test with Firestore usage monitoring.** During development of cloud-related features, check the Firebase console usage tab
    to verify that operations are within expected ranges.

### Operation Cost Examples

| User Action                     | Expected Firestore Operations     |
| ------------------------------- | --------------------------------- |
| Create a note (synced)          | 1 write (add to cloud)            |
| Edit a note (synced, debounced) | 1 write (update in cloud)         |
| Delete a note (synced)          | 1 delete                          |
| Open app with sync enabled      | 1-2 reads (check pending changes) |
| Full initial sync (100 notes)   | ~100 reads + ~100 writes          |
| Wipe all notes from cloud       | N deletes (1 per note)            |

### End-to-End Encryption (per-vault) -- safety rules

Cloud encryption uses a per-vault envelope scheme (ADR-012). The encryption key (DEK) lives only in `libs/vaultSession`
(in-memory + secure-storage cache), never in Redux or Firestore. When touching any cloud read/decrypt/write path, follow these
hard rules (each maps to a lesson learned):

1. **Tri-state every read.** A Firestore read is `present | absent | error`, never a boolean. Only act destructively (create,
   overwrite, replace-all, delete) on a **proven** state; bail on `error`, and never let an empty/failed read wipe local data.
   See LL-023 and `readVault()` / `probeVault` / `retrieveCloudData` guards.
2. **Verify before trusting a decrypt.** AES-CBC produces valid-looking garbage on the wrong key without throwing. Use the
   strict, marker-checked `tryDecryptNote` (requires `CONTENT_MAGIC`) on any path that feeds a write; **skip** what doesn't
   verify rather than storing/re-encrypting it. `CryptNote.decrypt` is lenient only for reading legacy pre-marker notes. See
   LL-024.
3. **Migration is non-destructive and idempotent.** Create the vault first (atomic), then sweep: skip notes that don't decrypt,
   and treat an empty legacy key as "skip, never overwrite". Re-running must not corrupt already-migrated data.
4. **Encrypt fails closed.** `CryptNote.encrypt` reads the DEK from `vaultSession` and throws if locked; never emit plaintext as
   if it were ciphertext. Gate cloud queuing on `isVaultUnlocked()`.
5. **Reset/recreate changes the DEK; password change does not.** Other devices detect a new DEK via the canary
   (`dekMatchesVault`) and re-lock; password change re-wraps the same DEK so it must NOT trigger a re-lock. Detection reads the
   vault with a **server read** (`readVault` → `getDocFromServer`), never the Firestore cache — a cached old vault would mask
   the reset and survive restarts (see LL-027).
6. **Crypto must be synchronous and cross-platform.** Use `crypto-js` (PBKDF2-SHA256 + AES) with `@/utils/secureRandom` for
   randomness. Do not reach for WebCrypto (async, native-absent) or a native GCM module (no Tauri WebView). The
   `react-native-get-random-values` polyfill must stay the first import in `_layout.tsx` (LL-025), and any synchronous KDF must
   `await yieldToUI()` after `setLoading(true)` so the spinner paints (LL-026). PBKDF2 (key derivation) runs only at
   setup/unlock/reset/password-change — it is slow on Hermes (no JIT) but never per note; per-note `CryptNote.encrypt` is plain
   AES with the cached DEK and cannot lose notes (local-first save + synchronous encrypt-into-outbox + retried upload).

---

## Naming Conventions

| Entity             | Convention                     | Example                                              |
| ------------------ | ------------------------------ | ---------------------------------------------------- |
| Components         | PascalCase                     | `NoteCard`, `AddNoteOverlayButton`                   |
| Component files    | PascalCase.tsx                 | `NoteCard.tsx`, `AddNoteOverlayButton.tsx`           |
| Hooks              | camelCase with `use` prefix    | `useCloudSync`, `useRouter`                          |
| Hook files         | camelCase.ts                   | `useCloudSync.ts`                                    |
| Redux slices       | camelCase + `Slice` suffix     | `notesSlice.ts`, `settingsSlice.ts`                  |
| Redux actions      | camelCase (verb + noun)        | `addNote`, `deleteCategory`, `setLanguage`           |
| Selectors          | `get` prefix (preferred)       | `getAllNotes`, `getCategories`, `getCurrentCategory` |
| Types/Interfaces   | PascalCase                     | `Note`, `Category`, `SettingsState`                  |
| Type files         | camelCase.ts                   | `note.ts`, `category.ts`, `store.ts`                 |
| Utils              | camelCase functions            | `isStringEmpty`, `formatDateTime`                    |
| Util files         | camelCase.ts                   | `string.ts`, `date.ts`, `crypt.ts`                   |
| Constants          | UPPER_SNAKE_CASE               | `COLOR`, `FONTSIZE`, `PADDING_MARGIN`                |
| i18n keys          | snake_case                     | `title_placeholder`, `no_items`                      |
| Screen functions   | PascalCase + `Screen` suffix   | `HomeScreen`, `GeneralSettingsScreen`                |
| Provider functions | PascalCase + `Provider` suffix | `KanbanDragProvider`                                 |

---

## DO / DON'T Quick Reference

### NEVER

| #   | Rule                                                                                      | Why                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Never install dependencies without approval                                               | Dependency management affects bundle size, security, and compatibility across 3 platforms                                        |
| 2   | Never modify Redux store structure without migration plan                                 | Double-persist architecture means stored data schema changes require careful migration                                           |
| 3   | Never use `style={{}}` in list items                                                      | Creates new object every render, breaks `memo()` memoization, causes list jank                                                   |
| 4   | Never add side effects in reducers                                                        | Reducers must be pure. Put async work, storage writes, i18n calls, and cloud operations in thunks under `src/slicers/thunks/`    |
| 5   | Never import native modules unconditionally on web                                        | Crashes the web build (use platform-split files or dynamic require)                                                              |
| 6   | Never use relative imports across module boundaries                                       | Always use `@/` alias for consistency and refactor safety                                                                        |
| 7   | Never create a component for what props can solve                                         | Extend existing components with optional props before creating new ones                                                          |
| 8   | Never hardcode UI strings                                                                 | All user-visible text must go through `t("section.key")` with all 7 locales                                                      |
| 9   | Never push to main directly                                                               | Use `dev` branch, follow github-issue-workflow skill                                                                             |
| 10  | Never use `type` for object shapes                                                        | Use `interface` for structures, `type` only for unions                                                                           |
| 11  | Never export the `Props` interface                                                        | It is always file-scoped                                                                                                         |
| 12  | Never use `React.memo()`                                                                  | Use `memo()` imported directly from `"react"`                                                                                    |
| 13  | Never use loose equality (`==`) for non-null checks                                       | Use `===` (the `== null` idiom is tolerated but `===` preferred for strings/numbers)                                             |
| 14  | Never use `useStore()`                                                                    | Use `useSelector` for reading state, `useDispatch`/`useAppDispatch` for actions                                                  |
| 15  | Never ship breaking changes to persisted data without migration                           | Users have existing local data and Firestore documents -- breaking changes cause data loss or crashes on update                  |
| 16  | Never waste Firestore operations                                                          | Free tier: 50K reads, 20K writes, 20K deletes per day. Always debounce, batch, and skip unchanged data                           |
| 17  | Never use `\|\|` for defaulting in a boolean/equality context                             | `x \|\| "desc"` evaluates to a truthy string and makes conditions always true. Use `x ?? "desc"` plus `===` instead (see LL-001) |
| 18  | Never import a module with an explicit `.web` / `.native` suffix                          | Always import the base path; Metro picks the variant automatically (see LL-013)                                                  |
| 19  | Never use dynamic `require(...)` as a platform gate when a file split is viable           | Use `.web.ts` / `.native.ts` / `.tsx` file-based resolution instead (see LL-014)                                                 |
| 20  | Never put `Platform.OS` checks inside reducers, selectors, or thunks                      | Keep them pure. Platform defaults belong in platform-split constants (see LL-015)                                                |
| 21  | Never declare memoized selectors as factories that return a new `createSelector` per call | Module-scope `createSelector`, or keyed cache via Reselect 5 `weakMapMemoize` (see LL-016)                                       |
| 22  | Never perform encryption or expensive deterministic transforms inside reducers            | Use middleware/thunks. Reducers must stay pure and fast (see LL-017)                                                             |
| 23  | Never pass object literals as `FlashList` / `FlatList` `extraData`                        | Use primitives or stable memoized objects; inline literals defeat row memoization (see LL-019)                                   |
| 24  | Never subscribe imperative event listeners with unstable callback deps                    | Use a ref for the callback and subscribe once with `[]` deps (see LL-020)                                                        |
| 25  | Never let an errored/empty cloud read drive a destructive write                           | Reads are tri-state (present/absent/error); skip-and-keep-local on doubt, a missed sync self-heals (see LL-023)                  |
| 26  | Never trust a decrypt that didn't throw                                                   | AES-CBC yields valid-looking garbage on the wrong key; verify the `CONTENT_MAGIC` marker before using output (see LL-024)        |
| 27  | Never read authoritative cross-device state with cache-eligible `getDoc`/`getDocs`        | Use `getDocFromServer`/`getDocsFromServer`; the Firestore cache serves stale data and survives restarts (see LL-027)             |

### ALWAYS

| #   | Rule                                                     | Why                                                           |
| --- | -------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Always use `interface Props` for component props         | Consistent pattern across all ~96 components                  |
| 2   | Always use `export default function` for components      | Or `export default memo(Fn)` for memoized list items          |
| 3   | Always use `@/` path alias                               | Cross-module imports must use the alias                       |
| 4   | Always use `import type` for types                       | Ensures type erasure at compile time                          |
| 5   | Always use `StyleSheet.create()` for styles              | At the bottom of the file, after the component                |
| 6   | Always use style constants from `@/constants/styles`     | Never hardcode colors, font sizes, spacing, or border radii   |
| 7   | Always wrap list-rendered components with `memo()`       | NoteCard, TodoItem, OrderedCategoryCard, etc.                 |
| 8   | Always add all 7 locale translations                     | en, it, es, fr, de, zh, ja                                    |
| 9   | Always test web + native for platform-split files        | Behavior can diverge silently                                 |
| 10  | Always use `useTranslation()` for UI text                | Via `react-i18next`                                           |
| 11  | Always use `TouchableOpacity activeOpacity={0.7}`        | Standard pressable pattern                                    |
| 12  | Always place `/* STYLES */` comment above StyleSheet     | Visual separator convention                                   |
| 13  | Always make new fields optional with defaults            | Backward compat: old persisted data must load without crashes |
| 14  | Always estimate Firestore ops for cloud-related features | Document reads/writes/deletes per user action in the PR       |
