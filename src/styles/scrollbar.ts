import { COLOR } from "@/constants/styles";

/**
 * The app's scrollbar (the scrollbar rules of `global.css`), for the pages the app embeds: the text and code editors are
 * documents of their own (an iframe on desktop) that the app's CSS doesn't reach, so they'd show the system's scrollbar,
 * light on Windows. `scripts/richtext.test.mjs` checks the text editor has every scrollbar rule of `global.css`.
 */
export const SCROLLBAR_CSS = `
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.12);
    border: 2px solid transparent;
    background-clip: padding-box;
    border-radius: 999px;
  }
  ::-webkit-scrollbar-thumb:hover { background-color: ${COLOR.accent}; }
  ::-webkit-scrollbar-thumb:active { background-color: ${COLOR.accentDeep}; }
  ::-webkit-scrollbar-corner { background: transparent; }
  * { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.18) transparent; }
`;
