// The text editor's cases (scripts/richtext.test.mjs) a second time, in Safari: the desktop app's engine is WebKit
// (WKWebView), and so is iOS's. Driven over WebDriver (safaridriver ships with macOS), on the page served from 127.0.0.1.
// What only Chrome's protocol can do (touches, a composition) is skipped by name.
// Run: node scripts/richtext-webkit.test.mjs   (needs Safari → Develop → Allow Remote Automation; off: skipped, exit 0)

import { buildPage, safariDriver } from "./lib/richtextPage.mjs";
import { runCases } from "./richtext.test.mjs";

const driver = await safariDriver();
if (!driver) {
  console.log("Safari remote automation is off: skipped");
  process.exit(0);
}
const page = await buildPage();
let result;
try {
  result = await runCases(driver, page, await page.serve());
} finally {
  await driver.close();
  page.dispose();
}
for (const name of result.skipped) console.log(`- skipped in Safari: ${name}`);
console.log(`${result.passed} passed, ${result.failures.length} failed`);
for (const f of result.failures) console.log("✗ " + f);
process.exit(result.failures.length ? 1 : 0);
