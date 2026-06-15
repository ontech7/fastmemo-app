---
name: frontend-design
description: "FastMemo frontend design system & UI rework conventions. Use whenever building or restyling UI — components, screens, colors, gradients, glass/blur, fonts, spacing, layout, or any visual/frontend rework. Triggers on design, restyle, redesign, modernize, UI, styling, theme, gradient, glass, blur, font, layout, NoteCard, Sidebar, buttons, cards, IconChip, header, settings, editors."
version: 1.1.0
metadata:
  origin: 2026 UI modernization (Geist + glass on deep night-blue; muted-accent pass)
---

# FastMemo Frontend Design Skill

> The single source of truth for how FastMemo UI looks and is built. Read this before any visual/frontend work and follow it. It complements (does not replace) the `vercel-react-native-skills` performance rules and the project `CONVENTIONS.md`.

## When to Apply

Any task that touches how the app *looks or is laid out*: new components, restyles, color/gradient/glass changes, typography, spacing, repositioning elements, or full redesigns. On native + web + Tauri (this app ships all three).

## Visual Identity (non-negotiable)

- **Deep night-blue, dark-only.** No light theme, no theme provider. The base is dark; contrast lives in **cards and accents**, NOT in a loud background.
- **Accent, used calm.** The brand accent is `COLOR.accent` (`#4F6BFF`), but filled interactive surfaces (FABs, selected states, switches, checkboxes) use the **muted** variant `COLOR.accentMuted` (`#475AA6`) with border `COLOR.accentMutedBorder` — the full-bright accent read too loud as a fill. `COLOR.accentSoft` is for **text/icon highlights** (selected menu rows, active toggles). Glows (`SHADOW.fab` / `SHADOW.glow`) are tinted `accentMuted`. The bright `accent`/`accentDeep` survive only in the `AppBackground` radial glow. **Never** multi-hue "rainbow" gradients on buttons.
- **Background** = deep solid (`COLOR.bg`) + *subtle* SVG radial corner glows (`AppBackground`). The radial uses **many eased (quadratic-falloff) stops**, never a single `0→1` stop, which bands into visible rings on the dark backdrop. Each screen mounts its **own** `AppBackground` (see Screen Chrome) — the global one is not enough.
- **Cards are the signature: light surface + colored left edge.** `NoteCard` / `TrashedNoteCard` are a light `COLOR.softWhite` surface with **dark text** and a **colored left border** (`borderLeftWidth`, color from `CARD_TYPE_COLOR` by type) that follows the `borderRadius` and curves with the card. The type icon chip echoes the same color. **Important notes** break out into a **solid red card** (`COLOR.important`, white text) so a "pinned" note is obvious at a glance. (The old per-type `GRADIENT.card*` fills were removed — do not reintroduce gradient card backgrounds.)
- **Font: Geist.** Apply weight via `fontFamily: FONT.<weight>`, never `fontWeight` on Geist text (the weights are separate font files loaded in `_layout`).

## Token-First Rule (CRITICAL)

All visual values come from `src/constants/styles.ts`. **Never hardcode** colors, radii, spacing, shadows, font families, or blur intensities in a component.

| Token             | Use for                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `COLOR`           | All colors. Dark surfaces (`bg`/`surface`/`surfaceMuted`), text (`textPrimary`/`textSecondary`/`textMuted`), accent (`accent`/`accentSoft`/`accentDeep`/`accentMuted`/`accentMutedBorder`), legacy keys kept. |
| `CARD_TYPE_COLOR` | NoteCard left-border color by note type (`text`/`todo`/`kanban`/`code`). Important is separate (red). |
| `GRADIENT`        | Color-stop arrays for `LinearGradient`. Effectively just `accent` now (same-hue sheen). |
| `GLASS`           | Translucent fills + borders for frosted surfaces (`fill`/`fillStrong`/`border`/`hairline`). |
| `BLUR`            | `BlurView` intensities (`subtle`/`regular`/`strong`) + tint.                          |
| `SHADOW`          | `card`, `fab`, `glow` elevation/glow presets (spread into styles; glow tint = accentMuted). |
| `FONT`            | Geist families (`regular`/`medium`/`semiBold`/`bold`).                               |
| `FONTSIZE`        | Text sizes.                                                                          |
| `PADDING_MARGIN`  | Spacing scale (`xs`…`xxl`).                                                           |
| `BORDER`          | Radii (`small`/`normal`/`big`/`rounded`).                                            |

**Text hierarchy:** `textPrimary` (titles/body on dark), `textSecondary` (subtitles/secondary), `textMuted` (placeholders, disabled, captions). `softWhite` for icons/labels sitting on an accent/red fill.

**Evolving tokens:** `COLOR` is imported by ~90 files. When changing the palette, **change token values, keep the keys** (and add new keys) so the whole app updates without touching components. Prefer a token/primitive change over editing many components (e.g. the whole "tone the accent down" pass was a token + a few primitives).

