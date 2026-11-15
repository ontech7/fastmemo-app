import { configs } from "@/configs";
import { requestLaunch } from "@/libs/launch";
import { parseLaunch } from "@/libs/launch/parse";
import { setPendingLaunch } from "@/libs/launch/pending";

/** This build's own scheme ("fastmemoapp", "fastmemoapptest"), as app.config.ts writes it. */
const SCHEMES = [configs.app.slug.toLowerCase()];

/**
 * Every link that opens the app (spec D.1, ADR-043): what it asks for is kept for the home if it is on the allow-list
 * (`parseLaunch`); no route of the app can be opened by a link. The link that starts the app goes to "/", the start
 * screen, which hands over to the home. One that arrives while the app runs brings the home to the front first and only
 * then leaves the action (`requestLaunch`): the router itself goes nowhere, or the home's new screen would be closed by
 * the link's own navigation. Never throws.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    const action = parseLaunch(path, SCHEMES);
    if (initial) {
      if (action) setPendingLaunch(action);
      return "/";
    }
    requestLaunch(action);
  } catch {
    // the home, whatever happened
    if (initial) return "/";
  }
  return null;
}
