# FastMemo - AI Agent Instructions

> **Read this file first.** It is the entry point for all AI agents working on this project.

## Project Summary

FastMemo is a cross-platform note-taking app (Android, Web, Desktop via Tauri) built with Expo SDK 53, React Native 0.79, React
19, and TypeScript 5.8. It supports four note types (text, todo, kanban, code), on-device AI (llama.rn with Qwen 2.5 GGUF
models), encrypted cloud sync (Firebase), biometric protection, webhooks, voice recognition, and 7-language localization.
Desktop builds use Tauri 1.x (Rust).

## Knowledge Base

Before making changes, read the relevant knowledge files under `.agents/knowledge/`:

| File                                                       | When to Read                     | Content                                                            |
| ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| [ARCHITECTURE.md](.agents/knowledge/ARCHITECTURE.md)       | **Always** (at least skim)       | Project structure, component map, data flow, module relationships  |
| [CONVENTIONS.md](.agents/knowledge/CONVENTIONS.md)         | **Before writing any code**      | Coding standards, naming rules, DO/DON'T rules, patterns to follow |
| [DECISIONS.md](.agents/knowledge/DECISIONS.md)             | When questioning a design choice | Why specific libraries/patterns were chosen, trade-offs            |
| [LESSONS_LEARNED.md](.agents/knowledge/LESSONS_LEARNED.md) | **Before starting work**         | Past mistakes, fixes, rules derived from incidents                 |

## Agent Skills

**Always check and load the relevant skills before starting work.** Skills contain domain-specific rules and patterns that
prevent common mistakes. Load a skill when your task matches its trigger conditions.

| Skill                         | When to Load                                                                                           | Content                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `vercel-react-native-skills/` | Building/modifying components, optimizing lists, animations, or any React Native UI work               | 36 performance rules across 13 categories (list perf, animations, state, UI patterns, navigation)                         |
| `redux-toolkit/`              | Working on Redux slices, selectors, thunks, or state management logic                                  | RTK best practices, slice structure, async thunks, memoized selectors, TypeScript integration                             |
| `tauri-v2/`                   | Touching anything under `src-tauri/`, desktop-specific features, Rust commands, IPC, or desktop builds | Tauri v2 commands, capabilities, permissions, IPC patterns, plugin setup, troubleshooting                                 |
| `github-issue-workflow/`      | Starting work on a GitHub issue, creating a PR, or preparing a release                                 | Dev/main branching model, conventional commits, PR format, version bumping, changelog updates across 5 files + 7 locales  |
| `github-issue-template/`      | Creating a new GitHub issue (LL-\* entry, bug, refactor, feature) via `gh`                             | Canonical issue body template, title prefixes, label rules, HEREDOC command shape, cross-referencing with LESSONS_LEARNED |

Skills are in `.agents/skills/`. Each has a `SKILL.md` with full instructions.

## When an Issue Is Resolved (Knowledge Sync)

When a GitHub issue that tracks a `LL-NNN` entry is closed (fix merged), the agent landing the fix MUST update the knowledge
base in the same session. See the full "Tracking and Resolution Protocol" in
[LESSONS_LEARNED.md](.agents/knowledge/LESSONS_LEARNED.md). At minimum:

1. Set `**Status:** Resolved` on the LL entry and add `**Resolved:** YYYY-MM-DD` + `**Resolved in:** <SHA or PR #>`.
2. Reflect any new rule in `CONVENTIONS.md` and/or the `NEVER Do` / `ALWAYS Do` lists below.
3. Update `ARCHITECTURE.md` if the fix changed the structure, and `DECISIONS.md` if it superseded a prior decision.
4. Never delete the LL entry -- history is the learning.

## Critical Rules (Quick Reference)

These are the most important rules. For the full list, see CONVENTIONS.md.

### NEVER Do

1. **Never install new dependencies** without explicit approval from the developer
2. **Never modify the Redux store structure** (double-persist architecture, see ADR-003) without first doing an empirical audit
   of AsyncStorage contents on a real device with user data -- removing keys based on a model-only assumption can delete live
   state (see LL-003 + LL-022)
3. **Never use inline `style={{}}` objects** in list item components (NoteCard, TodoItem, KanbanCard) -- these create new
   objects every render and break memoization
4. **Never add side effects inside Redux reducers** -- use thunks or middleware instead (existing violations are documented, not
   to be replicated)
