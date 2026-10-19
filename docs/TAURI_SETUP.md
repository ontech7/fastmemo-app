# Tauri Setup - Fast Memo

## Table of Contents

- [File Structure](#file-structure)
- [Signing Keys](#signing-keys)
- [Build](#build)
- [Updater](#updater)
- [GitHub Release](#github-release)
- [Troubleshooting](#troubleshooting)

---

## File Structure

```
src-tauri/
├── Cargo.toml              # Rust dependencies and build profiles
├── tauri.conf.json         # Tauri 2 configuration (window, bundle, plugins.updater)
├── tauri.linux.conf.json   # Linux override: keeps the `fast-memo` binary name of 1.x
├── tauri.test.conf.json    # Test identity (com.ontech7.fastmemo.test), no updates
├── capabilities/
│   └── default.json        # What the window may call (least privilege)
├── src/
│   ├── lib.rs              # The app: commands, plugins, menu, exit flush
│   └── main.rs             # Entry point, calls lib.rs
└── icons/                  # Icons for all platforms
```

---

## Signing Keys

Keys are required to sign updates. **NEVER share the private key.**

### Key locations

- **Private key:** `~/.tauri/fastmemo.key`
- **Public key:** In `tauri.conf.json` → `plugins.updater.pubkey`

### Regenerate keys (if needed)

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/fastmemo.key

# or

cargo tauri signer generate -w ~/.tauri/fastmemo.key
```

You'll be asked for a password (optional). Save the **public key** shown in output.

### Update the public key

Copy the public key to `tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "pubkey": "YOUR_PUBLIC_KEY_HERE"
  }
}
```

---

## Build

### Development build

```bash
yarn tauridev
```

### Production build (with signing)

```bash
yarn tauri:build
```

### Build output

Generated files are in:

```
src-tauri/target/release/bundle/
├── macos/
│   └── Fast Memo.app
├── dmg/
│   └── Fast Memo_x.x.x_aarch64.dmg
│   └── Fast Memo_x.x.x_aarch64.dmg.sig  # Signature for updater
├── msi/      # Windows
├── nsis/     # Windows installer
└── deb/      # Linux
```

---

## Updater

### How it works

1. On startup (and from Settings → Check updates), the app checks the configured endpoint for `latest.json`
   (`AppUpdateProvider`; skipped for deb/rpm installs, which update through their package manager)
2. If a newer version is found, it shows the app's own dialog
3. User can accept → downloads, verifies the signature, writes pending notes, installs, restarts

`bundle.createUpdaterArtifacts: "v1Compatible"` keeps the 1.x archive names (`.app.tar.gz`, `.msi.zip`, `.nsis.zip`,
`.AppImage.tar.gz`), so installs still on 1.x can update from the same `latest.json` (see ADR-015).

### Configuration in tauri.conf.json

```json
"plugins": {
  "updater": {
    "pubkey": "YOUR_PUBLIC_KEY",
    "endpoints": [
      "https://github.com/ontech7/fastmemo-app/releases/latest/download/latest.json"
    ]
  }
}
```

### latest.json format

```json
{
  "version": "X.Y.Z",
  "notes": "Description of changes",
  "pub_date": "2026-01-26T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://github.com/.../Fast Memo_X.Y.Z_aarch64.dmg.tar.gz",
      "signature": "CONTENTS_OF_.sig_FILE"
    },
    "darwin-x86_64": {
      "url": "https://github.com/.../Fast Memo_X.Y.Z_x64.dmg.tar.gz",
      "signature": "CONTENTS_OF_.sig_FILE"
    },
    "windows-x86_64": {
      "url": "https://github.com/.../Fast Memo_X.Y.Z_x64-setup.nsis.zip",
      "signature": "CONTENTS_OF_.sig_FILE"
    },
    "linux-x86_64": {
      "url": "https://github.com/.../fast-memo_X.Y.Z_amd64.AppImage.tar.gz",
      "signature": "CONTENTS_OF_.sig_FILE"
    }
  }
}
```

### Local updater testing

```bash
# 1. Install ngrok
brew install ngrok

# 2. Create test folder with latest.json
mkdir -p /tmp/update-test
# Create latest.json with higher version

# 3. Start server
cd /tmp/update-test && python3 -m http.server 8080

# 4. In another terminal, create HTTPS tunnel
ngrok http 8080

# 5. Use the ngrok URL in tauri.conf.json (temporarily)
```

---

## GitHub Release

### Step 1: Update version

Change version in **both** files:

- `tauri.conf.json` → `version`
- `Cargo.toml` → `version`

### Step 2: Build with signing

```bash
TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/fastmemo.key) yarn tauri:build
```

### Step 3: Prepare files

Collect from `target/release/bundle/`:

- `.dmg` + `.dmg.sig` (macOS)
- `.msi` or `.exe` + `.sig` (Windows)
- `.deb` or `.AppImage` + `.sig` (Linux)

### Step 4: Create latest.json

Use the contents of `.sig` files as the `signature` value.

### Step 5: Create Release on GitHub

1. Go to `github.com/ontech7/fastmemo-app/releases/new`
2. Tag: `vX.Y.Z`
3. Title: `Fast Memo vX.Y.Z`
4. Upload all bundle files + `latest.json`
5. Publish

---

## Troubleshooting

### "No such command: tauri"

```bash
# Use npx
npx @tauri-apps/cli build

# Or install globally
cargo install tauri-cli
```

### "A public key has been found, but no private key"

```bash
export TAURI_SIGNING_PRIVATE_KEY="your-private-key"   # Tauri 2's name (1.x used TAURI_PRIVATE_KEY)
```

### "The configured updater endpoint must use the `https` protocol"

The updater requires HTTPS. For local testing use ngrok or any HTTPS hosting.

### Private key lost

You must regenerate keys and release a new version. Users with old versions will need to download manually.

### Updater doesn't find updates

1. Verify `latest.json` is accessible at the configured URL
2. Verify the version in `latest.json` is greater than the installed one
3. Verify the current platform is present in `platforms`

---

## GitHub Actions Secrets

For the automated workflow, configure these secrets in the repository:

| Secret               | Value                      |
| -------------------- | -------------------------- |
| `TAURI_PRIVATE_KEY`  | Contents of `fastmemo.key` |
| `TAURI_KEY_PASSWORD` | Key password (if set)      |

The secret names are the 1.x ones: `publish.yml` passes them to the build as `TAURI_SIGNING_PRIVATE_KEY` /
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Locally, `.env` uses the Tauri 2 names directly.

**Path:** Repository → Settings → Secrets and variables → Actions → New repository secret
