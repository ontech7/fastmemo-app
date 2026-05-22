---
name: github-issue-template
description:
  GitHub issue creation template and workflow for FastMemo. Use when the user asks to create a GitHub issue (for a bug, lesson
  learned, feature, or refactor) via the `gh` CLI. Triggers on messages like "crea la issue di LL-XYZ", "create an issue for
  LL-NNN", "create a GitHub issue for ...", "apri una issue su github per ...", "fai la issue di ...", or any request to file a
  new issue in the project repository.
license: MIT
metadata:
  author: ontech7
  version: "1.0.0"
---

# GitHub Issue Template

Canonical format and workflow for creating issues in the FastMemo repository via `gh issue create`. Every issue filed from an
agent session must follow this template so that the issue tracker stays consistent and actionable.

## When to Apply

Use this skill whenever the user:

- Asks to create a GitHub issue for a `LESSONS_LEARNED.md` entry (e.g. "crea la issue di LL-005", "create an issue for LL-010").
- Asks to file an issue for a bug, refactor, or feature they just described.
- Says things like "apri una issue", "fai la issue", "create an issue on GitHub", "file a ticket".
- Requests batch creation of issues from the knowledge base.

Do NOT use this skill when:

- The user only wants to read existing issues (use `gh issue list` / `gh issue view` directly).
- The user wants to work ON an existing issue -> use `github-issue-workflow` instead.

## Prerequisites

Before creating an issue:

1. Check authentication: `gh auth status`. If not logged in, stop and ask the user to run `gh auth login`.
2. Confirm the target repo: `gh repo view --json nameWithOwner`. Do not assume a repo; always verify.
3. List existing labels: `gh label list --limit 50`. Reuse existing labels; do not invent new ones unless the user explicitly
   asks or the issue scope requires it.
4. (Optional) List open issues to avoid duplicates: `gh issue list --state all --limit 30 --search "<keyword>"`.

## Canonical Issue Body Template

Every issue MUST use exactly this structure. Sections are mandatory unless explicitly marked optional. Keep the content concise
-- only the necessary information, no filler.

```markdown
## Description

<!-- descrizione dettagliata del problema, ma scrivendo solo le info necessarie, senza allungare il brodo -->

## Solution

<!-- ipotetica soluzione del problema -->

## Files related

<!-- file correlati al bug, cosi' da avere piu' contesto nella risoluzione, ad esempio scrivendo una bullet list di relative paths -->

## Important notes

<!-- se necessario scriverle, ad esempio "Retrocompatibility necessary" -->
```

### Section-by-section rules

- **Description** -- 2-6 sentences max. State the problem, where it happens, and what the user-visible impact is. If there is a
  code snippet showing the bug, include a short one inside a fenced block. Do NOT repeat the title.
- **Solution** -- The proposed fix, expressed as 1-5 bullet points or a short paragraph with concrete steps. If multiple
  acceptable solutions exist, list them and mark the recommended one. No essays.
- **Files related** -- Bullet list of relative paths from the repo root. Include only files that a developer would actually
  touch or read to solve the issue. If a file is likely to exist but the exact path is uncertain, write it with the best-guess
  path and add `(verify path)` next to it.
- **Important notes** -- Only include if there is something non-obvious to flag: retrocompatibility, migration, performance
  concerns, Firestore operation cost, platform differences, translation impact. Omit the section entirely if there is nothing
  meaningful to say. Do NOT write "N/A" or "none".

## Title Convention

- **Lessons Learned entries:** `[LL-NNN] <short description>`
  - Example: `[LL-001] addNote reducer: sort condition always truthy`
- **New bugs (not in LESSONS_LEARNED yet):** `[bug] <short description>`
- **Refactor / chore:** `[refactor] <short description>` or `[chore] <short description>`
- **Feature:** `[feat] <short description>`

Titles must be <= 80 characters, lowercase after the prefix except for proper nouns / file names.

## Labels

- Default label for bugs and LL-\* issues: `bug`.
- Use `enhancement` for features, `documentation` for docs-only changes.
- Do NOT attach `severity:*` or custom labels unless the user explicitly asks.
- If a needed label does not exist, ask the user before creating it with `gh label create`.

## Command Shape

