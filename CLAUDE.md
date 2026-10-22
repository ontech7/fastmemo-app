# FastMemo - AI Agent Instructions

> **Read this file first.** It is the entry point for all AI agents working on this project.

## Project Summary

FastMemo is a cross-platform note-taking app (Android, Web, Desktop via Tauri) built with Expo SDK 58, React Native 0.88, React
19, and TypeScript 6.0. It supports four note types (text, todo, kanban, code), on-device AI (llama.rn with Qwen3.5 GGUF
models), encrypted cloud sync (Firebase), biometric protection, webhooks, voice recognition, and 7-language localization.
Desktop builds use Tauri 2.x (Rust).

## Knowledge Base

Before making changes, read the relevant knowledge files under `.claude/knowledge/`:

| File                                                       | When to Read                     | Content                                                            |
| ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| [ARCHITECTURE.md](.claude/knowledge/ARCHITECTURE.md)       | **Always** (at least skim)       | Project structure, component map, data flow, module relationships  |
| [CONVENTIONS.md](.claude/knowledge/CONVENTIONS.md)         | **Before writing any code**      | Coding standards, naming rules, DO/DON'T rules, patterns to follow |
| [DECISIONS.md](.claude/knowledge/DECISIONS.md)             | When questioning a design choice | Why specific libraries/patterns were chosen, trade-offs            |
| [LESSONS_LEARNED.md](.claude/knowledge/LESSONS_LEARNED.md) | **Before starting work**         | Past mistakes, fixes, rules derived from incidents                 |

## Agent Skills

**Always check and load the relevant skills before starting work.** Skills contain domain-specific rules and patterns that
prevent common mistakes. Load a skill when your task matches its trigger conditions.

