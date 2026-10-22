## v4.0.0

- New sync engine behind a `CloudBackend` (ADR-016): live listeners, a revision per note, edits merged per note instead of whole-list overwrites, and conflicting edits from two devices kept as a "(conflict)" copy instead of one silently replacing the other. A note open in the editor reloads live when another device changes it, keeping the caret, without a toast per change.
- Self-hosted FastMemo Server as a second cloud next to Google Firebase (ADR-017): pick the backend when connecting (with the Firebase and FastMemo logos), same per-vault end-to-end encryption, the devices screen shows the backend's device limit, plain HTTP allowed, with a warning on the connect screen, and an answer that came through a redirect is never taken as the server's.
- On-device AI moved from Qwen 2.5 to Qwen3.5 0.8B / 2B / 4B (ADR-004 revised): the model is pre-warmed and answers stream in; new actions fix grammar, make a text shorter and translate a note into a language you choose; long notes are processed one paragraph at a time, with the summary placed at the top of the note; voice dictation can be cleaned up into list and checklist items; AI results apply only to the text the model read; the code actions are gone and the old model files are offered for deletion. A developer-only evaluation screen measures load time and per-action timings.
- Removing a device from the cloud asks for confirmation (Firebase and FastMemo Server).
- AI model download through Android's DownloadManager (ADR-028, local `fastmemo-downloads` module): it goes on with the screen off and the app in the background or closed, resumes after the network drops and shows its progress in a notification; the AI screen shows a download under way when reopened (it said "Not downloaded"), "Waiting for the network" while the system holds it, and why it failed (no space, other errors); the download turns the AI on even if the screen was closed. A cut-off file is staged apart until it's whole, and a partial file left by an older download now counts as an old model to delete.
- AI previews: the before and the result scroll on their own (each with a maximum height), the result keeps its end in sight while the model writes until you scroll up; "Suggest category" is previewed too, before/after with Apply, and when the model was torn between two categories (from its token probabilities) both are offered to choose from (ADR-027). The AI Assistant settings no longer say BETA.
- AI reliability: a cancel holds through the model load, one completion runs at a time, answers are no longer cut off, categories are chosen by grammar; long-note rewrites keep quotes, sentence ends and the summary label, and a grammar fix that drops most of the words is thrown away.
- Text notes, image menu (ADR-024): tapping an image opens a menu at the tap point with its size (S/M/L/Full, a width in % of the note with the ratio kept), its line's alignment (not inside a code block), a quarter turn (JPEG, PNG and WebP, re-encoded to stay within 15% of its size), a full-screen viewer (pinch, pan, double tap to zoom), share (as a file, to any app) and delete. Every change can be undone, a choice on an image another device changed meanwhile is ignored, a link around the image is kept, the caret stays where it was (LL-065), and a long press is left to the system's selection; a read-only note offers view and share only.
- Rich text editor (ADR-023, LL-062): heading, code and lists are exclusive line types, and the button of the current type turns the line back into text. H1 no longer grows on every press, nothing nests (a list in a heading, a code block in a code block), a heading takes a bullet out of its list, the caret keeps its place, Enter in a code block adds a line (it split the block on Android's WebView) and twice leaves it, Backspace at the start of a bullet removes it, and an image goes in at the caret with the caret on a new line. Notes saved with the old nested markup show correctly. `scripts/richtext.test.mjs` runs the real editor page in headless Chrome.
- Notes stored one value per note and written only when they change (ADR-018), instead of rewriting every note on each save: a crash at any step of a write loses nothing, a slow or failed read never writes the notes back, and reads go 32 at a time.
- Editors commit edits in batches and flush them when leaving the note or the app (ADR-013); the code editor loads its grammars on demand and keeps an undo history per tab.
- A note's HTML is sanitized with DOMPurify inside the editor (ADR-021): a note from an import or another device can never run code or pose as an app control.
- Expo SDK 58, React Native 0.88, React 19.3 (New Architecture, Hermes V1), with Reanimated 4.7, FlashList 2.3 and llama.rn 0.12; new: expo-updates, expo-alternate-app-icons, DOMPurify.
- OTA updates with EAS Update (ADR-014): JS-only fixes reach installed apps without a store release, guarded by the build fingerprint (the Publish OTA workflow refuses native changes and needs a store build of the same version); the app shows "X.Y.Z · OTA N".
- The vault key is derived with native PBKDF2 (local `fastmemo-crypto` module), with one key per passphrase on every path; the vault screens are translated into every language and keep their actions above the fold; the recovery key screen can't be left before the key is confirmed.
- A three-step first-note tour replaces the welcome note on a new install (ADR-019); roomier text toolbar.
- Accessibility: names, roles and states for icon-only controls, hidden controls out of the tab order.
- Seasonal alternate app icons (Halloween, Christmas, Easter, Summer) under Developer options (ADR-020).
- Faster start (ADR-025, LL-066): the Geist fonts are built into the app (nothing to load before the first frame), kotlin-reflect is warmed up on its own thread so the first notes read and the store's rehydration no longer wait for it, and the home screen opens with no animation (the intro keeps its fade); plus deep heroicons imports, a cached date formatter and the WebView warm-up after the home screen's first frame.
- Sync fixes: newer edits stay queued, each note and category id is in one queue only, a restored note isn't deleted by a stale deletion, an edit made in an open editor no longer fails its push for good, a change in flight can't undo a live reload, saving the settings while connected doesn't re-enroll the device, and notes 3.2.0 received from a newer version don't produce conflict copies.
- Note size per cloud (ADR-026, LL-067): the limit comes from the cloud in use (Firestore's 1 MiB document, or the FastMemo server's `MAX_NOTE_MB`, now in `/v1/info`), measured on the note as sent, encrypted. A note over it isn't sent: it becomes offline on every device, each keeping its copy, with a notice. The text editor shows the cloud's limit as text (about 0.71 MB on Firebase), and a note already over it can still be cut down. Fixes text notes of 0.75 to 1 MB that never synced on Firebase, with nothing said.
- Auto-titles are longer and cut at a word boundary.
- UI fixes: changelog bullets with hanging indents, no autocapitalize/autocorrect on credentials and URLs, fields no longer hidden by the keyboard, no splash logo left on screen after closing every screen at once, the to-do progress as one translated sentence.
- Help brought up to date: toolbar, AI actions, the FastMemo Server guide, conflict copies, update flow, and new topics on the quick-note bar and voice dictation.
- Translations: German uses "Sie" everywhere with its umlauts restored, broken webhook labels fixed, missing accents restored in Italian, Spanish and French, and several wrong strings corrected.
- The website moved to fastmemo.losav.cc: the app's links and update check use it.

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