## Reusable Primitives — use these, don't reinvent

In `src/components/ui/`:

- **`AppBackground`** — deep bg + eased radial accent glows. Mounted globally in `_layout` **and** per-screen (see Screen Chrome).
- **`IconChip`** — the standard **header icon-button surface**: 42×42 rounded (`BORDER.normal`) glass chip (`GLASS.fill` + hairline `GLASS.border`). Wrap header icons (back, options, filters, search toggle, settings `⋮`) in it, icon size `20`. `BackButton` has a `chip` prop that wraps its chevron in one.
- **`GlassSurface`** — frosted surface: `BlurView` (native) + translucent fill fallback. Props: `intensity`, `radius`, `fill`, `bordered`, `androidBlur`. Used for search bars / title inputs / static bars.
- **`GradientBackground`** / **`GradientButton`** — generic linear-gradient fill / same-hue gradient pressable (rare; default to solid+glow for primary actions).
- **`PopupMenu`** (+ `PopupMenuOption` / `PopupMenuLabel` / `PopupMenuDivider`) — custom context menu. Anchors **just below its `trigger`** (right-aligned, flips above near the screen bottom) and opens as a **dropdown that expands from height 0 to its content height** (not a scale/fade). `selected` highlights a row in `accentSoft`; options auto-close via context.
- **Radial FAB menu** (pattern, see `AddNoteOverlayButton` / `TodoModeMenuButton`) — a corner FAB that opens a **dimmed full-screen overlay** with options animating in on a staggered fade/translate/scale. Use this (not `PopupMenu`) for bottom-corner FAB menus. When such a button lives at the `SafeAreaView` level, align it to the content FABs with `useSafeAreaInsets()` (`bottom: insets.bottom + N`).

If a new visual need isn't covered, add a primitive here rather than scattering raw `LinearGradient`/`BlurView` across components.

## Screen Chrome (header + background)

Every full screen follows the same shell:

- **Transparent screen + per-screen `AppBackground`.** Do **not** put an opaque `backgroundColor` on the screen container. Render `<AppBackground style={StyleSheet.absoluteFill} />` as the first child inside the screen's `SafeAreaView`. Reason: a transparent screen over the single global `AppBackground` lets the **previous screen show through during stack push/slide transitions** (a ~visible "ghost" for the duration of the animation). A per-screen opaque background fixes it while keeping the gradient.
- **Header row:** `<BackButton chip />` on the left, a centered title (`fontFamily: FONT.semiBold`, `color: COLOR.textPrimary`, `letterSpacing: -0.3`, `flexGrow: 1`, `textAlign: "center"`), and on the right either action icons wrapped in `IconChip` or a **42px spacer** to keep the title optically centered. Back / title / options share the same height and surface language.

## Inputs

- Text fields: `GLASS.fill` (or `COLOR.bg` when the field needs more contrast, e.g. on a `surface` bar) + hairline `GLASS.border`, `fontFamily: FONT.regular`, `color: COLOR.textPrimary`, placeholder `COLOR.textMuted` (bump to `textSecondary` if it reads faint on the field).
- **Vertical centering:** use **symmetric `paddingVertical`**, never a fixed `height` + `textAlignVertical: "center"` on a single-line input — that clips/misaligns the text inconsistently across iOS/Android/web (text ends up cut at the top).

## Performance Guardrails (CRITICAL — the user cares about lag)

1. **No `BlurView`/`GlassSurface` inside list items** (`NoteCard`, `TodoItem`, `KanbanCard`) or any `FlashList`/`FlatList` row. Glass/blur is for **static chrome only**: sidebar, search bar, FAB, toolbars, headers, dialogs.
2. **`GlassSurface` `androidBlur` defaults OFF.** Android real blur is expensive — enable deliberately on a single static surface only. The translucent fill keeps the frosted look without it.
3. **Solid fills + 1px borders in list items** (NoteCards, settings rows, kanban cards). Gradients are GPU-cheap but we no longer use them on cards; keep any gradient subtle/2-stop and never animate per-frame.
4. Glow via `shadow*`/`elevation` is cheap; heavy `shadowRadius` on many list items is not — prefer it on chrome/FABs.

## Layout Conventions

- **Floating panels** (e.g. Sidebar): margins on all needed sides + full rounding (`BORDER.big`) + hairline glass border + `overflow: "hidden"`.
- **Safe area handled once, at the container level** via `@/components/SafeAreaView`. Do **not** nest a second `SafeAreaView` inside a child already within one.
- **No magic-number absolute positioning** for stacks of elements (e.g. status icons). Use flex + `gap`. Reserve `position: "absolute"` for true overlays/FABs.
- **Icons:** consistent sizes within a surface; prefer an icon over text for compact controls.

