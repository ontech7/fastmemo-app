---
name: mobile-release
disable-model-invocation: true
description:
  "Production release of the FastMemo mobile app (Android), on one of two paths it asks about first: an over-the-air update
  (gated by `yarn ota:check`, the native-fingerprint guard; if it fails it offers a store build instead) or a store build
  (version bump + changelogs via prepare-release, merge to main, then the manual EAS build and Play Console steps, never started
  by the skill). User-only: run `/mobile-release`; it publishes to real users. Resumable from any phase."
metadata:
  origin: adapted from the Quido `mobile-release` skill to FastMemo's setup (ADR-014, Publish OTA + publish workflows)
---

# mobile-release — production release flow for the FastMemo mobile app

This skill is the guided, resumable orchestrator for shipping the **Android app**. It decides between the two delivery paths,
runs the gates, and hands off the steps that must stay manual. It does **not** replace
[`prepare-release`](../prepare-release/SKILL.md): that skill owns the version files, the developer/user changelogs, the 7
locales and the README badges, and the build path calls it. The desktop (Tauri) track and the desktop-only hotfix stay in
`prepare-release` and the `publish` workflow.

## Trigger

ONLY when the user invokes `/mobile-release`. Do not auto-activate on "rilascia la mobile", "release", "OTA", "pubblica": point
at the slash command instead. It pushes OTAs to every installed app and cuts releases, so it must be opt-in.

## Two paths — the whole point of the skill

- **OTA update** — JS / assets / copy only (EAS Update, ADR-014). Reaches installed apps with no Play review, but **only** the
  builds on the `production` channel whose **runtime (native fingerprint) and app version** match the code being published. No
  version bump, no changelog entry, no README badge.
- **Store build** — anything native: a new/upgraded native dependency, a config plugin or permission, a native field in
  `app.config.ts`, `modules/`, or simply a **new `version`**. Spends the EAS build budget, produces an `.aab`, needs a Play
  Console release + review. **The user runs the build**: the skill prepares the release and hands off the commands (Phase B4).

The hard gate is `yarn ota:check` (`scripts/ota-guard.sh`, the same check the Publish OTA workflow runs). It passes only when a
finished Android build on `production` has the current fingerprint **and** the current `package.json` version; the version is
checked on its own because the default fingerprint preset leaves it out of the hash. So the FIRST thing the skill asks is which
path the user wants, then it reconciles that with reality through the gate.

## Scope

- Repo: this one (`fastmemo-app`), a single git repo; package manager is **yarn** (`yarn.lock`), never write `npm` commands.
- Branches: `dev` (integration) and `main` (what ships). Everything that publishes runs **from `main`**.
- Android only: iOS isn't distributed through this flow (ADR-014).
- Tags: store release `vX.Y.Z` and its GitHub Release are created by the **`publish` workflow** (it also builds the desktop app
  and writes the release body from the English user changelog, `scripts/changelog-notes.mjs`); an OTA is `vX.Y.Z+ota.N` + a
  GitHub Release `--latest=false`, created by the **Publish OTA** workflow. The skill creates neither tag.
- `releases/latest` must stay the store/desktop release: the website's `/api/version`, the in-app update check and the Tauri
  updater read it.
- Run every script from the `fastmemo-app` root with `bash .claude/skills/mobile-release/scripts/…` (the shell's cwd persists
  between Bash calls: `cd` back, or use absolute paths).
- My `git push` and some `gh` writes are blocked by the auto-mode classifier here: when one is, give the user the command to run
  with `!` instead of retrying.

## Preconditions

Check before anything mutating; if one fails, stop and report, never auto-fix.

1. `bash .claude/skills/mobile-release/scripts/state.sh` runs and `repo_ok=true`.
2. `working_tree_clean=true`. If dirty, tell the user to commit/stash: the skill never touches their changes.
3. `eas_logged_in=true` **and** `eas_project_access=true`. Being logged in is not enough: an account that cannot read this
   project reports `unknown` builds and the guard fails with "Entity not authorized". Tell the user to `eas whoami` /
   `eas login` (suggest `! eas login`) and stop.
4. `gh_ok=true` (the workflow dispatch and the release checks need it).

## Phase 0 — Choose the path (ALWAYS ask)

`AskUserQuestion`, "Che tipo di release vuoi fare per l'app mobile?":

- **OTA (aggiornamento over-the-air)** — JS/asset only, nessuna review su Play. Raggiunge solo i build con lo stesso fingerprint
  nativo e la stessa versione. (Recommended when the change is JS-only.)
