---
name: github-issue-workflow
description:
  GitHub issue-driven development workflow. Use when the user wants to work on a
  GitHub issue, pick up a task from GitHub, develop a feature or fix from an
  issue, create a PR from an issue, or prepare a release. Triggers on messages
  like "work on issue #N", "pick up issue N", "develop issue N", "prendi
  l'issue N", "prepara la release", or any reference to implementing a GitHub
  issue or releasing a new version.
license: MIT
metadata:
  author: ontech7
  version: "2.0.0"
---

# GitHub Issue Workflow

Structured workflow for issue-driven development with a `dev`/`main` branching model. Feature branches are created from `dev`
and merged back into `dev`. Releases go from `dev` to `main` only when the user decides.

## Branching Model

```
main  ────────────────────────●──────── (releases only)
                             /
dev   ───●───●───●───●──────● ──────── (integration branch)
         \  / \  /    \    /
          \/    \/      \/
       feat/  fix/   feat/              (feature branches)
```

- **`dev`** -- integration branch. All feature/fix branches are created from here and merged back here via PR.
- **`main`** -- production/release branch. Only updated via a release PR from `dev` when the user explicitly decides to release.
- **Feature branches** -- short-lived, one per issue.

## When to Apply

Use this workflow when the user:

- Asks to work on, pick up, or develop a GitHub issue (by number or URL)
- Wants to implement a feature or fix described in a GitHub issue
- Asks to create a PR from an issue
- Says things like "prendi l'issue #N", "lavora sull'issue N", "work on issue N"