## Learned Pitfalls (do these, they bit us)

- **Row dividers:** use `borderBottomWidth: 1`, **not** `StyleSheet.hairlineWidth`. Hairline is `1/PixelRatio` and lands on fractional pixels, so it visibly drops out on *some* rows at 2x/3x while showing on others. 1 logical px renders consistently and still reads thin with `GLASS.border`.
- **Single radial stop bands.** `AppBackground` glows use ~8 eased stops (`peak * (1 - t)²`); a single `0→1` stop shows concentric rings.
- **Transparent screens ghost during transitions** → per-screen `AppBackground` (see Screen Chrome).
- **Fixed-height single-line inputs clip text** → symmetric `paddingVertical` (see Inputs).
- **Delete affordance** = a trash icon in a small **glass chip** (32×32 `GLASS.fill` + hairline `GLASS.border`, `TrashIcon` 16 in `textMuted`), not a bare `XCircleIcon`.
- **Switches** use the accent (`trackColor.true: accentMuted`, white thumb), not the legacy yellow track.

## React Native Conventions (reinforced)

- `interface Props` (named, never inline/`type`). `export default function Component` (or `export default memo(Component)` for list items).
- `import type { … }` for type-only imports. `@/` alias across module boundaries.
- `StyleSheet.create()` at the bottom. **No inline `style={{}}` objects in list-item components** (breaks memoization) — dynamic per-item values (e.g. a card's accent color) are the only exception.
- All user-facing strings via i18n (`t("…")`) and added to **all 7 locales** (`en`/`it`/`es`/`de`/`fr`/`ja`/`zh`). Reuse existing keys when renaming labels rather than adding new ones.
- Platform-split via file extensions (`.web.tsx` / `.native.tsx`).
- **Never install dependencies without explicit approval.**

## Recipes

**Primary / FAB action (muted accent + glow):**
```ts
fab: { borderRadius: BORDER.normal, backgroundColor: COLOR.accentMuted, ...SHADOW.fab } // softWhite icon
```

**Header icon button:**
```tsx
<IconChip><FunnelIcon size={20} color={COLOR.softWhite} /></IconChip>
```

**NoteCard surface (list item, no blur):**
```ts
container: { backgroundColor: COLOR.softWhite, borderLeftWidth: 5, /* borderLeftColor set inline per type */ ...SHADOW.card }
// important note: backgroundColor COLOR.important + white text instead
```

**Frosted chrome (static only):**
```tsx
<GlassSurface radius={BORDER.big} style={styles.bar}>{children}</GlassSurface>
```

**Delete affordance:**
```tsx
<View style={styles.deleteChip}><TrashIcon size={16} color={COLOR.textMuted} /></View>
// deleteChip: 32×32, BORDER.normal, GLASS.fill, hairline GLASS.border
```

**Loading placeholder:** `<ActivityIndicator size="large" color={COLOR.accentSoft} />` centered — not raw fallback text.

**Active/selected state:** muted-accent fill/border (`accentMuted` / `accentMutedBorder`), or `accentSoft` for highlighted text — not a separate arrow/triangle indicator.

## Working Process

1. Prefer **token + primitive** edits over per-component changes.
2. For a big redesign, do a **vertical slice** (one screen) and get visual sign-off before propagating. This redesign was driven by tight, iterative visual feedback — expect to tune values across several rounds.
3. Before finishing: run `yarn lint` / `npx eslint <files>` and `npx tsc --noEmit`; format touched files with `prettier --write`.
4. Verify on **native + web + Tauri** when touching shared chrome.
5. Remove unused imports/styles you orphan during a refactor (lint errors on unused; dead `style` keys are easy to leave behind).

## Checklist (before marking frontend work done)

- [ ] No hardcoded colors/spacing/radii/fonts — all from tokens.
- [ ] Geist applied via `fontFamily: FONT.*` (no `fontWeight` on Geist text).
- [ ] No blur/glass inside any list row; glass only on static chrome.
- [ ] Filled controls use `accentMuted` (+ `accentMutedBorder`); `accentSoft` for highlighted text; no rainbow gradients.
- [ ] Full screens: transparent container + per-screen `AppBackground`; header = `BackButton chip` + Geist centered title + `IconChip` actions / 42px spacer.
- [ ] Row dividers `borderBottomWidth: 1` (not hairline); single-line inputs use symmetric `paddingVertical` (not fixed height).
- [ ] NoteCards = light surface + colored left border by type; important = solid red.
- [ ] Safe area handled once at container level; no nested `SafeAreaView`; no magic-number absolute stacks.
- [ ] Strings in i18n across 7 locales; reused existing components/props/keys where possible.
- [ ] `eslint` + `tsc --noEmit` clean; touched files prettier-formatted.
```
