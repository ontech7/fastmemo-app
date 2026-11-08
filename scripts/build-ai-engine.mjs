// Builds the desktop AI engine library (src-tauri/ai-engine) for the target Tauri is building,
// and copies it to src-tauri/ai-engine/dist/, where the bundle config picks it up.
//
//   node scripts/build-ai-engine.mjs
//
// The target is TAURI_ENV_TARGET_TRIPLE (set by Tauri for its before*Command hooks), else the host's.
// `universal-apple-darwin` builds both Mac triples and joins them with lipo.
//
// cargo always runs from src-tauri/ai-engine, so that it reads that directory's .cargo/config.toml
// (AVX2/FMA/F16C on x86_64, static CRT on MSVC), and always with --target, so those rustflags reach
// the library and never the build scripts.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Triples that get the stub library (no llama.cpp, `fm_ai_abi_version()` is 0) instead of the real one.
const STUB_TARGETS = [];

const ENGINE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "ai-engine");
const DIST_DIR = join(ENGINE_DIR, "dist");
const MAC_TRIPLES = ["aarch64-apple-darwin", "x86_64-apple-darwin"];

function fail(message) {
  console.error(`build-ai-engine: ${message}`);
  process.exit(1);
}

/** `quiet`: its output is shown only if it fails (install_name_tool warns on every run that it voids the signature). */
function run(command, args, { capture = false, quiet = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ENGINE_DIR,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : quiet ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) fail(`could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    if (quiet) process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    fail(`\`${command} ${args.join(" ")}\` failed${result.status === null ? ` (${result.signal})` : ` with ${result.status}`}`);
  }
  return result.stdout;
}

function hostTriple() {
  const line = run("rustc", ["-vV"], { capture: true })
    .split("\n")
    .find((l) => l.startsWith("host:"));
  if (!line) fail("`rustc -vV` has no host line");
  return line.slice("host:".length).trim();
}

function libraryName(triple) {
  if (triple.includes("windows")) return "fastmemo_ai.dll";
  if (triple.includes("apple")) return "libfastmemo_ai.dylib";
  return "libfastmemo_ai.so";
}

/** Adds the rust target with rustup when its standard library is missing. */
function ensureTarget(triple) {
  const sysroot = run("rustc", ["--print", "sysroot"], { capture: true }).trim();
  if (existsSync(join(sysroot, "lib", "rustlib", triple))) return;
  console.log(`build-ai-engine: adding the rust target ${triple}`);
  run("rustup", ["target", "add", triple]);
}

/** Builds the library for one triple and returns its path. */
function build(triple) {
  ensureTarget(triple);
  const stub = STUB_TARGETS.includes(triple);
  const args = ["build", "--release", "--target", triple];
  // the stub has its own target dir: it never replaces (or reuses) the real build's artifacts
  if (stub) args.push("--no-default-features", "--target-dir", "target/stub");
  console.log(`build-ai-engine: ${stub ? "stub" : "real"} library for ${triple}`);
  run("cargo", args);
  const built = join(ENGINE_DIR, stub ? "target/stub" : "target", triple, "release", libraryName(triple));
  if (!existsSync(built)) fail(`cargo did not produce ${built}`);
  return built;
}

/** The macOS loader finds the library through the app's rpath (Contents/Frameworks). */
function setInstallName(dylib) {
  run("install_name_tool", ["-id", "@rpath/libfastmemo_ai.dylib", dylib], { quiet: true });
  // install_name_tool invalidates the linker's ad-hoc signature, and arm64 refuses unsigned code
  run("codesign", ["--force", "--sign", "-", dylib], { quiet: true });
}

const triple = process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple();
mkdirSync(DIST_DIR, { recursive: true });

// The library is made whole in a temporary file, then renamed into place: a dev app may have the one in dist mapped, and
// writing over it would change the code under it (macOS kills a process whose signed pages change). The rename leaves
// it the old file. Same file name, in a folder of its own: codesign names the signature after the file.
const out = join(DIST_DIR, libraryName(triple));
const tempDir = join(DIST_DIR, ".tmp");
const temp = join(tempDir, libraryName(triple));
rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir);
if (triple === "universal-apple-darwin") {
  if (process.platform !== "darwin") fail(`${triple} can only be built on macOS`);
  const parts = MAC_TRIPLES.map(build);
  run("lipo", ["-create", ...parts, "-output", temp]);
  setInstallName(temp);
} else {
  copyFileSync(build(triple), temp);
  if (triple.includes("apple")) setInstallName(temp);
}
renameSync(temp, out);
rmSync(tempDir, { recursive: true, force: true });
console.log(`build-ai-engine: ${out}`);