For release workflow, see [Release Workflow](#release-workflow) below.

---

## Development Workflow

### Phase 1: Issue Analysis

1. **Fetch the issue** using `gh issue view <number>` (or extract the number from a URL).
2. **Read the full issue body**, title, labels, and any linked items.
3. **Summarize** the issue to the user in 2-3 lines and confirm understanding before proceeding.

```bash
gh issue view <NUMBER> --json number,title,body,labels,assignees,milestone,state
```

### Phase 2: Planning

1. **Break down** the issue into concrete, actionable tasks using the TodoWrite tool.
2. Each task should be small enough to implement in a single focused step.
3. Present the plan to the user and ask for confirmation before starting.

Guidelines for task breakdown:

- If the issue has acceptance criteria or a checklist, use those as tasks.
- If not, derive tasks from the issue description.
- Always include a final task for testing/verification if applicable.
- Keep tasks ordered by dependency (what must be done first).

### Phase 3: Branch Creation

Create a branch from **`dev`** following the project's naming convention:

```bash
git checkout dev
git pull origin dev
git checkout -b <type>/issue-<NUMBER>-<short-description>
```

**Branch type prefixes:**

| Issue type        | Prefix      |
| ----------------- | ----------- |
| New feature       | `feat/`     |
| Bug fix           | `fix/`      |
| Refactor          | `refactor/` |
| Documentation     | `docs/`     |
| Chore/maintenance | `chore/`    |

The `<short-description>` should be a kebab-case summary derived from the issue title (max 5 words).

Examples:

- Issue #42 "Add dark mode toggle" -> `feat/issue-42-add-dark-mode-toggle`
- Issue #15 "Login crashes on empty email" -> `fix/issue-15-login-crash-empty-email`

### Phase 4: Development

1. **Mark each task as `in_progress`** in the todo list as you start it.
2. **Implement the changes** following existing code conventions in the project.
3. **Mark each task as `completed`** immediately after finishing.
4. **Commit incrementally** using conventional commits:

```
<type>(<scope>): <description>

Refs #<NUMBER>
```

Commit types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`.

Keep commits atomic: one logical change per commit.

### Phase 5: Pre-PR Verification

Before creating the PR:

1. **Run type checking** if applicable (`npx tsc --noEmit` or equivalent).
2. **Run linting** if applicable (`npm run lint` or equivalent).
3. **Run tests** if applicable (`npm test` or equivalent).
4. Fix any issues found before proceeding.

Check available scripts first:

```bash
cat package.json | jq '.scripts'
```

### Phase 6: Self-Review Loop (MANDATORY)

> **Rationale.** In past sessions the agent created a PR that passed tsc/lint but still contained a regression (e.g.
> `BackHandler` re-registering on every render because the options passed to a custom hook had unstable identities). The user
> had to explicitly ask "are you sure nothing is broken?" for the agent to go back and find the bug. This phase makes that
> self-check unconditional: the agent must not open the PR until it has audited its own diff and is genuinely convinced nothing
> is broken.

This phase is NOT a formality. Do not skip it. Do not shortcut it. Type check and lint passing are NECESSARY but NOT SUFFICIENT.

#### Step 6.1 -- Ask the question to yourself

Before proceeding to PR creation, ask yourself **explicitly** in your own reasoning:

> **"Am I sure everything is correct now, nothing is broken, and there are no regressions introduced by my changes?"**

You are not allowed to move on to Phase 7 (PR Creation) until you can answer **"Yes, confirmed, for the following reasons:
..."** with concrete evidence backing each reason.

If the honest answer is "probably", "I think so", "mostly", "tsc and lint are green so it should be fine", or anything short of
a confident "yes with evidence", you MUST treat that as a "no" and go to Step 6.2.

#### Step 6.2 -- Structured diff audit

When the answer is anything less than a confident "yes", perform a structured audit of your own diff:

1. **Read the full diff** (`git diff <base>...HEAD`) line by line. Do not skim.
2. **Behavioural parity check** -- for each behaviour that existed before the change, verify it still exists and fires in the
   same conditions:
   - Effects (`useEffect`, `useFocusEffect`, `BackHandler`, subscriptions): have dependencies, fire-once conditions, and cleanup
     functions been preserved?
   - Callbacks (`useCallback`, `useMemo`): are identities stable the same way they were before? If you extracted logic into a
     hook or helper, are the options/args passed to it memoized or will they create new identities on every render?
   - Dispatches / API calls / webhooks / analytics / side effects: same payload shape? Same conditions? Same order?
   - Error handling paths and early returns: unchanged?
   - Platform-specific code (.web / .native): did you forget a variant?
3. **Invariants check** -- for every rule listed in `AGENTS.md` "Critical Rules (NEVER Do / ALWAYS Do)" relevant to the touched
   area, verify your diff does not violate it.
4. **Consumer check** -- for every exported symbol you modified, removed, or renamed, run a grep to find every call site and
   verify it still compiles AND still has the intended runtime behaviour.
5. **Dead-code check** -- are there imports, helpers, or files that are no longer used after your refactor? Remove them. Are
   there new files that should have been edits to existing files? (See `AGENTS.md`: prefer editing existing files.)
6. **Persistence / migration check** -- if you touched Redux slices, Firestore documents, persisted storage, or any data schema:
   is there a migration path? Will existing user data keep working?
7. **Unstated consequences** -- is there anything the change affects that is NOT obvious from the diff alone? (Bundle size,
   startup time, re-render count, Firestore op count, memory.)

Write the audit conclusions down in your own reasoning (not necessarily in files) before acting on them.

#### Step 6.3 -- Fix what you find

For every issue surfaced in Step 6.2:

- Fix it in a **new commit** on the same branch. Do NOT amend prior commits (they may already be pushed).
- Commit message should explain WHY the fix is needed (cite the specific regression you caught, not just "fix review comments").
- After fixing, re-run Phase 5 checks (tsc, lint, tests) to make sure the fix didn't regress anything else.

#### Step 6.4 -- Loop until confident

Go back to Step 6.1. Ask yourself the question again. If the answer is still not a confident "yes with evidence", do another
pass.

Stop the loop ONLY when you can honestly state:

> "Yes, confirmed. I re-read the full diff, audited <N> behaviours, verified call sites, ran type check + lint + tests green,
> and found no regressions. Specifically: <list 2-5 concrete reassurances>."

At that point (and only at that point), proceed to Phase 7.

#### Anti-patterns to avoid

- ❌ "tsc and lint pass, so it's fine" -- they catch type errors and style, not behaviour.
- ❌ "I'll fix it if the user reports it" -- do not push regressions onto the user's plate. Find them now.
- ❌ Skipping this phase because the diff "is small" -- the smallest diffs can ship the subtlest regressions (unstable
  identities, missing dependencies, silent reducer side effects).
- ❌ Confirming without evidence -- "yes, looks good" is not a confirmation. Cite what you checked.
- ❌ Forcing the user to ask "are you sure?" -- that is the failure mode this phase exists to prevent.

### Phase 7: PR Creation

1. **Push the branch** to the remote:

```bash
git push -u origin <branch-name>
```

2. **Create the PR targeting `dev`** with `gh pr create`:

```bash
gh pr create --base dev --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
## Summary

<Brief description of what this PR does and why, 2-3 sentences max.>

Closes #<NUMBER>

## Changes

- <Change 1: what was added/modified/removed and why>
- <Change 2>
- <Change 3>

## Changelog

### <Type (Added/Fixed/Changed/Removed)>
- <User-facing description of the change>

## Testing

<How to verify the changes work. Steps to reproduce or test commands.>
EOF
)"
```

**PR title** must follow conventional commit format.

**Changelog section types:**

| Type    | When to use                          |
| ------- | ------------------------------------ |
| Added   | New features or capabilities         |
| Fixed   | Bug fixes                            |
| Changed | Modifications to existing behavior   |
| Removed | Removed features or deprecated items |

3. **Report the PR URL** back to the user.

### Phase 8: Post-PR

- Inform the user the PR is ready for review.
- If the user requests changes after review, apply them on the same branch and push.
- Do NOT force-push or amend unless explicitly asked.

## Quick Reference (Development)

```
1. gh issue view <N>                 # Read the issue
2. Plan tasks (TodoWrite)            # Break it down
3. git checkout dev && git pull      # Sync dev
4. git checkout -b feat/issue-N-...  # Branch from dev
5. Implement + commit                # Develop incrementally
6. Run checks                        # Type check, lint, test
7. Self-review loop (MANDATORY)      # Ask "am I sure nothing broke?" until yes
8. git push -u origin <branch>       # Push
9. gh pr create --base dev ...       # PR targeting dev
10. Share PR URL                     # Done
```

---

## Release Workflow

**This workflow is only triggered when the user explicitly asks to prepare a release.** The user decides when all development
for a version is complete.

Trigger phrases: "prepara la release", "prepare the release", "release version X.Y.Z", "facciamo la release".

### Step 1: Confirm Version Numbers

Ask the user for the new version numbers. This project has **two independent version tracks**:

| Platform             | Current                              | Files                                                                                           |
| -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Mobile** (Expo/RN) | see `package.json` `version`         | `package.json`, `app.config.ts` (field `version`)                                               |
| **Desktop** (Tauri)  | see `src-tauri/Cargo.toml` `version` | `src-tauri/Cargo.toml` (field `version`), `src-tauri/tauri.conf.json` (field `package.version`) |

Ask: "What are the new version numbers? Mobile: X.Y.Z, Desktop: X.Y.Z"

If the user only provides one, ask about the other. If a platform has no changes, keep its version unchanged.

### Step 2: Create Release Branch

```bash
git checkout dev
git pull origin dev
git checkout -b release/v<MOBILE_VERSION>
```

If both platforms are updated, use the mobile version for the branch name.

### Step 3: Bump Versions

Update **all** version files. There are two independent version tracks:

**Mobile version** -- update these files:

| File                   | Field                | Example    |
| ---------------------- | -------------------- | ---------- |
| `package.json`         | `"version"`          | `"2.10.0"` |
| `app.config.ts`        | `version`            | `"2.10.0"` |
| `src/configs/index.ts` | `app.version.mobile` | `"2.10.0"` |

**Desktop version** -- update these files:

| File                        | Field             | Example   |
| --------------------------- | ----------------- | --------- |
| `src-tauri/Cargo.toml`      | `version`         | `"0.4.0"` |
| `src-tauri/tauri.conf.json` | `package.version` | `"0.4.0"` |
| `src/configs/index.ts`      | `app.version.web` | `"0.4.0"` |

### Step 4: Update Changelogs

Collect all the changes merged into `dev` since the last release. Use the merged PR descriptions and their Changelog sections as
source material.

```bash
# Find PRs merged into dev since last release tag
gh pr list --base dev --state merged --json number,title,body --limit 50
```

There are **four places** where changelogs must be updated:

#### 4a. Markdown changelogs (docs/)

Prepend a new version section at the top of the relevant file:

**`docs/CHANGELOG_MOBILE.md`** (if mobile version changed):

```markdown
## v<NEW_MOBILE_VERSION>