Always create issues with a HEREDOC body to preserve formatting exactly:

```bash
gh issue create \
  --title "[LL-NNN] short description" \
  --label bug \
  --body "$(cat <<'EOF'
## Description

...

## Solution

...

## Files related

- src/path/to/file.ts

## Important notes

Retrocompatibility necessary: ...
EOF
)"
```

Rules:

- Use `<<'EOF'` (quoted) to prevent shell expansion inside the body.
- Do NOT use double quotes or `echo` piping -- they break multi-line markdown.
- Do NOT set an assignee unless the user explicitly requests one.
- Do NOT attach milestones unless the user explicitly requests one.

## Workflow

### Single issue from a Lessons Learned entry

When the user says something like "crea la issue di LL-005":

1. Read `.agents/knowledge/LESSONS_LEARNED.md` and locate `LL-005`.
2. Extract: title, "What happened" -> Description, "Fix" -> Solution, infer "Files related" from the entry text + directory map
   in `AGENTS.md`. Include "Important notes" only if the entry mentions retrocompatibility, migration, or platform concerns.
3. Run the prerequisite checks (`gh auth status`, `gh repo view`, `gh label list`).
4. Create the issue with `gh issue create` following the command shape above.
5. Report the resulting issue URL back to the user.
6. Update the LL entry in `LESSONS_LEARNED.md` to link the issue (see "Cross-referencing").

### Batch creation

When the user asks to create issues for multiple LL entries (e.g. "tutte le 12"), parallelize the `gh issue create` calls within
a single message for efficiency, but still follow every other rule (template, prerequisites, cross-referencing).

### Ad-hoc issue (not from LESSONS_LEARNED)

If the user describes a new bug/feature directly:

1. Ask for any missing information needed to fill the Description, Solution, or Files related sections. Do NOT invent content.
2. If the issue describes a bug that is NOT yet in `LESSONS_LEARNED.md` AND corresponds to a real root cause worth documenting,
   suggest adding an LL entry in the same session (but only if the user agrees).
3. Create the issue following the template.

## Cross-Referencing With LESSONS_LEARNED.md

Every `LL-NNN` entry that has a corresponding open issue must link to it. When creating an issue for an LL entry, edit
`.agents/knowledge/LESSONS_LEARNED.md` and add a line under the entry:

```markdown
**Tracking issue:** https://github.com/ontech7/fastmemo-app/issues/NNN
```

When the issue is closed (bug fixed / refactor landed), update the LL entry to mark it resolved -- see the resolution protocol
in `LESSONS_LEARNED.md` itself.

## Examples

### Good title + body

```
Title: [LL-010] useStore() used for direct state access bypassing React reactivity
Label: bug

## Description

In `home.tsx`, `store.getState().notes.temporaryItems` is accessed directly (with `@ts-ignore`) instead of via `useSelector`.
This bypasses React's subscription model: when `temporaryItems` changes, the component does not re-render and the UI becomes
stale.

## Solution

- Replace the direct `store.getState()` call with a `useSelector` hook.
- Add a memoized selector `getTemporaryItems` in `notesSlice`.
- Remove the `@ts-ignore`.

## Files related

- src/app/home.tsx
- src/slicers/notesSlice.ts

## Important notes

Verify the list consumer is still wrapped in `memo()` to avoid regressions after the component starts re-rendering.
```

### Bad examples (do NOT do this)

- Title: `Fix bug` -- too vague, missing prefix.
- Body without "Solution" or "Files related" -- incomplete template.
- Body with "Important notes: N/A" -- omit the section instead.
- Filling "Files related" with a huge list of every file in the repo -- only include relevant ones.
- Creating the issue without running `gh auth status` first.

## Checklist Before Filing

- [ ] `gh auth status` confirmed OK
- [ ] Correct repo verified via `gh repo view`
- [ ] Title follows the prefix convention (`[LL-NNN]`, `[bug]`, `[feat]`, `[refactor]`, `[chore]`)
- [ ] All four sections present (or "Important notes" intentionally omitted)
- [ ] Files related are actually useful, not padded
- [ ] Label exists in the repo
- [ ] HEREDOC used for body
- [ ] After creation: LL entry in `LESSONS_LEARNED.md` updated with the issue URL
