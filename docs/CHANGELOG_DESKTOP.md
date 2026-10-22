## v2.0.0

- Migrated to Tauri 2 in place (ADR-015): same identifier, data and update channel, so 1.x installs update and keep their notes; tighter capabilities, a safer in-app update flow, and Cmd+Q waits for the notes to be saved before quitting.
- Faster start without an empty window (ADR-022): the window stays hidden until the home screen is drawn. On macOS, closing the window leaves the app running like other Mac apps (the Dock icon brings it back, Quit closes it, edits are saved when the window hides). The window remembers its size, position and zoom, and a quit in full screen reopens it as it was before.
- macOS: the window closed and brought back (the Dock, a second launch, a menu command) opens on the Space (desktop) you're on, at its size and place, instead of switching to the Space it was closed on.
- Single instance: launching Fast Memo again focuses the running window instead of opening a second one.
- Keyboard shortcuts: Esc goes back (in a text field it only leaves the field), Cmd/Ctrl+N a new note, Cmd/Ctrl+F the search or find in the note, Cmd/Ctrl+Enter saves the quick note. F5, Cmd/Ctrl+R and the history keys no longer reload or leave a screen and lose unsaved edits.
- macOS menu bar in the app's language, with the same commands: every note type, find, settings, Export/Import, Help. A command runs only when its control is reachable, one at a time, never under a native open/save panel. The bundle declares its languages, so what macOS adds (Edit menu items, panels) follows the system language too.
- Text notes, image menu (ADR-024): clicking an image opens a menu at that point with its size (S/M/L/Full, a width in % of the note with the ratio kept), its line's alignment (not inside a code block), a quarter turn (JPEG, PNG and WebP, re-encoded to stay within 15% of its size), a full-screen viewer (double-click to zoom, drag to move), save (the native save dialog) and delete. Every change can be undone, a choice on an image another device changed meanwhile is ignored, a link around the image is kept, and the caret stays where it was (LL-065); a read-only note offers view and save only.
- Rich text editor (ADR-023, LL-062): heading, code and lists are exclusive line types, and the button of the current type turns the line back into text. H1 no longer grows on every press, nothing nests (a list in a heading, a code block in a code block), a heading takes a bullet out of its list, the caret keeps its place, Enter in a code block adds a line and twice leaves it, Backspace at the start of a bullet removes it, and an image goes in at the caret with the caret on a new line. Notes saved with the old nested markup show correctly. `scripts/richtext.test.mjs` runs the real editor page in headless Chrome.
- The FastMemo Server and the webhooks are called from Rust commands, so no CORS limits and plain HTTP servers on the local network work.
- New sync engine behind a `CloudBackend` (ADR-016): live listeners, a revision per note, edits merged per note, and conflicting edits kept as a "(conflict)" copy; a note open in the editor reloads live keeping the caret.
- Self-hosted FastMemo Server as a second cloud next to Google Firebase (ADR-017), with the same per-vault end-to-end encryption; the devices screen shows the device limit and asks before removing a device; an answer that came through a redirect is never taken as the server's.
- Notes stored one value per note in IndexedDB and written only when they change (ADR-018); reads and writes shared by browser tabs run under a Web Lock.
- Editors commit edits in batches and flush them on exit or when the window hides (ADR-013); the code editor loads its grammars on demand and keeps an undo history per tab.
- A note's HTML is sanitized with DOMPurify inside the editor (ADR-021), and the app ignores messages from other windows: a note from an import or another device can never run code with access to the app's storage or its Rust commands. HTML dropped into a note from outside comes in as plain text.
- The update check repeats every 6 hours and when the window comes back, without offering the same version twice; if the in-app check fails, the update button opens the right release page.
- CI: desktop-only releases for hotfixes (`desktop_only` in the publish workflow), with checks against shipping an older or duplicate desktop version; `latest.json` notes come from the English changelog; desktop builds read their `EXPO_PUBLIC_*` values from GitHub variables.
- Expo SDK 58 web bundle (React 19.3); faster start of the web bundle (deep icon imports, cached date formatter).
- The vault key is derived with WebCrypto PBKDF2 off the main thread, so setup, unlock and password change no longer freeze the window, with one key per passphrase on every path; the vault screens are translated into every language; the recovery key screen can't be left before the key is confirmed.
- Data safety: a slow read can no longer rehydrate empty state (`timeout: 0` on every persist config), and a failed read, including a lost IndexedDB connection, never writes the notes back.
- Sync fixes: newer edits stay queued, each note and category id is in one queue only, a restored note isn't deleted by a stale deletion, saving the settings while connected doesn't re-enroll the device, and notes 1.2.0 received from a newer version don't produce conflict copies.
- Note size per cloud (ADR-026, LL-067): the limit comes from the cloud in use (Firestore's 1 MiB document, or the FastMemo server's `MAX_NOTE_MB`, now in `/v1/info`), measured on the note as sent, encrypted. A note over it isn't sent: it becomes offline on every device, each keeping its copy, with a notice. The text editor shows the cloud's limit as text (about 0.71 MB on Firebase), and a note already over it can still be cut down. Fixes text notes of 0.75 to 1 MB that never synced on Firebase, with nothing said.
- Accessibility: names, roles and states for icon-only controls, and hidden controls out of the Tab order.
- A first-note tour replaces the welcome note on a new install (ADR-019); the intro carousel is centered on wide windows; roomier text toolbar; logos in the cloud choice; a warning on the connect screen for plain HTTP servers.
- Smaller fixes: longer auto-titles cut at a word boundary, changelog bullets with hanging indents, the to-do progress as one translated sentence, no splash logo stuck on screen after closing every screen at once on a reloaded page.
- Help brought up to date, with new topics on the quick-note bar, the conflict copies and the desktop shortcuts; translations fixed (German "Sie" and umlauts, accents in Italian, Spanish and French, several wrong strings).
- The website moved to fastmemo.losav.cc: the app's links and update check use it, and its version API now answers the desktop app (CORS).
- A cloud out of reach while the device is online (a FastMemo server behind a VPN left off, or down) gets a quiet line under the home's title after 30 s, in place of the category, gone once it answers; a tap says the changes stay on the device and go out by themselves, the notes waiting and the last sync, and offers Retry (ADR-029). No toast, nothing for an offline device.