5. **Never import native-only modules unconditionally** on web -- use the file-based platform-split pattern (.web.ts /
   .native.ts / .tsx) and let Metro resolve at bundle time
6. **Never use relative imports** when the `@/` alias covers the path -- always prefer `@/components/...`, `@/utils/...`,
   `@/libs/...`
7. **Never create a new component** for something that can be achieved by making an existing component accept props
8. **Never hardcode strings** that appear in the UI -- use the i18n system (`t("section.key")`)
9. **Never push directly to main** -- use the dev branch and follow the github-issue-workflow skill
10. **Never ship breaking changes** to persisted data (Redux state, Firestore documents) without a migration path -- users have
    existing data that must keep working after updates
11. **Never waste Firestore operations** -- free tier has 50K reads, 20K writes, 20K deletes/day. Debounce, batch, skip
    unchanged data, and estimate ops for every cloud-related feature
12. **Never import with an explicit `.web` / `.native` suffix** -- always use the base path; Metro picks the variant
    automatically
13. **Never use dynamic `require(...)` as a platform gate** when a file-based split is viable. Dynamic require is reserved for
    Metro asset imports and Tauri-only runtime branches inside an already-web file
14. **Never put `Platform.OS` checks inside Redux reducers, selectors, or thunks** -- keep them pure. Platform defaults belong
    in platform-split constants
15. **Never declare memoized selectors as factories that return a new `createSelector` per call** -- module-scope only, or use a
    keyed cache
16. **Never surface cloud-sync transient failures to the user** (no banners/toasts for `.rejected` of sync thunks, no
    `syncStatus`/`syncError` in slices). Cloud sync is silent by design: offline is not an error, the outbox retries
    automatically, and only handshake-level failures are surfaced (see LL-004)

### ALWAYS Do

1. **Always use `interface Props`** for component prop types (never inline, never `type`, always named `Props`)
2. **Always use `export default function ComponentName`** for components (or `export default memo(ComponentName)` for list
   items)
3. **Always use the `@/` path alias** for imports across module boundaries
4. **Always use `import type { ... }` from "..."** for type-only imports
5. **Always use `StyleSheet.create()`** at the bottom of component files for styles
6. **Always use style constants** from `@/constants/styles` (COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, BORDER)
7. **Always wrap memoized components** (NoteCard, TodoItem, OrderedCategoryCard, etc.) with `memo()` from react
8. **Always add translations for all 7 locales** when adding new UI strings (en, it, es, fr, de, zh, ja)
9. **Always test on both web and native** when touching platform-split files

## Tech Stack (Quick Reference)

| Layer      | Technology                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Framework  | Expo SDK 53, React Native 0.79, React 19                                                       |
| Language   | TypeScript 5.8 (path alias `@/*` -> `./src/*`)                                                 |
| Routing    | expo-router 5.1 (file-based, typed routes)                                                     |
| State      | Redux Toolkit 2.8 + Redux Persist (filesystem for notes, AsyncStorage for settings/categories) |
| Desktop    | Tauri 1.x (Rust)                                                                               |
| Cloud      | Firebase Firestore (encrypted sync)                                                            |
| AI         | llama.rn 0.12 (Qwen 2.5 GGUF, on-device)                                                       |
| Editor     | CodeMirror 6 (via WebView)                                                                     |
| i18n       | i18next + react-i18next (7 languages, single namespace)                                        |
| Animations | react-native-reanimated 3.17                                                                   |
| Lists      | @shopify/flash-list 2.0                                                                        |
| Monitoring | Sentry                                                                                         |

## Directory Map

```
src/
  app/          -> Screens (expo-router file-based routing)
  components/   -> UI components (domain-grouped: buttons/, cards/, notes/, kanban/, settings/, etc.)
  slicers/      -> Redux slices (notesSlice, categoriesSlice, settingsSlice) + thunks/
  types/        -> TypeScript type definitions (barrel export via index.ts)
  hooks/        -> Custom hooks (useCloudSync, useRouter, useSecret, useNetInfo, useTimeoutTask)
  libs/         -> Third-party wrappers (ai/, haptics/, i18n/, storage/, firebase, registry, localization)
  utils/        -> Pure utility functions (sort, string, date, crypt, toast, webhook, export, platform, openUrl)
  providers/    -> React context providers (KanbanDragProvider, SyncOnProvider)
  constants/    -> Static constants (styles, icons, code-languages, note-types)
  configs/      -> App configuration (environment, defaults, business rules)
  assets/       -> Static assets (images, lottie animations)
```
