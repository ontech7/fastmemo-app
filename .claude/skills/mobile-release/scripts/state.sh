#!/usr/bin/env bash
# state.sh — read-only state probe for the mobile-release flow (FastMemo).
#
# Usage (from the fastmemo-app root):
#   bash .claude/skills/mobile-release/scripts/state.sh
#
# Prints key=value lines. Never mutates anything: no push, no tag, no publish, no build, no file edits.
# It answers "where are we?"; the OTA-vs-build verdict itself comes from `yarn ota:check` (scripts/ota-guard.sh), the same
# check the Publish OTA workflow runs — this script only adds the context that tells WHY it failed.

set -uo pipefail

# Pinned like scripts/ota-guard.sh and the workflow: the --json output and flags below depend on this eas-cli.
EAS="${EAS:-npx --yes eas-cli@25.2.0}"
emit() { printf '%s=%s\n' "$1" "$2"; }

if [ ! -f package.json ] || [ ! -f scripts/ota-guard.sh ]; then
  emit repo_ok false
  echo "error: run it from the fastmemo-app root (package.json + scripts/ota-guard.sh not found)" >&2
  exit 0
fi
emit repo_ok true

git fetch origin --tags --quiet >/dev/null 2>&1 || true

emit current_branch "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if [ -z "$(git status --porcelain 2>/dev/null)" ]; then emit working_tree_clean true; else emit working_tree_clean false; fi

version="$(node -p 'require("./package.json").version' 2>/dev/null || echo unknown)"
desktop="$(node -p 'require("./src-tauri/tauri.conf.json").version' 2>/dev/null || echo unknown)"
emit package_version "$version"
emit desktop_version "$desktop"

# Store tags are vX.Y.Z; OTAs are vX.Y.Z+ota.N (same prefix: the store list must leave them out). desktop-v* is a third kind.
latest_store="$(git tag --list 'v*' 2>/dev/null | grep -v '+ota\.' | sort -V | tail -1)"
emit latest_store_tag "${latest_store:-}"

# OTAs on top of the version in package.json (the next one is N+1: the workflow picks the first free number).
ota_n="$(git tag --list "v${version}+ota.*" 2>/dev/null | wc -l | tr -d ' ')"
emit ota_count_for_version "$ota_n"
emit latest_ota_tag "$(git tag --list "v${version}+ota.*" 2>/dev/null | sort -V | tail -1)"

if git rev-parse --verify --quiet "refs/tags/v${version}" >/dev/null 2>&1 \
  || git ls-remote --tags origin "refs/tags/v${version}" 2>/dev/null | grep -q .; then
  emit tag_exists true
else
  emit tag_exists false
fi

# main = what ships; dev = integration. dev_only is the work still waiting for a release.
counts="$(git rev-list --left-right --count origin/main...origin/dev 2>/dev/null || echo '0	0')"
emit main_only "$(printf '%s' "$counts" | awk '{print $1}')"
emit dev_only "$(printf '%s' "$counts" | awk '{print $2}')"

# Finished Android builds on the production channel: any, and of the version in package.json. A failed `ota:check` with
# builds_for_version=0 and builds_any>0 means "new version, no build of it yet"; both 0 means no baseline at all.
count_builds() {
  $EAS build:list --platform android --channel production --status finished --limit 1 --non-interactive --json "$@" 2>/dev/null \
    | node -e 'const s=require("fs").readFileSync(0,"utf8");const m=s.match(/\[[\s\S]*\]/);try{process.stdout.write(String(JSON.parse(m[0]).length))}catch{process.stdout.write("unknown")}' 2>/dev/null
}
builds_any=unknown
builds_for_version=unknown
if command -v node >/dev/null 2>&1; then
  builds_any="$(count_builds)"
  builds_for_version="$(count_builds --app-version "$version")"
fi
emit production_android_builds_any "$builds_any"
emit production_android_builds_for_version "$builds_for_version"

if $EAS whoami >/dev/null 2>&1; then emit eas_logged_in true; else emit eas_logged_in false; fi
# Logged in is not the same as allowed: an account without access to this project can whoami but not read its builds
# (seen when the machine-wide EAS session was another account). `unknown` builds above with eas_logged_in=true = this.
if [ "$builds_any" = "unknown" ]; then emit eas_project_access false; else emit eas_project_access true; fi
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then emit gh_ok true; else emit gh_ok false; fi