- <Change 1>
- <Change 2>
- ...
```

**`docs/CHANGELOG_DESKTOP.md`** (if desktop version changed):

```markdown
## v<NEW_DESKTOP_VERSION>

- <Change 1>
- <Change 2>
- ...
```

Style: each entry is a `- ` bullet with a user-facing description. Keep it concise but informative.

#### 4b. In-app changelog screen (`src/app/changelog.tsx`)

Add the new version entry to the `getVersionChangelogs` function. Entries are ordered newest-first.

**For mobile** (inside the `else` branch):

```typescript
{ version: "v<NEW_MOBILE_VERSION>", text: t("changelog.mobile.description_<X_Y_Z>") },
```

**For desktop/web** (inside the `Platform.OS === "web"` branch):

```typescript
{ version: "v<NEW_DESKTOP_VERSION>", text: t("changelog.web.description_<X_Y_Z>") },
```

The version key format uses underscores: `2.10.0` -> `description_2_10_0`.

#### 4c. i18n translation files

Add the corresponding translation key in **every** locale file under `src/libs/i18n/locales/`. The available locales are:

| File    | Language |
| ------- | -------- |
| `en.ts` | English  |
| `it.ts` | Italian  |
| `es.ts` | Spanish  |
| `fr.ts` | French   |
| `de.ts` | German   |
| `zh.ts` | Chinese  |
| `ja.ts` | Japanese |

For each locale, add the new key inside `changelog.mobile` and/or `changelog.web`:

```typescript
description_<X_Y_Z>: `• <Change 1 in this language>
• <Change 2 in this language>
• ...`,
```

**The changelog text must be translated to the respective language.** Use the `docs/CHANGELOG_*.md` entries (which are in
English) as the source and translate them.

The format uses `•` (bullet character) as list markers, one per line, matching the existing entries.

### Step 5: Update README.md

The `README.md` contains **version badges** that must always be updated:

```markdown
![Android](https://badgen.net/badge/Android/v<NEW_MOBILE_VERSION>/blue)
![Desktop](https://badgen.net/badge/Desktop/v<NEW_DESKTOP_VERSION>/blue)
```

Also update any other sections of the README if there are user-facing changes that affect documentation (new features, removed
features, changed setup instructions, etc.). Ask the user if unsure about content changes beyond the badges.

### Step 6: Commit and PR

```bash
git add -A
git commit -m "chore: update version and changelogs to <VERSION>"
git push -u origin release/v<VERSION>
```

Create a PR from the release branch **targeting `main`**:

```bash
gh pr create --base main --title "chore: release v<VERSION>" --body "$(cat <<'EOF'
## Release v<VERSION>

### Mobile v<MOBILE_VERSION>
<Summary of mobile changes>

### Desktop v<DESKTOP_VERSION>
<Summary of desktop changes>

## Checklist
- [ ] Version bumps: package.json, app.config.ts, src/configs/index.ts
- [ ] Version bumps: Cargo.toml, tauri.conf.json, src/configs/index.ts
- [ ] docs/CHANGELOG_MOBILE.md updated
- [ ] docs/CHANGELOG_DESKTOP.md updated
- [ ] src/app/changelog.tsx updated (new version entries)
- [ ] i18n translations added (all 7 locales)
- [ ] README.md badges updated
EOF
)"
```

Report the PR URL to the user.

## Quick Reference (Release)

All files involved in a release:

```
Version files:
  - package.json                          (mobile)
  - app.config.ts                         (mobile)
  - src/configs/index.ts                  (mobile + desktop)
  - src-tauri/Cargo.toml                  (desktop)
  - src-tauri/tauri.conf.json             (desktop)

Changelogs:
  - docs/CHANGELOG_MOBILE.md             (mobile)
  - docs/CHANGELOG_DESKTOP.md            (desktop)
  - src/app/changelog.tsx                 (in-app, both platforms)
  - src/libs/i18n/locales/{en,it,es,fr,de,zh,ja}.ts  (translations)

Other:
  - README.md                             (version badges, always)
```

Release steps:

```
1.  Confirm version numbers with user
2.  git checkout dev && git pull
3.  git checkout -b release/vX.Y.Z
4.  Bump versions (5 files)
5.  Update docs/CHANGELOG_*.md
6.  Update src/app/changelog.tsx
7.  Add i18n translations (7 locale files)
8.  Update README.md badges
9.  git commit -m "chore: update version and changelogs to X.Y.Z"
10. git push -u origin release/vX.Y.Z
11. gh pr create --base main ...
12. Share PR URL
```

---

## Language

Respond in the same language the user is using. If the user writes in Italian, respond in Italian. If in English, respond in
English.
