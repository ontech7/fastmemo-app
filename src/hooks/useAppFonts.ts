// The apps have the Geist weights built in (the expo-font plugin in app.config.ts): nothing to load, ready from the first
// frame. The web loads them in the `.web.ts` sibling.
export function useAppFonts(): [loaded: boolean, error: Error | null] {
  return [true, null];
}
