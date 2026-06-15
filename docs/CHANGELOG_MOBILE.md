## v3.2.0

- Cloud sync is now end-to-end encrypted per vault: notes are sealed with a key derived from your passphrase (envelope DEK/KEK scheme), with a one-time recovery key and password change/reset flows. The old global key is gone, and legacy notes sealed with the previous empty key are migrated automatically.
- Hardened the encrypted sync: self-healing sync, manual per-device sync, "wipe + cloud" hidden while the vault is locked, and in-place recovery of a wedged Firestore connection (long-polling transport + reconnect on app resume) instead of needing a restart.
- Added a quick-note bar on the home screen: jot and save a plain-text note instantly without opening the full editor (it persists a real text note, so it reopens unchanged).
- Overhauled the Help screen into macro-categories with fuller docs and on-device AI smart search; translated the Help content into ES, FR, DE, ZH, JA.
- Unified every editor's bottom actions (AI, voice, to-do mode, add) behind a single shared action dock, consistent across text, to-do, kanban and code notes.
- Untitled notes now auto-derive their title from the content.
- Smoother editor open: the formatting toolbar is glued to the keyboard with a fade-in, autofocus is reliable, the editor no longer flashes on open, and the WebView engine is pre-warmed on launch.
- Fixed the soft keyboard not rising in the code editor on Android.
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

## v3.1.1

- Added offline notes: keep a note only on this device, excluded from cloud sync. You can detach a synced note to make it local, or re-sync a local note (a new synced copy is created).
- Voice Recognition 2.0: redesigned voice dictation with automatic AI cleanup of the transcript.
- The AI Assistant can now suggest a category directly from the note title.
- Added undo/redo and strikethrough to the text editor toolbar.
- Various fixes.

## v3.0.0

- Brand-new modern design: the entire app has been redesigned with the new Geist font, glass surfaces, gradients and refreshed design tokens.
- Redesigned onboarding with new intro steps and illustrations.
- Added note creation settings to customize the default options for new notes.
- Added step mode for To-Do notes.
- Refreshed app icon and splash screen.
- Improved editor readiness handling for a smoother writing experience.
- Various fixes and improvements.

## v2.9.1

- Fixed losing focus when writing in NoteTextEditor
- Migrated all dynamic require() platform gates to file-based splits
- Extracted shared editor boilerplate into useNoteEditor hook

## v2.9.0

- Added new note type: Code note with built-in code editor (CodeMirror), syntax highlighting, multiple tabs (up to 5), language
  selector with auto-detection from file extension, and drag-to-reorder tabs.
- Added Qwen 2.5 7B model for AI Assistant. Requires 8GB+ RAM. Automatically disabled on unsupported devices.
- Added new AI actions for Code notes: "Explain code" and "Add comments" (requires 7B model).
- Added per-action minimum model requirements: actions that need a larger model are shown as disabled with "Minimum XB" label.
- Added device RAM detection to disable AI models that the device cannot run.
- Added AI output panel for code explanations: scrollable, selectable, dismissible panel next to the AI button.
- Added dynamic context window per AI model (2K for 0.5B, 4K for 1.5B, 8K for 3B, 16K for 7B).
- Added multi-part model download support for split GGUF files.
- Added find and replace functionality in text notes.
- Added note export.
- Added developer mode.
- Improved format_text AI prompt for better structure detection without altering content.
- Various fixes.

## v2.8.0

- Added self-hosted AI Assistant (Qwen 2.5) with smart features for notes. Runs entirely on-device, no data sent to external
  servers. Set it up in Settings -> AI Assistant. Available actions inside the note editor: generate title, summarize, continue
  writing, format text, suggest checklist items, suggest category.
- Added the ability to reorder kanban columns with left/right arrows in the column header.
- Redesigned voice recognition button: removed horizontal expansion, added pulse animation and stop button. The screen now stays
  awake during voice recognition.
- Removed the old AI command bar from the home screen in favor of contextual AI actions inside each editor.
- Added AI Lottie shortcut in the home header to quickly access AI Assistant settings.
- Added AI Assistant section in Help page.
- Improved animations.
- Various fixes.

## v2.7.1

- Fixed cloud sync not updating on app resume: added AppState listener to trigger an immediate sync when the app returns to
  foreground.
- Fixed notes not being sorted after a cloud sync: notes received from other devices are now sorted according to the user's
  configured order.
- Fixed sync interval being unnecessarily restarted on network events that didn't change connectivity state.
- Fixed acknowledgement write to Firebase (devicesToSync) not being awaited after applying synced changes, which could cause
  duplicate syncs.
- Fixed unhandled promise rejections in cloud upload functions that could silently break the sync queue.
- Fixed splash screen (Lottie) appearing briefly on standard app launch: the animation now only plays on first install, while
  returning users go directly to the home screen.

## v2.7.0

- Fixed Kanban Drag and Drop on mobile, tablet and desktop
- Aligned Mobile and Desktop application
- Official release for Desktop application

## v2.6.2

- Fixed sync when using new note type Kanban
- Aligned UI for TrashedNoteCard

## v2.6.1

- Improved Kanban note type experience with Drag and Drop

## v2.6.0

- Added new note type: Kanban note
- Redesigned Home action UI when pressing “+”
- Redesigned note type indicator: now shown as a badge at the top

## v2.5.3

- Various fixes:

1. Fixed VoiceRecognitionButton not working anymore on Android 16
2. Fixed report flag logic (for real)
3. Fixed toggle protected note inside NoteSettings
4. Changed `/notes/todo` and `/notes/text` routes to `/notes/[noteId]` orchestrator route
5. Fixed route-change animations (some animations are inverted)
6. Fixed splash animation sometimes it doesn't appear

## v2.5.2

- Added support to switch app language
- Various fixes:

1. Added custom SafeAreaView because sometimes, in some devices, you encounter flickering bug at start up
2. Added custom useRouter to avoid multiple-push if user clicks fast
3. Updated and adapted @shopify/flash-list to 2.0.3
4. Reworked VirtualNumberKeyboard component
5. Fixed report flag logic
6. Fixed import/export success dialog and added description

## v2.5.1

- Added the ability to reorder notes by creation date and update date.
- Redesign of modals.
- Various fixes.

## v2.4.2

- Revised and improved the app’s internal structure to make it faster and more stable.
- Added voice recognition for note transcription (text and lists).
- Added the ability to perform deep searches (text and lists).
- Various fixes.

## v2.3.0

- Added Japanese language.
- Updated webhooks to BETA version 2.0.
- Miscellaneous fixes.

## v2.2.0

- Added the ability to hide notes.
- Added the ability to report an issue in Settings → Feedback and Assistance.
- Miscellaneous fixes.

## v2.1.0

- Added number of note letters and maximum note size.
- Added number of items in ToDo note.
- Added maximum limit for cloud devices (3).
- Miscellaneous fixes.

## v2.0.0

- Added Cloud Sync with Google Firebase.
- Added Webhooks management (for expert user).
- Added left and center alignment options for text notes.
- Added secret code for some options.
- Changed size of all elements.
- Changed design for secret code screen.
- Changed the style of the To-Do note.
- Miscellaneous fixes.

## v1.4.0

- Added To-Do type note.
- Miscellaneous fixes.

## v1.3.0

- Added translations for Italian, Spanish, French, German and Chinese.
- Added new icons for categories.
- Miscellaneous fixes.

## v1.2.1

- Release in production.
- Added notes, temporary notes, categories, etc.
- Added secret code.
- Miscellaneous fixes.