- **Build per lo store** — tocca il nativo o è una nuova versione: consuma budget EAS, richiede release su Play Console.

Do not guess; if the message already says it ("è solo una copy fix" → OTA, "ho aggiunto un modulo nativo" → build), pre-select
that option but still confirm. Then: OTA → O1, build → B1.

If `production_android_builds_any=0` there is no baseline at all: an OTA reaches nobody, steer to the build path and say why.

## OTA path

### O1 — Gate

An OTA ships **`main`'s HEAD**, not "the fix". Before anything:

- If `main_only`/`dev_only` show that `dev` holds unreleased work, merging `dev` into `main` would publish **all of it** as an
  OTA. A hotfix OTA is a branch from `main`, merged into `main`, then `main` merged back into `dev` (same as the desktop
  hotfix). Ask which situation this is.
- A bumped `version` on the checked-out branch fails the guard (no build of it yet): that is a store release, not an OTA.

Run the gate on the code that will be published (`main` after the merge, or the hotfix branch) with `yarn install` done:

```bash
yarn ota:check     # 0 = safe · 2 = no build has this fingerprint/version · 3 = fingerprint or build query failed
```

- **0** → OTA is valid, go to O2.
- **2** → OTA is impossible (native change, or a version nobody built). Use `state.sh` to say which: `…_builds_for_version=0`
  with `…_builds_any>0` = new version not built yet; both 0 = no baseline; otherwise the fingerprint changed (native dependency,
  config, `modules/`). Ask with `AskUserQuestion`: "Il fingerprint nativo è cambiato (o manca una build di questa versione): non
  si può fare l'OTA. Vuoi fare la release con build per lo store?" · **Sì** → B1 (the gate already proved it, skip its re-check)
  · **No** → stop: "Release annullata. Il cambiamento è nativo: quando vuoi rilasciarlo, ri-lancia `/mobile-release` e scegli la
  build."
- **3** → show the raw output, do NOT assume safe, ask the user how to proceed (usually auth: `eas_project_access`). Never
  publish on an unverified fingerprint.

### O2 — Verify on a device

There is no preview OTA lane (the workflow only publishes to `production`). Ask the user to check the change on a local build
(`yarn android`, or a `preview`/`development` build) and wait for an explicit "verificato". The workflow itself runs `tsc`,
`lint`, `i18n`, `vault` and `sanitize` tests before publishing, so no broken bundle goes out; don't duplicate that.

### O3 — Land on main, dispatch