## v1.2.0

- Cloud sync is now end-to-end encrypted per vault: notes are sealed with a key derived from your passphrase (envelope DEK/KEK scheme), with a one-time recovery key and password change/reset flows. The old global key is gone, and legacy notes sealed with the previous empty key are migrated automatically.
- Hardened the encrypted sync: self-healing sync, manual per-device sync, "wipe + cloud" hidden while the vault is locked, and in-place recovery of a wedged Firestore connection — most visible in the desktop WebView after sleep / a network switch — via a long-polling transport plus a reconnect on window focus, instead of needing a full app restart.
- Added a quick-note bar on the home screen: jot and save a plain-text note instantly without opening the full editor (it persists a real text note, so it reopens unchanged).
- Overhauled the Help screen into macro-categories with fuller docs and on-device AI smart search; translated the Help content into ES, FR, DE, ZH, JA.
- Unified every editor's bottom actions (AI, voice, to-do mode, add) behind a single shared action dock, consistent across text, to-do, kanban and code notes.
- Untitled notes now auto-derive their title from the content.
- Smoother editor open: the formatting toolbar is glued to the keyboard with a fade-in, autofocus is reliable, the editor no longer flashes on open, and the WebView engine is pre-warmed on launch.
- Faster, flash-free launch: removed the startup splash window and paint the WebView background to kill the white flash.
- On Tauri, biometric unlock now aborts instead of silently falling back to the secret code when it's cancelled.
- Made the web/desktop editor toolbar scrollable, aligned editor margins, and improved scrollbar styling on WebKit/Firefox.
- Categories: pinned "All" in the organize screen and made AI icon suggestions deterministic.
- Settings: live GitHub stars and auto-read library versions in the About section.
- The editor subtitle now shows the current size before the maximum.
- Consistent webhook/to-do checkboxes and polished AI editor action buttons.
- Fixed a missing trailing slash on the report endpoint URL.
- Upgraded to Expo SDK 56 (React Native 0.85, React 19.2).
- Migrated react-native-dialog to the 1.3 API.
- Moved the expo-router `app/` and `assets/` directories to the project root.
- Cleared React Native 0.85 / web deprecation warnings and fixed a New Architecture `maxHeight` issue.
- Stabilized settings selector fallbacks.
- Fixed the Linux desktop build by scoping the biometric crate to macOS/Windows.

## v1.1.1

- Added offline notes: keep a note only on this device, excluded from cloud sync. You can detach a synced note to make it local, or re-sync a local note (a new synced copy is created).
- Voice Recognition 2.0: redesigned voice dictation with automatic AI cleanup of the transcript.
- The AI Assistant can now suggest a category directly from the note title.
- Added undo/redo and strikethrough to the text editor toolbar.
- Desktop unlock now supports Touch ID (macOS) and Windows Hello.
- Various fixes.

## v1.0.0

- First stable release of Fast Memo Desktop (out of BETA).
- Brand-new modern design: the entire app has been redesigned with the new Geist font, glass surfaces, gradients and refreshed design tokens.
- Redesigned onboarding with new intro steps and illustrations.
- Added note creation settings to customize the default options for new notes.
- Added step mode for To-Do notes.
- Refreshed app icon and splash screen.
- Various fixes and improvements.

## v0.3.1

- Added new note type: Code note with built-in code editor (CodeMirror), syntax highlighting, multiple tabs (up to 6), language
  selector with auto-detection from file extension, and drag-to-reorder tabs.
- Added find and replace functionality in text notes.
- Added note export.
- Added developer mode.
- Various fixes.

## v0.2.1

- Fix causing note not to be loaded

## v0.2.0

- Added the ability to reorder kanban columns with left/right arrows in the column header.
- Improved animations.
- Various fixes.

## v0.1.1

- Fixed cloud sync not updating when the app window regains focus: added visibilitychange listener to trigger an immediate sync.
- Fixed notes not being sorted after a cloud sync: notes received from other devices are now sorted according to the user's
  configured order.
- Fixed sync interval being unnecessarily restarted on network events that didn't change connectivity state.
- Fixed acknowledgement write to Firebase (devicesToSync) not being awaited after applying synced changes, which could cause
  duplicate syncs.
- Fixed unhandled promise rejections in cloud upload functions that could silently break the sync queue.
- Fixed Lottie splash animation not appearing on first launch on web/desktop.

## v0.1.0

- Initial release of Fast Memo Desktop (BETA) with all mobile features.
