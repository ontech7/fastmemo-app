// Native (iOS/Android) no-op: there is no WebView history to navigate and no hardware keyboard shortcuts to handle. The
// web build uses the `.web.ts` sibling. Kept as a stub so the import resolves on every platform.
export function useKeyboardShortcuts(): void {
  // no-op
}
