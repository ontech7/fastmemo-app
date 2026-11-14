// Native (iOS/Android): the phone's PDF is expo-print's (`@/utils/export`), as before. The web build uses the `.web.ts`
// sibling.

export { printCss } from "@/libs/printCss";

/** Whether "Print or save as PDF" replaces the picture PDF here. */
export const canPrint = false;

export async function printNote(_title: string, _html: string): Promise<void> {}

export function setPrintable(_print: (() => void) | null): void {}

export function printCurrent(): boolean {
  return false;
}
