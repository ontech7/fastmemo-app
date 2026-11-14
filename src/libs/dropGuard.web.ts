/**
 * A file dragged onto the app's window, outside a note that takes pictures, would open in it and replace the app (a PDF
 * on the desktop's window, a photo in a browser's tab). The window takes no file: the note's own page, an iframe, takes
 * its pictures itself. Text and HTML dragged are left alone. Installed once, by `app/_layout.tsx`.
 */
export function installDropGuard(target: Pick<EventTarget, "addEventListener"> = window): void {
  const stop = (event: Event) => {
    const data = (event as DragEvent).dataTransfer;
    if (!data || !Array.from(data.types ?? []).includes("Files")) return;
    event.preventDefault();
    if (event.type === "dragover") data.dropEffect = "none";
  };
  target.addEventListener("dragover", stop);
  target.addEventListener("drop", stop);
}
