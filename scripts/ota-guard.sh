#!/usr/bin/env bash
# OTA guard: an update reaches only the builds whose runtimeVersion (the native fingerprint) equals the one of the code
# being published. Passes when a finished Android build on the `production` channel has the current fingerprint;
# otherwise the code has native changes and needs a store build, not an OTA.
#
# Run: yarn ota:check   (the Publish OTA workflow runs it before `eas update`)
# Exit: 0 safe to publish · 2 no build has this fingerprint (native change) · 3 fingerprint or build query failed
set -euo pipefail

# Pinned like the workflow's eas-cli: the fingerprint is computed inside eas-cli, a different version can hash differently.
EAS="${EAS:-npx --yes eas-cli@25.2.0}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# `--json` output can be preceded by log lines: extract the JSON value before parsing it.
json_field() { node -e '
  const s = require("fs").readFileSync(process.argv[1], "utf8");
  const m = s.match(/[\[{][\s\S]*[\]}]/);
  try { const v = JSON.parse(m[0]); console.log(process.argv[2] === "length" ? v.length : v[process.argv[2]] ?? ""); }
  catch { console.log(""); }' "$1" "$2"; }

$EAS fingerprint:generate --platform android --environment production --non-interactive --json >"$tmp/fp.json" 2>"$tmp/fp.err" || true
hash=$(json_field "$tmp/fp.json" hash)
if [ -z "$hash" ]; then
  cat "$tmp/fp.err" >&2
  echo "::error::Could not compute the Android fingerprint (see the output above)."
  exit 3
fi
echo "Android fingerprint: $hash"

$EAS build:list --platform android --channel production --status finished --fingerprint-hash "$hash" --limit 1 \
  --non-interactive --json >"$tmp/builds.json" 2>"$tmp/builds.err" || true
count=$(json_field "$tmp/builds.json" length)
if [ -z "$count" ]; then
  cat "$tmp/builds.err" >&2
  echo "::error::Could not list the production builds (see the output above)."
  exit 3
fi
if [ "$count" = "0" ]; then
  echo "::error::No production build has this fingerprint: the code has native changes, so an OTA would reach no installed app. Ship a store build instead."
  exit 2
fi
echo "OK: a production build has this fingerprint, the OTA will reach it."
