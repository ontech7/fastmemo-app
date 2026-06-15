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
