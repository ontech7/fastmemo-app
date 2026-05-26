import { useEffect } from "react";

function isEditable(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable === true;
}

/**
 * Web/Tauri only. In a WebView the Backspace ("cancella") key triggers history
 * back-navigation when focus isn't in a text field, yanking the user out of the
 * current screen. Swallow it everywhere except editable elements, where it must
 * still delete characters. The mobile bundle uses the no-op sibling.
 */
export function usePreventBackspaceNav(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      if (isEditable(e.target)) return;
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
