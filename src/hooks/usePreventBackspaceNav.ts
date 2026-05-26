// Native (iOS/Android) no-op: there is no WebView history to navigate, so the
// Backspace key has nothing to intercept. The web build uses the `.web.ts`
// sibling. Kept as a stub so the import resolves on every platform.
export function usePreventBackspaceNav(): void {
  // no-op
}
