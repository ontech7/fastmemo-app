---
name: prepare-release
description:
  "Prepare a FastMemo release: bump versions and write the changelogs + translations. Use whenever the user wants to cut/prepare
  a release, bump the app/desktop version, or update changelogs for a new version. Triggers on: release, prepara la release,
  prepare the release, bump version, version bump, new version, changelog, aggiorna i changelog, 3.2.0, 1.2.0."
metadata:
  origin: extracted from the (removed) github-issue-workflow release section + the v3.2.0 / v1.2.0 release
---

# FastMemo Release Skill

> The single source of truth for cutting a FastMemo release. A release is always the same mechanical sequence: bump versions,
> write the developer changelogs (verbose), write the user changelogs (concise, translated), refresh the README badges, and
> reconcile the docs. Follow every step in order.

FastMemo has **two independent version tracks** — Mobile (Expo/React Native) and Desktop (Tauri). A release may bump one or
both. If a platform had no changes, leave its version untouched and skip its changelog.

Ask the user for the target versions if not given: **"Mobile: X.Y.Z, Desktop: X.Y.Z"**.

---

## Step 1 — Bump versions

Update **all** files for each track being released. Keep them in lockstep — a mismatch ships the wrong version string somewhere.

### Mobile (e.g. `3.1.1 → 3.2.0`)

| File                   | Field                | Notes                         |
| ---------------------- | -------------------- | ----------------------------- |
| `package.json`         | `"version"`          | top-level (line ~4)           |
| `app.config.ts`        | `version`            | the Expo config `version` key |
| `src/configs/index.ts` | `app.version.mobile` | runtime-displayed version     |

### Desktop (e.g. `1.1.1 → 1.2.0`)

| File                        | Field                                     | Notes                                                                |
| --------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `src-tauri/Cargo.toml`      | `[package] version`                       |                                                                      |
| `src-tauri/tauri.conf.json` | `package.version`                         |                                                                      |
| `src-tauri/Cargo.lock`      | the `name = "fastmemo"` entry's `version` | keep in sync with Cargo.toml or the next `cargo` run will rewrite it |
| `src/configs/index.ts`      | `app.version.web`                         | "web" == desktop track                                               |

---

## Step 2 — Collect the changes

Source material = the work merged since the last release. Use the merged PR bodies / their Changelog sections, or the commit
log:

```bash
git log --oneline <last-release-tag-or-base>..HEAD
gh pr list --base <integration-branch> --state merged --json number,title,body --limit 50
```

Cover the **entire** range since the last release tag — include work committed directly to the release branch, not only what
came through merged PRs. It is easy to miss a big feature that didn't go via a PR (v3.2.0 nearly shipped without the per-vault
E2E encryption for exactly this reason).

Split every change into:

- **Platform** — mobile-only (e.g. an Android keyboard fix), desktop-only (e.g. the Tauri launch-flash / splash window), or
  both. Put each change only where it applies.
- **Audience** — a headline feature users actually notice, or everything else (internal plumbing, perf/reliability tweaks, minor
  fixes). The developer changelog lists **both**; the user changelog keeps only the headline features and buckets all the rest.

---

## Step 3 — Developer changelogs (`docs/`) — VERBOSE, complete, English

Prepend a new `## vX.Y.Z` section at the **top** of:

- `docs/CHANGELOG_MOBILE.md` (mobile version)
- `docs/CHANGELOG_DESKTOP.md` (desktop version)

Rules:

- English, one `- ` bullet per change, clear and concise but **complete**.
- List **everything** since the last release — features, fixes, refactors, build/infra, dependency bumps, SDK upgrades. **No
  `- Various fixes and improvements.` catch-all here**: that bucket belongs only to the user changelog. This file is the full
  record for developers.
- Lead with the biggest items (a new security model, a major feature) so the section reads top-down by impact.
- Tailor each file to its platform (don't put a desktop-only launch fix in the mobile changelog, and vice-versa).

---

## Step 4 — User changelogs — CONCISE, max 5 bullets, translated

Two parts, kept in sync.

### 4a. `app/changelog.tsx`

Add the new entry at the **top** of the correct array (newest-first). Key format replaces dots with underscores:
`3.2.0 → description_3_2_0`.

- Desktop entry goes in the `Platform.OS === "web"` branch: `{ version: "v1.2.0", text: t("changelog.web.description_1_2_0") }`
- Mobile entry goes in the `else` branch: `{ version: "v3.2.0", text: t("changelog.mobile.description_3_2_0") }`

### 4b. i18n locales (all 7) — `src/libs/i18n/locales/{en,it,es,fr,de,zh,ja}.ts`

Add the matching key inside `changelog.web` (desktop) and/or `changelog.mobile` (mobile), as the newest entry (right before the
previous `description_*`).

```ts
description_3_2_0: `• <highlight 1>
• <highlight 2>
• ...
• Various fixes and improvements.`,
```

Rules:

- `•` bullet markers, one per line, inside a template literal (match the existing entries).
- **Max 5 bullets, often 3–4.** Keep only the headline features users actually care about (e.g. a new encryption model, a new
  capture flow, a revamped screen). Everything else — including changes users don't perceive as features, like "more reliable
  sync" or "smoother editor" — collapses into the final `• Various fixes and improvements.` bullet (translated).
- **Translate the text** into each language (don't leave English in the other locales). Match the existing per-locale phrasing
  for "Various fixes and improvements".
- Every locale must get the key, or `t()` will render the raw key string. The 7 locales: en, it, es, fr, de, zh, ja.

---

## Step 5 — README badges

`README.md` has two version badges near the top — update the one(s) for the released track(s):

```markdown
![Android](https://badgen.net/badge/Android/vX.Y.Z/blue) ![Desktop](https://badgen.net/badge/Desktop/vX.Y.Z/blue)
```

Also update any README prose only if a user-facing feature changed the documented behavior (ask if unsure).

---

## Step 6 — Reconcile docs (CLAUDE.md + knowledge)

If the release changed the **stack or structure**, update the now-stale facts:

- `CLAUDE.md` — Project Summary + Tech Stack table (SDK / RN / React / Tauri versions), the Directory Map (if folders moved),
  and the Agent Skills / Knowledge tables (if skills or paths changed).
- `.claude/knowledge/` — `ARCHITECTURE.md` / `DECISIONS.md` if the structure or a key decision changed.

Skip this step for a pure feature/fix release that didn't move files or bump the framework.

---

## Step 7 — Verify

```bash
npx tsc --noEmit                 # locale .ts + changelog.tsx must still type-check
npx prettier --check "src/libs/i18n/locales/*.ts" app/changelog.tsx
```

Grep that every new `description_X_Y_Z` key exists in all 7 locales and is referenced in `changelog.tsx`. A missing locale key
renders as the raw key in-app.

---

## Final checklist

- [ ] All 6 version files bumped for each released track (+ `Cargo.lock`)
- [ ] `docs/CHANGELOG_*.md` — verbose, complete, platform-correct, prepended at top
- [ ] `app/changelog.tsx` — new entry in the right branch, `description_X_Y_Z` key
- [ ] 7 locales — concise (≤5 bullets), translated, "Various fixes and improvements" catch-all
- [ ] README badge(s) updated
- [ ] CLAUDE.md / knowledge reconciled if stack or structure changed
- [ ] `tsc` clean

Do **not** commit, branch, push, or open a PR unless the user explicitly asks — stop after the edits and report.
