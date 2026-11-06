import type { Config } from "dompurify";

import { NOTE_HTML_CONFIG } from "@/editor/sanitizeConfig";

/**
 * What DOMPurify keeps of HTML an agent writes through the local MCP server (ADR-032): the note's config (ADR-021), and
 * nothing that fetches when the note is opened. DOMPurify's defaults keep images, media and SVG (and `style` with
 * `url(...)`), and each opening of the note would then tell whoever's address an injected agent wrote that the user is
 * reading it. Links stay: a link fetches only when it's clicked. Only for input from an agent; the editor's and an
 * import's HTML keep their images.
 */
export const AGENT_HTML_CONFIG: Config = {
  ...NOTE_HTML_CONFIG,
  FORBID_TAGS: [
    ...(NOTE_HTML_CONFIG.FORBID_TAGS ?? []),
    // Media and embeds.
    "img",
    "picture",
    "source",
    "video",
    "audio",
    "track",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "portal",
    "canvas",
    // SVG and MathML bring their own references (`image`, `feImage`, `use`, `xlink:href`).
    "svg",
    "image",
    "feimage",
    "use",
    "math",
  ],
  FORBID_ATTR: [
    ...(NOTE_HTML_CONFIG.FORBID_ATTR ?? []),
    // What names a file to load, on any element that survives. `style` goes whole: `url(...)` can be written with escapes
    // (`u\72l(`) that no pattern is sure to catch, and the tool lists nothing that needs one.
    "src",
    "srcset",
    "poster",
    "background",
    "data",
    "style",
    "ping",
    "longdesc",
    "lowsrc",
    "dynsrc",
    "xlink:href",
  ],
};
