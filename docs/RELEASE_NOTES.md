## 📱 Mobile 4.0.0

- Sync with your own [FastMemo Server](https://github.com/ontech7/fastmemo-server), instead of Firebase.
  - Open source and self-hosted: one Docker container with SQLite (or PostgreSQL), on a PC, a NAS, a Raspberry Pi or a VPS.
  - Notes stay end-to-end encrypted: the server stores them but can't read them.
  - Plain HTTP works too, and is fine through Tailscale or a VPN like WireGuard, which encrypt the traffic.
- Real-time sync across your devices.
  - Changes arrive in about a second: live listeners on Firebase, long polling on the server.
  - Every note has its own revision and is merged on its own: a note edited on two devices before they synced is kept twice, as
    a "(conflict)" copy, instead of one edit silently replacing the other.
  - A note open in the editor reloads live when another device changes it, and the cursor stays where it was.
  - A dot in Settings shows whether the cloud answers, and a quiet line appears on the home screen when it hasn't for 30 s.
- AI assistant with the new Qwen3.5 models: fix, shorten, translate and summarize.
  - Everything runs on the phone ([llama.rn](https://github.com/mybigday/llama.rn) with the 0.8B, 2B or 4B models): no note
    leaves the device.
  - Long notes are processed one paragraph at a time, and the summary goes at the top of the note.
  - Results stream in and are previewed before you apply them.
  - Models download through Android's DownloadManager, so the download goes on with the screen off or the app closed.
- Tap an image to resize, rotate or share it.
  - Small, medium, large or full width, alignment, quarter turns, a full-screen viewer with pinch to zoom; every change can be
    undone.
- A faster app and various fixes.
  - The Geist fonts are built into the app instead of being loaded at every launch, so the first frame doesn't wait for them.
  - The first call into a native module paid ~120 ms for kotlin-reflect's first use (it builds the call's options object), and
    every later call queued behind it. A thread started at launch now warms it up while the JS engine starts.
  - The home screen opens without an animation, and icons are imported one by one instead of from a barrel that loaded ~300 of
    them at startup.
  - Notes are stored one per entry and written only when they change, instead of rewriting every note on each save.
  - Built on Expo SDK 58 and React Native 0.88, with the New Architecture and Hermes V1.

## 🖥 Desktop 2.0.0

- Sync with your own [FastMemo Server](https://github.com/ontech7/fastmemo-server), instead of Firebase.
  - The app talks to the server and to webhooks from Rust, so plain HTTP servers on your network work, Windows included, with no
    CORS limits.
- Real-time sync across your devices.
  - The same sync engine as the mobile app: per-note revisions, conflicts kept as copies, live reload of the open note.
- Keyboard shortcuts and, on Mac, a menu bar.
  - Esc goes back, Cmd/Ctrl+N creates a note, Cmd/Ctrl+F searches; F5 and Cmd/Ctrl+R no longer reload the app and lose unsaved
    edits.
  - The macOS menu bar follows the app's language.
- Click an image to resize, rotate or save it.
- A faster app and various fixes.
  - Rebuilt on Tauri 2 with the same app identity: 1.x installs update in place and keep their notes.
  - The window stays hidden until the home screen is drawn, so there's no empty window at launch.
  - On macOS, closing the window keeps the app running like other Mac apps; the window remembers its size, position and zoom.
  - Launching it again brings the open window forward instead of starting a second copy.
