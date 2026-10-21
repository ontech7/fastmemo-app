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
10. [On-Device AI](#on-device-ai)
11. [Naming Conventions](#naming-conventions)
12. [DO / DON'T Quick Reference](#do--dont-quick-reference)

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

**Accessibility:** a pressable with no visible text (icon only) MUST have a screen-reader name:

```tsx
<TouchableOpacity
  onPress={toggle}
  accessibilityRole="checkbox" // or "button"
  accessibilityLabel={t("a11y.delete_item")} // i18n, reuse an existing key when one fits
  aria-checked={checked} // state: aria-checked / aria-selected / aria-expanded
>
```

- The state attribute must be valid for the role (the web exposes it to assistive tech as is): an on/off control is a `checkbox`
  with `aria-checked` (format toggles, a selectable note card in delete mode, a menu option with a `selected` state); one choice
  out of a set is a `radio` with `aria-checked` (icon picker, language picker), or a `tab` with `aria-selected` when it switches
  what's shown (category filter, carousel dots in a `tablist`). Never `aria-selected` on a `button` or `menuitem`. Something
  that opens/closes a panel is a `button` with `aria-expanded`.
- A control's name follows what it does now (the FAB is "New note", or "Exit selection" in delete mode).
- A control that only reacts to `onPressIn` (a drag handle) is `accessible={false}`: a screen reader can't drive it.

- Use `accessibilityRole` (not `role`): native `TouchableOpacity` silently drops `role`.
- Use `aria-checked`/`aria-selected`/`aria-expanded` for state (not `accessibilityState`): react-native-web ignores
  `accessibilityState` except `disabled`. `disabled` already maps on both platforms.
- Content that is only hidden visually (opacity 0, translated off-screen, closed overlays) gets `aria-hidden` while inactive, or
  screen readers still reach it, and its pressables `focusable={false}`: on web `aria-hidden` doesn't remove them from the
  keyboard tab order (react-native-web has no `inert`).
- Generic screen-reader names live under `a11y.*`.

### SafeAreaView

Always use the project's custom `@/components/SafeAreaView`, not the one from `react-native-safe-area-context` directly.

### Screens with Text Inputs

Under `KeyboardProvider` (react-native-keyboard-controller, in `_layout`) Android doesn't resize the window for the keyboard: a
plain `ScrollView` leaves a field near the bottom under it, and can't scroll it up. A screen whose inputs can sit low scrolls in
`KeyboardAwareScrollView` (`keyboardShouldPersistTaps="handled"`, `bottomOffset={PADDING_MARGIN.xl}`, as `VaultScaffold`); a
list passes one as `renderScrollComponent` (`app/settings/webhooks.tsx`).

### Icons

All icons come from `react-native-heroicons/outline` (outline variant only). Standard size is 28.

Import each icon by its **deep path**, never from the barrel: `import XIcon from "react-native-heroicons/outline/XIcon"`. Metro
doesn't tree-shake, so a named import from `react-native-heroicons/outline` evaluates all ~300 icons at startup (~50-80ms per
barrel, see LL-034).

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
// Inside a reducer (mutates the Immer draft): every change that syncs stamps a revision, then queues.
note.important = !note.important;
touchNote(note); // rev = max(now, previous + 1): orders versions across devices (ADR-016)
queueCloudAdd(state, note); // only_if_cloudConnected + isVaultUnlocked; the engine re-encrypts at push time
```

**Every reducer that changes a synced note calls `touchNote()`** (or `trashNote` / `untrashNote`, which do), and never writes
`syncedRev` itself: that is the sync engine's bookkeeping (`applyNotesPlan`, `notesPushed`). A change without a new revision is
ignored by the other devices (their copy looks as new). `addNote` takes `rev`, `syncedRev` and `local` from the stored note, not
from the editor's copy. A note last written by an older app version has no `rev`: `touchNote` records its own version as the
base (`baseOf`), and outbox entries an older version left are stamped by `adoptLegacyOutbox` before the first push. A note an
older version _received_ from a newer one keeps that `rev` but has no `syncedRev`. The notes' persist migration (version 1,
`adoptLegacySyncState`) records that `rev` as synced. Without it, the merge would take the note for an unsynced change (LL-056).

`CryptNote.encrypt` takes no key argument anymore -- it reads the per-vault DEK from `vaultSession` and **fails closed** if the
vault is locked (never emits plaintext). The old global `secretKey` argument and build-time `SECRET_KEY` are superseded by
per-vault envelope encryption (see ADR-012); the legacy key survives only as the migration `legacyKey` and is removed after the
migration window. Deletes/detaches use a content-stripped `deletionStub` so they need no DEK and propagate even while locked.

The sync engine (`libs/cloud/syncEngine.ts`) drains the outbox, and `notesPushed` / `categoriesPushed` dequeue what a push
committed. **All cloud I/O goes through the `CloudBackend`** (`cloud` from `@/libs/cloud`): only `libs/cloud/firebaseBackend.ts`
imports `firebase/*` (phase 4 adds a second backend behind the same contract). Merge rules live in `libs/cloud/merge.ts` as pure
functions: change them there, with a case in `scripts/sync.test.mjs`.

**Cloud sync is silent by design.** Do NOT surface transient sync failures to the user (banners, toasts, status fields). The
offline-first flow is:

- The engine runs while connected and unlocked; offline, its listeners wait and pushes fail into a backoff (2s -> 5 min),
  restarted when the network or the app comes back.
- On transient failures, items stay in the outbox and are retried automatically; nothing leaves the outbox until committed.
- Only handshake-level failures (invalid credentials, device evicted) and the user-visible outcomes of a merge (data synced, a
  conflict copy made, the open note trashed elsewhere) are surfaced, from `SyncOnProvider` / `useLiveNote`.

If observability is needed for a new cloud-sync feature, use Sentry breadcrumbs inside the engine, not Redux state. See LL-004.

**Queue entries are exclusive per id** (LL-033): `queueCloudAdd` / `queueCloudDelete` drop the id from the opposite queue;
`notesPushed` dequeues only if the entry is still the pushed object (a newer version queued meanwhile survives); the backend's
push writes each fan-out entry with a field path and deletes the id from the device's other queues in the same transaction.

**Never decide on a cloud snapshot that isn't server-confirmed** (`DevicesSnapshot.fromServer`), and **acknowledge only after
the merge is persisted** (`persistor.flush()`), through `ackChanges` (it refuses when the sender queued more meanwhile).

### Note Editor Commits and Persistence

- Editors change notes through `setNoteAsync` from `useNoteEditor`: edits stay in local state and reach Redux in batches
  (debounce 500ms / max wait 2s on native, 300ms / 1s on web). Never dispatch `addNote` per keystroke (LL-031).
- Before acting on the **stored** note (delete, detach, make offline, sync, change category, fire a webhook, navigate away
  programmatically), call `flushNote()` so the action sees the latest edits.
- `flushOnExit` (installed once in `_layout`) flushes pending batches and `persistor.flush()` when the app leaves the
  foreground, the page is hidden, or a desktop window closes; edits that arrive while the app is in the background are written
  at once (JS timers don't run there, LL-032). New editors must register through `useNoteEditor`, not their own timers.
- Every `PersistConfig` sets `timeout: 0`: a slow read must never rehydrate the empty initial state (LL-029). Notes persist only
  through the note store (ADR-018): one value per note, written only when that note's object changed. Change notes immutably
  (reducers, never in place outside them): a note mutated in place isn't seen as changed and isn't written. Anything that
  deletes all notes for good also removes their copies outside the store (`noteStore.removeCopies()`, as `wipeNotesThunk`).
- Device file I/O that runs per note goes through the asynchronous API, a few calls at a time: the synchronous one costs
  milliseconds per file on the JS thread (LL-053). File names given to expo-file-system are the real names, without `%` (`File`
  segments are encoded, legacy URIs decoded, LL-052).

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

1. Add the key to ALL 7 locale files: `en.ts`, `it.ts`, `es.ts`, `fr.ts`, `de.ts`, `zh.ts`, `ja.ts` (a missing key silently
   falls back to English: the whole vault UI shipped untranslated in 5 locales that way). Never translate the key name itself
   (`es` once had `título:` instead of `title:`)
2. Place it in the correct section (or create a new section if it's a new feature)
3. Use interpolation for dynamic values: `"Created {{count}} notes"`
4. Use `useTranslation()` hook in the component: `const { t } = useTranslation();`

### Interpolation

```ts
t("trashednotes.countdown", { days: 3, hours: 12, minutes: 30 });
// -> "Delete in: 3 day(s), 12 hour(s) and 30 minute(s)"
```

Note: Pluralization currently uses manual "(s)" pattern rather than i18next's built-in plural system.

A sentence that contains values is **one key** with interpolation, never translated fragments concatenated in code (word order
differs per language, see LL-035). When part of the sentence is styled, use `<Trans>` with a component placeholder:

```tsx
// en: progress: "<hl>{{done}}</hl> of {{total}} completed"   zh: progress: "已完成 <hl>{{done}}</hl>/{{total}}"
<Text style={styles.subtitle}>
  <Trans t={t} i18nKey="note.progress" values={{ done, total }} components={{ hl: <Text style={styles.count} /> }} />
</Text>
```

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
- **Inside an already-web file, for Tauri-only paths:** e.g. `await import("@tauri-apps/plugin-fs")` inside an `if (isTauri())`
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

### Raw DOM Elements in Web Files

Raw DOM nodes (`<div>` in a `.web.tsx`, e.g. for Embla) don't get react-native-web's `box-sizing: border-box`; set
`boxSizing: "border-box"` when they're sized with padding. UI that can be resized (web, Tauri windows) reads dimensions with
`useWindowDimensions()`, never `Dimensions.get()` at module scope (LL-036).

### Desktop Keyboard Shortcuts and Menu

On desktop (Tauri), `useKeyboardShortcuts` (in `_layout`) makes a key press a control on screen, marked with a `SHORTCUT_TARGET`
`testID` (`@/constants/shortcuts`): Esc presses `BackButton`, Cmd/Ctrl+F focuses a search field or presses the note's find
button. A key does nothing when its control is covered (a dialog, menu or dimmed overlay over its center), so a shortcut never
does more than a click could. Esc in a text field only leaves the field, and F5/Cmd/Ctrl+R are blocked in release builds (a
reload drops the edits not yet saved).

Commands that start from the home screen (Cmd/Ctrl+N new note, the menu's Settings, Help and New Text Note/List/Kanban
Board/Code Note, which go through the note-type menu) first press the back buttons one screen at a time, the same path and saves
as clicking them, and stop at a screen whose back button is off or covered (`@/libs/desktopCommands`). The macOS menu bar
(`installDesktopMenu`, `src-tauri/src/lib.rs`) runs the same commands: its labels come from i18n (`menu.*`, Apple's wording per
language) and are sent again on every language change. Windows and Linux have no menu bar. A shortcut the page handles never
reaches the menu item with the same key; one it leaves alone (nothing to do, an IME composition) does, so a held key's repeats
are stopped in the page. One command at a time, with a 1 s pause after each (a second Cmd+N would close the note the first
opened), and none while a native open/save panel is up (`withNativeDialog` around the dialog plugin's `open`/`save`). Leaving a
form this way drops what was typed there, as clicking back would; the note editors save as they go.

- A screen's back control is `BackButton` (or `CloseButton`), so Esc works there; a search field is `SearchInput` or carries
  `testID={SHORTCUT_TARGET.find}`.
- `BackButton shortcut={false}` where leaving would lose what's on screen (the one-time recovery key, a form being typed:
  report, connect, recovery key entry) and while a mode is on that Android's back ends first (trash selection, category
  organizing). The home FAB is the Esc target in delete mode, since it ends the selection.
- A control that changes meaning (the FAB in delete mode, the find button once the bar is open) changes or drops its `testID`
  meanwhile.
- The window listens in the capture phase: react-native-web's `TextInput` stops keys from bubbling. Iframes (the rich text and
  code editors) get the same listener when they load.

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

4. **Listen, don't poll.** The engine keeps one listener on `connectedDevices` and one on the vault doc (a changed doc costs one
   read per listening device); every 5 min and on resume it re-opens the transport and reads the device docs (a read "from the
   server" of a listened collection is answered by the listener, so it can't replace this). Don't add intervals that read the
   cloud.

5. **Debounce rapid changes.** Editors commit in batches (`useNoteEditor`); the engine pushes 200ms after the outbox changes and
   at most every 2 s, one transaction per batch of up to 200 entries; receivers ack once the sender is quiet for 5 s (at most 30
   s). Do not bypass any of them: each push and each ack also costs a read on every listening device.

6. **Delete operations are cheap but not free.** The 20K delete limit is generous, but bulk operations (wipe all notes, wipe
   categories) should still use batch deletes and warn the user if the operation is large.

7. **Count operations in new features.** When implementing a feature that interacts with cloud sync, estimate the Firestore
   operations per user action:
   - How many reads does it trigger?
   - How many writes?
   - Does it scale linearly with the number of notes/categories?

   Document the estimate in the PR description.

8. **Avoid redundant device sync.** A push writes each note doc and one merged update of the sender's device doc (queues,
   recipients, `lastSync`) per transaction, and nothing when the cloud took none of it. Never write a document others listen to
   (`connectedDevices`, `vault`) when nothing changed: a no-op write still wakes every listener (one read each), and a write
   that triggers the next one loops. When adding new sync logic, verify that you are not duplicating writes to the same
   document.

9. **Never store large blobs in Firestore.** Notes with embedded images should store references (URLs or base64 within the
   encrypted note body), not separate Firestore documents per image. Firestore documents have a 1 MiB size limit and 40,000
   index entries (every field of every nested map counts: a queued note is ~50), whichever comes first: size anything that
   accumulates in one document (the fan-out queues, `planFanout`) by both.

10. **Test with Firestore usage monitoring.** During development of cloud-related features, check the Firebase console usage tab
    to verify that operations are within expected ranges.

11. **One `lastSync` write per batch.** `lastSync` rides on the push transaction's device-doc update (it's only displayed in the
    devices list, see LL-021); a full sync with nothing to push calls `touchLastSync` once.

### Operation Cost Examples

| User Action                   | Expected Firestore Operations                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Create / edit a note (synced) | 2 reads (note + device doc, in the guard transaction) + 2 writes per push (at most every 2 s) |
| ...on each other device       | 1 listener read per push; 1 ack (1 read + 1 write) after 5 s quiet, read by every device      |
| Delete a note (synced)        | 2 reads + 1 delete + 2 writes (device doc + tombstone) per push                               |
| Open app with sync enabled    | N device docs + 1 vault read (listeners' first snapshot)                                      |
| Idle, app open                | N device docs every 5 min; presence: 1 write per open/close, 1 per 5 min while a note is open |
| Typing for an hour, 3 devices | ~9k reads + ~3.7k writes                                                                      |
| Full sync (100 notes)         | ~100 reads + 1 per tombstone + writes only for what this device has newer                     |
| Wipe all notes from cloud     | N deletes, tombstones included (batched, 200 per batch)                                       |

### FastMemo Server (self-hosted, ADR-017)

The server has no quota, but its dashboard counts operations the way Firestore bills them, and the same code paths serve both
clouds, so the rules above still apply. In addition:

1. **Nothing above `CloudBackend` knows which cloud it is.** Ask `cloud` for what differs (`deviceLimit`, `pacing`), key
   per-cloud data with `cloudScope(settings)` (the DEK cache, the server token), and keep user-facing texts provider-neutral
   ("whoever stores them", not "Google"). `configs.cloud.deviceLimit` is the Firebase backend's own value (LL-048).
2. **The server's protocol only grows.** `/v1` keeps working for every app version that speaks it: add optional fields; anything
   else is a new protocol number, which older apps refuse at the handshake.
3. **Same guard on both sides.** A change to the push guard or the merge rules is made in the app's adapters and in the server
   (`fastmemo-server/src/service.ts`) together, and `scripts/sync-server.test.mjs` passes against the real server.
4. **An id a client caches must not repeat across a restore.** Restoring a backup rewinds the server's counters; tie such ids to
   the boot (the feed's page ids do, LL-049).
5. **HTTPS by default, HTTP only with a warning** (ADR-017). Android, macOS and Linux can reach an `http://` server (the
   cleartext plugin, `src-tauri/Info.plist`); an `https://` page (the web app, Windows) can't, except this machine. UI copy
   recommends HTTPS (a reverse proxy, Tailscale); an http address is saved only after the warning dialog. The access key travels
   only to connect: never add it to calls an enrolled device makes with its token.
6. **"Removed" is the server refusing the token held now.** Never a token that can't be read (read it again), nor a refusal of a
   token a registration replaced; write and remove tokens in order (LL-050).
7. **Settings changes don't re-enroll.** New settings are proven with `cloud.check` (its own connection) before the working one
   is touched; the same cloud then only takes them, another cloud is left first. Change the connection only with the engine
   stopped and `idle()`; a task that outlived `stop()` must not act (`outlived`) (LL-050).
8. **A request carries the connection it started on.** Re-check after every `await` that the backend wasn't re-initialised
   before reading its URL, key or token: another server's key must never go to this one.
9. **An error the client acts on must be readable.** The server drains an oversized body before its `413`; the client never
   retries a timeout at the same size forever (LL-051).

| User Action (server)          | Server operations                                                           |
| ----------------------------- | --------------------------------------------------------------------------- |
| Create / edit a note (synced) | 1 push (1 read + 1 write per note), every other device: 1 sync read + 1 ack |
| Idle, app open                | 1 long poll every 25 s per device, counted as 1 read (the vault check)      |
| Full sync (100 notes)         | ~100 reads + 1 per tombstone + writes only for what this device has newer   |

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

## On-Device AI

Everything goes through `@/libs/ai` (ADR-004). `context.ts` is the only file that talks to llama.rn.

1. **Every completion passes `CHAT_TEMPLATE`** (`jinja: true, enable_thinking: false, reasoning_format: "none"`) and its
   action's `ACTION_SAMPLING` + `ACTION_MAX_TOKENS`. A new action adds an entry to both maps, a prompt in
   `EDITOR_SYSTEM_PROMPTS`, and a fixture in `evalFixtures.ts`.
2. **Run completions through `whileBusy`** (as `generateEditorContent` and `searchHelpByIntent` do): it queues them (one context
   runs one completion; a second fails "Context is busy") and the idle/background release never frees a context under a running
   one. A run takes the cancel generation when it is called and checks it after the queue, after the load and at every token:
   `stopCompletion` alone is lost while the model loads.
3. **Nothing the model writes replaces user content without a look.** A rewrite streams into a before/after preview (or the
   dictation sheet), Apply waits for the end, Cancel stops the model (`cancelCommand`) and keeps the original. A rewrite action
   gets a `REWRITE_LENGTH_RATIO` range so `isPlausibleRewrite` can discard a runaway answer.
4. **Number each run** (`runRef`/`aiRunRef`): a cancelled or superseded run never writes into the UI, and unmounting advances
   the number and calls `cancelCommand`. An interrupted or token-limited answer is never applied (`cancelled` / `too_long`): it
   is cut short. One exception, never shown alone: a part of a long note's summary keeps its complete sentences (only the merge
   reads it).
5. **Pre-warm where an action is likely** (`prewarmContext` when the dictation sheet or the AI menu opens), never at app start:
   a loaded 2B holds over a gigabyte.
6. **Measure before changing a prompt, sampling or tier**: run Developer options -> AI evaluation on a phone before and after,
   and compare the saved JSON reports.
7. **A note's text goes to the model through `rewriteNote` / `summarizeNote`** (`libs/ai/longNote.ts`), never whole: they work
   line by line on the HTML (`blocks.ts`) and give HTML back with the structure kept. Never `stripHtml` a note, rewrite it and
   `setContentHTML` the plain answer.
8. **Remove from the user's text only what the app can prove it added** (LL-058): `cleanAnswer` strips quotes only when they
   wrap the whole answer, not the input, and no other quote of the kind is inside (dialogue keeps its quotes); a "Title:" or
   "Summary:" label only from a title or a summary. An AI summary is recognized by its `data-fm="summary"` mark at the very top,
   never by a label's wording, and on doubt (the mark copied onto the next line) nothing is taken for it.

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
| 28  | Never import icons from the `react-native-heroicons` barrels                              | Each barrel evaluates ~300 icons at startup; use deep imports (see LL-034)                                                       |
| 29  | Never dispatch a persisted-slice update per keystroke                                     | Every commit re-serializes the whole slice; editors batch through `setNoteAsync` (see LL-031)                                    |
| 30  | Never rely on a JS timer for work that must finish before the app may be killed           | Android pauses timers in background; flush synchronously (see LL-032)                                                            |
| 31  | Never concatenate translated fragments into a sentence                                    | Word order differs per language; one interpolated key, `<Trans>` for styled parts (see LL-035)                                   |
| 32  | Never write a cloud document other devices listen to when nothing changed                 | Each write costs a read per listener and can wake the loop that writes again (see LL-044)                                        |
| 33  | Never size what accumulates in one Firestore document by bytes alone                      | The 40,000 index-entry limit comes first (~50 per queued note); budget both (see LL-043)                                         |
| 34  | Never read a per-cloud value from config, or name a provider, above `CloudBackend`        | Two clouds: ask `cloud` (`deviceLimit`, `pacing`), key by `cloudScope`, keep texts neutral (see LL-048)                          |
| 35  | Never put a `%` in a file name given to expo-file-system                                  | `File` segments are encoded (`%` -> `%25`), legacy URIs decoded: either way it names another file (see LL-052)                   |
| 36  | Never trust a cache of what's stored where another writer can write (browser tabs)        | Check what's there first, under a lock; a write skipped for a newer one settles with it (see LL-053)                             |
| 37  | Never keep a copy of user data without a wipe path and an end date                        | "Wipe data" must reach it; record migrations instead of inferring them from absent data (see LL-054)                             |
| 38  | Never apply an AI answer that stopped early, or cancel only the native completion         | Queue completions, check the cancel generation at every step, drop `interrupted`/token-limited answers (see LL-055)              |
| 39  | Never give persisted data a new meaning without bumping its persist `version`             | Migrate once, by version, never guess at read time; test older versions' data as they store it, newer fields included (LL-056)   |
| 40  | Never interpret a server answer that came through a redirect                              | Fetch drops the token across hosts: the refusal reads as "removed"; absent/removed only with the server's error code (LL-059)    |
| 41  | Never turn a note's HTML or text into DOM unsanitized                                     | Notes come from imports, other devices: DOMPurify (`NOTE_HTML_CONFIG`, `addNoteHooks`), `escapeHtml`/`textContent` (LL-060)      |
| 42  | Never send a block format or list command to pell directly                                | They nest and never turn off: go through `window.__fm.toggle` (RICH_TEXT_SCRIPT), test in `scripts/richtext.test.mjs` (LL-062)   |
| 43  | Never leave an element selected after a page-script edit                                  | A key replaces it: put back the selection saved (as a `Range`) before the `execCommand`, as `__fm.image` does (LL-065)           |
| 44  | Never judge or measure performance on a debuggable build                                  | Its Java/Kotlin runs interpreted: a startup measured 10x slower (LL-066). Measure a release APK not marked debuggable            |

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
| 15  | Always call `flushNote()` before acting on a stored note | Delete/detach/sync/category change must see the latest edits  |
| 16  | Always set `timeout: 0` on a `PersistConfig`             | A timed-out read rehydrates empty state and wipes storage     |
| 17  | Always keep sync queue entries exclusive per id          | Latest operation replaces the others (see LL-033)             |
