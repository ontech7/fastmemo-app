#!/usr/bin/env node
const { spawnSync } = require("child_process");
const { readFileSync } = require("fs");
const { isAbsolute, resolve } = require("path");

const keyPath = process.env.TAURI_KEY_PATH;
const keyPassword = process.env.TAURI_KEY_PASSWORD;

if (!keyPath) {
  console.error("Missing TAURI_KEY_PATH environment variable.");
  process.exit(1);
}

if (!keyPassword) {
  console.error("Missing TAURI_KEY_PASSWORD environment variable.");
  process.exit(1);
}

const resolvedKeyPath = isAbsolute(keyPath) ? keyPath : resolve(process.cwd(), keyPath);

let privateKey;

try {
  privateKey = readFileSync(resolvedKeyPath, "utf8");
} catch (error) {
  console.error(`Unable to read private key from ${resolvedKeyPath}.`);
  console.error(error.message);
  process.exit(1);
}

const result = spawnSync("npx tauri build", {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    TAURI_PRIVATE_KEY: privateKey,
    TAURI_KEY_PASSWORD: keyPassword,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
