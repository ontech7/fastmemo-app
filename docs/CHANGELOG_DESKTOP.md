## v0.3.0

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
