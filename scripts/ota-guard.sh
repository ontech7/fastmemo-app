#!/usr/bin/env bash
# OTA guard: an update reaches only the builds whose runtimeVersion (the native fingerprint) equals the one of the code
# being published. Passes when a finished Android build on the `production` channel has the current fingerprint and the
# current app version; otherwise the code has native changes and needs a store build, not an OTA.
# The version is checked on its own because the fingerprint ignores it: after a version bump with no native change, an
# OTA would otherwise reach the previous version's builds (and be labelled with the new version there).
#
# Two builds share the channel (ADR-031): the Play build and the GitHub APK, whose fingerprint differs (its updater is
# linked only with FASTMEMO_DISTRIBUTION=github, react-native.config.js). Each OTA is published once per build: both are
# checked, or the one named.
#
# Run: yarn ota:check [play|github]   (the Publish OTA workflow runs it before `eas update`)
# Exit: 0 safe to publish · 2 no build has this fingerprint (native change) · 3 fingerprint or build query failed
set -euo pipefail

# Pinned like the workflow's eas-cli: the checks below depend on its flags and JSON output.
EAS="${EAS:-npx --yes eas-cli@25.2.0}"
version=$(node -p 'require("./package.json").version')
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

case "${1:-both}" in
  both) variants="play github" ;;
  play | github) variants="$1" ;;
  *)
    echo "::error::Unknown build '$1' (play, github or nothing for both)."
    exit 3
    ;;
esac

# `--json` output can be preceded by log lines: extract the JSON value before parsing it.
json_field() { node -e '
  const s = require("fs").readFileSync(process.argv[1], "utf8");
  const m = s.match(/[\[{][\s\S]*[\]}]/);
  try {
    const v = JSON.parse(m[0]);
    // Anything but an array for "length" is unexpected output: empty, so it fails rather than passes.
    console.log(process.argv[2] === "length" ? (Array.isArray(v) ? v.length : "") : v[process.argv[2]] ?? "");
  }
  catch { console.log(""); }' "$1" "$2"; }

# The variant's FASTMEMO_DISTRIBUTION: empty for the Play build.
distribution() { [ "$1" = github ] && echo github || echo ""; }

for variant in $variants; do
  FASTMEMO_DISTRIBUTION=$(distribution "$variant") \
    $EAS fingerprint:generate --platform android --environment production --non-interactive --json \
    >"$tmp/fp.json" 2>"$tmp/fp.err" || true
  hash=$(json_field "$tmp/fp.json" hash)
  if [ -z "$hash" ]; then
    cat "$tmp/fp.err" >&2
    echo "::error::Could not compute the $variant build's Android fingerprint (see the output above)."
    exit 3
  fi
  echo "Android fingerprint ($variant): $hash"

  $EAS build:list --platform android --channel production --status finished --fingerprint-hash "$hash" \
    --app-version "$version" --limit 1 --non-interactive --json >"$tmp/builds.json" 2>"$tmp/builds.err" || true
  count=$(json_field "$tmp/builds.json" length)
  if [ -z "$count" ]; then
    cat "$tmp/builds.err" >&2
    echo "::error::Could not list the production builds (see the output above)."
    exit 3
  fi
  if [ "$count" = "0" ]; then
    echo "::error::No $variant build of v$version has this fingerprint: the code has native changes or a new version, so an OTA would reach no installed app (or the wrong one). Ship a store build (and the GitHub APK) instead."
    exit 2
  fi
  echo "OK: a $variant build of v$version has this fingerprint, the OTA will reach it."
done