| Skill                         | When to Load                                                                                                                                                    | Content                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-design/`            | **Any visual/frontend work** — building or restyling components/screens, colors, gradients, glass/blur, fonts, spacing, layout, redesigns                       | Design system + UI rework rules: tokens, Geist, accent solid+glow, deep-bg + corner glow, glass/blur perf guardrails, layout & safe-area conventions, reusable `ui/` primitives                |
| `vercel-react-native-skills/` | Building/modifying components, optimizing lists, animations, or any React Native UI work                                                                        | 36 performance rules across 13 categories (list perf, animations, state, UI patterns, navigation)                                                                                              |
| `redux-toolkit/`              | Working on Redux slices, selectors, thunks, or state management logic                                                                                           | RTK best practices, slice structure, async thunks, memoized selectors, TypeScript integration                                                                                                  |
| `tauri-v2/`                   | Touching anything under `src-tauri/`, desktop-specific features, Rust commands, IPC, or desktop builds                                                          | Tauri v2 commands, capabilities, permissions, IPC patterns, plugin setup, troubleshooting                                                                                                      |
| `prepare-release/`            | Preparing a release — bumping versions and writing changelogs/translations (or a desktop hotfix)                                                                | Two-track (mobile/desktop) versioning across 6 files, verbose developer changelogs (`docs/`) vs concise user changelogs (`changelog.tsx` + 7 i18n locales), README badges, desktop hotfix flow |
| `mobile-release/`             | **User-invoked only (`/mobile-release`)** — shipping to real users: a mobile OTA or a store release (Android build + Play Console, desktop in the same release) | OTA vs build choice, `yarn ota:check` fingerprint gate, Publish OTA / `publish` workflow dispatch, desktop-version guards, what stays manual (the build, the pushes), `scripts/state.sh`       |
| `store-screenshots/`          | Creating or updating the Google Play store screenshots (phone, 7"/10" tablet, any language)                                                                     | The HTML renderer in `store-screenshots/` (`node store-screenshots/render.mjs`), Play Store size rules, approved design rules, how to add copy/shots/languages                                 |

Skills are in `.claude/skills/`. Each has a `SKILL.md` with full instructions.

## When an Issue Is Resolved (Knowledge Sync)

When a GitHub issue that tracks a `LL-NNN` entry is closed (fix merged), the agent landing the fix MUST update the knowledge
base in the same session. See the full "Tracking and Resolution Protocol" in
[LESSONS_LEARNED.md](.claude/knowledge/LESSONS_LEARNED.md). At minimum:

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
    automatically, and only handshake-level failures are surfaced (see LL-004). The one exception: a cloud that hasn't
    answered for 30 s while the device is online gets a quiet line in the home, gone once it answers (ADR-029)
17. **Never let an errored/empty cloud read drive a destructive write** -- model reads as tri-state (present/absent/error), and
    on doubt skip-and-keep-local (a missed sync self-heals; a wrongful overwrite is permanent). See LL-023 and ADR-012
18. **Never trust a decrypt that didn't throw** -- AES-CBC produces valid-looking garbage on the wrong key. Verify the
    `CONTENT_MAGIC` marker (`tryDecryptNote`) before treating decrypted output as real on any write path. See LL-024
19. **Never read authoritative cross-device state with cache-eligible `getDoc`/`getDocs`** -- vault presence, DEK staleness, and
    any "has another device changed this?" check must use `getDocFromServer`/`getDocsFromServer`. The Firestore local cache can
    serve stale data and survives restarts. Treat offline/error as "unknown -> skip", not as an answer. See LL-027
20. **Never import icons from the `react-native-heroicons` barrels** -- use the deep path
    (`react-native-heroicons/outline/XIcon`); each barrel evaluates ~300 icons at startup (LL-034)
21. **Never keep the same id in two sync queues** (local outbox `add`/`delete`, or a device doc's `addNotes`/`deleteNotes`/
    `detachNotes`) -- the latest operation replaces the others (`queueCloudAdd`/`queueCloudDelete`, the backend's push,
    `notesPushed`). See LL-033
22. **Never touch the cloud outside the `CloudBackend`** -- only `src/libs/cloud/firebaseBackend.ts` imports `firebase/*`;
    everything else uses `cloud` from `@/libs/cloud` or the sync engine; `serverBackend.ts` is the only code speaking the
    FastMemo server's API (ADR-017). Merge rules live in `libs/cloud/merge.ts`, tested by `scripts/sync.test.mjs` (ADR-016)
23. **Never write a cloud document other devices listen to when nothing changed** (`connectedDevices`, `vault`): each write
    costs a read on every listener and can wake the loop that writes again. Size anything that accumulates in one Firestore
    document by bytes **and** index entries (40,000 max, ~50 per queued note). See LL-043, LL-044

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
10. **Always call `flushNote()`** before acting on a note's stored copy (delete, detach, sync, change category): editors commit
    to Redux in batches (ADR-013, LL-031)
11. **Always set `timeout: 0`** on a redux-persist config: a timed-out read rehydrates empty state and wipes storage (LL-029). A
    read that throws does the same: never write a key back after its read failed (LL-039)
12. **Always give an icon-only pressable `accessibilityRole` + `accessibilityLabel`** (i18n, `a11y.*`), with state as
    `aria-checked` (checkbox/radio), `aria-selected` (tab only) or `aria-expanded` -- not `role`/`accessibilityState`, which one
    platform drops; hidden content gets `aria-hidden` + `focusable={false}` (CONVENTIONS)
13. **Always stamp a revision (`touchNote`) in a reducer that changes a synced note** -- other devices ignore a change without a
    newer revision; `syncedRev` is written only by the sync engine's reducers (ADR-016, LL-040)

## Tech Stack (Quick Reference)

| Layer      | Technology                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Framework  | Expo SDK 58, React Native 0.88 (New Architecture, Hermes V1), React 19.3                           |
| Language   | TypeScript 6.0 (path alias `@/*` -> `./src/*`)                                                     |
| Routing    | expo-router 58 (file-based, typed routes)                                                          |
| State      | Redux Toolkit 2.8 + Redux Persist (notes one value per note: ADR-018; AsyncStorage for the rest)   |
| Desktop    | Tauri 2.x (Rust, capabilities in `src-tauri/capabilities/`)                                        |
| Cloud      | Firestore or a self-hosted FastMemo server behind `CloudBackend` (ADR-016, ADR-017), E2E (ADR-012) |
| AI         | llama.rn 0.12 (Qwen3.5 0.8B/2B/4B GGUF, on-device, thinking off -- ADR-004)                        |
| Editor     | CodeMirror 6 (via WebView)                                                                         |
| i18n       | i18next + react-i18next (7 languages, single namespace)                                            |
| Animations | react-native-reanimated 4.7 (+ react-native-worklets)                                              |
| Lists      | @shopify/flash-list 2.3                                                                            |
| Monitoring | Sentry                                                                                             |
| OTA        | EAS Update (Android, fingerprint runtime, manual `Publish OTA` workflow -- ADR-014)                |

## Directory Map

```
app/            -> Screens (expo-router file-based routing, at project root)
assets/         -> Static assets (images, lottie animations, at project root)
modules/        -> Local Expo native modules, autolinked (fastmemo-crypto: native PBKDF2, see ADR-012)
src/
  components/   -> UI components (domain-grouped: buttons/, cards/, notes/, kanban/, settings/, etc.)
  slicers/      -> Redux slices (notesSlice, categoriesSlice, settingsSlice) + thunks/
  types/        -> TypeScript type definitions (barrel export via index.ts)
  hooks/        -> Custom hooks (useCloudSync, useLiveNote, useRouter, useSecret, useNetInfo, useTimeoutTask, useVaultUnlocked, useVaultPrompt, useVaultProgress)
  libs/         -> Third-party wrappers (ai/, cloud/ (sync engine + Firestore backend), haptics/, i18n/, storage/, registry, localization, secureStore, vaultSession, vaultManager, vaultPrompt, vaultProgress, net, desktopCommands, desktopMenu)
  utils/        -> Pure utility functions (sort, string, date, crypt, vault, secureRandom, ui, toast, webhook, export, platform, openUrl)
  providers/    -> React context providers (KanbanDragProvider, SyncOnProvider)
  constants/    -> Static constants (styles, icons, code-languages, note-types)
  configs/      -> App configuration (environment, defaults, business rules)
```
