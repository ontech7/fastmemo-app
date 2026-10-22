// Native (iOS/Android) no-op: a WebView's messages reach the app through the bridge, not through `window`. The web build
// uses the `.web.ts` sibling.
export function installMessageGuard(): void {
  // no-op
}
