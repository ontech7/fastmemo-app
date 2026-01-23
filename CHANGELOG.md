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