1. Make sure the change is on `main` (PR or merge — the push is the user's: hand `!` commands). Re-run `yarn ota:check` on
   `main`.
2. Write the one line of the OTA message: what changes for the user (the workflow's default is the last commit subject, which
   says nothing on the EAS dashboard and in the release). It becomes the GitHub Release body and the EAS update message
   (`vX.Y.Z+ota.N · <message>`).
3. **Publishing to production needs the user's explicit go-ahead.** Then:

```bash
gh workflow run publish-ota.yml --ref main -f message="<one line>"
gh run watch "$(gh run list --workflow publish-ota.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

- **Green** → live on `production`, tag `vX.Y.Z+ota.N` and its release created.
- **Failed on the guard** → the change was native after all; nothing was published. Offer the build path (same Sì/No as O1).
- **Green but the summary says the tag/release failed** → the OTA is live, only the tag step failed. Create the release by hand
  (`gh release create vX.Y.Z+ota.N --target <sha> --title "Mobile vX.Y.Z · OTA N" --notes-file <file> --latest=false`). NEVER
  re-dispatch to "fix" it: that publishes a second OTA.

### O4 — Close out

```bash
gh release list --limit 4
```

- The OTA release exists, and **Latest is still the store release**. If an OTA release took it:
  `gh release edit v<store-version> --latest`.
- Remind: installed apps download it at the next launch and run it from the one after; the app shows "X.Y.Z · OTA N".
- If it was a hotfix branch: merge `main` back into `dev`.

## Build path

### B1 — Confirm a store build is warranted

Arriving from O1 "Sì", the gate already proved it. Otherwise run `yarn ota:check` on the code to release (on `dev` the bumped
version makes it fail by design, so run it **before** bumping, or on `main` of the previous version):

- exit 2 on the fingerprint → genuinely native, proceed.
- exit 0 → JS-only: a build would waste budget. Ask: "Il fingerprint non è cambiato: potresti fare un OTA gratis invece di
  spendere una build. Procedo comunque con la build?" No → offer O1. Yes → proceed (a new store version is a legitimate reason).

### B2 — Bump versions, changelogs, docs (on `dev`)

**The desktop rides along: be careful here.** The store release is one GitHub release, `vX.Y.Z (+ Desktop)`, and the `publish`
workflow always builds the desktop app at the version in `src-tauri/tauri.conf.json`. So before bumping, ask (`AskUserQuestion`,
"Il desktop cambia in questa release?"):

- **Mobile + desktop** — bump both tracks (the 6 mobile + desktop files via `prepare-release`), both changelogs.
- **Solo mobile** — leave the desktop version untouched and its changelog alone. The workflow still builds the desktop at its
  current version (fine: the same version as the published one passes its guard), but the release body also shows that version's
  desktop changelog (`changelog.web.description_X_Y_Z`), which is then the previous desktop release's text: warn the user it
  will appear in the body.

Check the desktop guards now, not at dispatch: the desktop version must not be **older** than the one published (`latest.json`
of the latest release; a branch that misses a desktop hotfix fails here), and a `vX.Y.Z` release that already holds builds of
another desktop version is refused. Compare `desktop_version` from `state.sh` with
`gh release download <latest_store_tag> -p latest.json -O - | jq -r .version`; if `main` has a desktop hotfix `dev` lacks, merge
it first.

Run [`prepare-release`](../prepare-release/SKILL.md) **Steps 1–6** for the track(s) being released: mobile `package.json` +
`app.config.ts` + `src/configs/index.ts` (and the 4 desktop files if the desktop ships too), the `app/changelog.tsx` entry with
`description_X_Y_Z` in the 7 locales, README badges, and its verify step. Ask patch/minor/major with `AskUserQuestion`
(Recommended: any `feat:` since the last tag → minor, only fixes → patch, a breaking change/data migration → major). Show the
changelog text and **wait for the user's confirmation before committing**: it ships in the release body and in-app. Then commit
on `dev` (`chore(release): bump to X.Y.Z`); the push is the user's.

A `vX.Y.Z` that already exists (`tag_exists=true`) means this version was already cut: don't re-tag, check its release and go to
B4.

### B3 — Merge to main

The merge to `main` triggers nothing (both workflows are `workflow_dispatch`-only). Hand the user the commands (my push is
blocked): the PR route used for earlier releases, or a local merge:

```bash
gh pr create --base main --head dev --title "Update to vX.Y.Z" --body "<the English changelog: node scripts/changelog-notes.mjs mobile X.Y.Z>"
# or: git checkout main && git merge dev && git push origin main
```

Never push to `main` without the user's say-so, and never `--admin`/force around branch protection. Wait for their "mergiato".

### B4 — Hand off the build and the stores (the skill STOPS here)

The skill never calls `eas build`, `eas submit` or `--auto-submit`, and never watches a build: the build is long, spends budget
and ends in a store console the agent cannot reach. Print these, as plain text, for the user to run in a **real terminal** from
`main`:

```bash
yarn android-build:prod    # eas build -p android --profile production (channel production, versionCode auto-incremented)
```

Tell the user, in order:

1. This is **build only**: `eas.json` → `submit.production` is `{}`, nothing is submitted automatically.
2. When EAS finishes, **download the `.aab`** from the EAS build page (URL printed by the CLI). `eas build:download` is for
   simulator builds, not a production `.aab`.
3. In **Play Console**: create the release, upload the `.aab`, paste the release notes below, send it for review.
4. Store builds MUST use the `production` profile: the `preview` profile listens on the `preview` channel and leaves the OTA
   lane dead.

Release notes for Play Console come from the user changelog just written: the `changelog.mobile.description_X_Y_Z` entries of
the 7 locales (`src/libs/i18n/locales/`). Print one fenced block per language with its character count; Play's limit is **500
characters per language**. If a block is over, drop bullets (the least visible first), don't compress wording into jargon.

### B5 — The GitHub release and the desktop (ask when)

The `publish` workflow creates the `vX.Y.Z` tag + release (becoming `latest`, which the in-app update check and the website
read) and builds the desktop app. Ask the user **when** to dispatch it (`AskUserQuestion`): **after the Play release is live**
(Recommended: publishing earlier makes the website and the in-app check announce a version users can't install yet) or now. When
they say go: `gh workflow run publish.yml --ref main` (add `-f desktop_only=true` only for a desktop hotfix, which is
`prepare-release`'s separate flow, not this one). It builds macOS arm/Intel, Linux and Windows, so it is long and moves the
desktop updater too: `latest.json` points installed desktop apps at these builds, so a wrong desktop version here reaches every
desktop user. Restate the versions about to go out ("mobile vX.Y.Z, desktop vA.B.C") and get an explicit yes first. A failed
run: **Re-run failed jobs** (the release already exists); a new dispatch is refused while the tag exists.

### B6 — Close out

- State plainly that **no build is running yet**: it starts when the user runs B4's command. The skill's job ended at the notes,
  the merge and the hand-off.
- Remind: Play review takes time. Once the build lands on `production` and the version is live, it is the new OTA baseline:
  `yarn ota:check` passes for it and OTAs restart at `OTA 1`.
- Remind: merge `main` back into `dev` if `main` got commits `dev` doesn't have.

## Resume / state probe

`state.sh` prints `key=value` lines; read it before each phase:

```
repo_ok, current_branch, working_tree_clean
package_version, desktop_version
latest_store_tag            # newest vX.Y.Z (OTA tags excluded)
ota_count_for_version, latest_ota_tag   # OTAs published on top of package_version
tag_exists                  # vX.Y.Z of package_version already on the repo/remote
main_only, dev_only         # commits only on origin/main / only on origin/dev
production_android_builds_any, production_android_builds_for_version   # 0 none · 1 at least one · unknown eas failed
eas_logged_in, eas_project_access, gh_ok
```

It is read-only. `unknown` is never `match`: ask the user.

## Failure handling

| Where                                           | Action                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Precondition fails                              | Print the missing one and stop. Never auto-login `eas`/`gh`.                             |
| `ota:check` exit 2 on an OTA                    | Ask Sì/No to switch to the build path (O1). Never publish anyway, never edit the guard.  |
| `ota:check` exit 3 / `eas_project_access=false` | Show the raw output, do NOT assume safe, ask. Usually the wrong EAS account.             |
| Guard fails in CI                               | The change is native or the version unbuilt: offer the build path. Do not force the OTA. |
| OTA green, tag/release step failed              | The OTA is live: create the release by hand (O3). Never re-dispatch.                     |
| An OTA release took "Latest"                    | `gh release edit v<store-version> --latest`.                                             |
| Push to `main` rejected                         | Stop. Branch protection. Don't force-push.                                               |
| Tag already exists                              | The version was already cut: don't re-tag, check the release, go to B4.                  |
| User asks the agent to build/submit             | Decline and hand off B4's command (the build is the user's call and budget).             |

## What this skill does NOT do

- Does not author the fix: it releases what is already on `dev` / `main`.
- **Does not run the store build and does not wait for it** (no `eas build`, `eas submit`, `--auto-submit`, no polling). It does
  call `eas` read-only (`state.sh`, the guard) and dispatches the Publish OTA workflow once the user says go.
- Does not upload to Play Console or touch a store listing.
- Does not create `vX.Y.Z` or `vX.Y.Z+ota.N` tags or releases by itself: the workflows do (by hand only as the O3 recovery).
- Does not bump `version` for an OTA (the guard requires a build of the same version).
- Does not push, force-push or bypass branch protection or the OTA guard.
- Does not release the desktop on its own (`prepare-release`'s desktop hotfix + the `publish` workflow). A mobile OTA never
  touches the desktop; a store release always carries it (B2, B5).

## Procedure for the agent

1. Confirm the trigger was `/mobile-release` (else refuse and point at the slash command).
2. Preconditions + `state.sh`.
3. **Phase 0:** ask OTA vs build (override to build if there's no production baseline, and say why).
4. **OTA:** O1 gate (→ Sì/No to build if exit 2) → O2 device check → O3 land on `main`, one-line message, go-ahead, dispatch,
   watch → O4 verify the release and that Latest is still the store one.
5. **Build:** B1 confirm native → B2 `prepare-release` Steps 1–6 on `dev` (changelog confirmed, then commit) → B3 hand off the
   merge → B4 hand off the build + Play notes with character counts → B5 ask when to dispatch `publish` → B6 close out.
6. Final summary: path taken, tag (`vX.Y.Z+ota.N` or `vX.Y.Z`), the release URL, and on the build path the exact commands still
   owed to the user, restating that no build is running yet.

## Inputs to gather from the user

- Phase 0: OTA vs build. O1: Sì/No to build instead. O2: "verificato sul dispositivo?". O3: the one-line message and the
  explicit go-ahead to publish. B2: bump kind and the changelog text. B3: "mergiato". B5: when to dispatch `publish`.
