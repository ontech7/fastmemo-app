## 🖥 Desktop 2.1.0

- The AI assistant on the computer too: fix, shorten, translate and summarize, all on your device.
  - The same Qwen3.5 models as the phone (0.8B, 2B or 4B), run by [llama.cpp](https://github.com/ggml-org/llama.cpp): no note
    leaves the computer, and the only download is the model itself.
  - Apple Silicon Macs run it on the GPU; Windows, Linux and Intel Macs on the CPU, with half the cores, so the computer stays
    usable while it writes.
  - The engine loads the first time you use the AI: with the AI off, the app starts as before. A computer that can't run it says
    so, and everything else works as usual.
  - A model download resumes where it stopped and is checked against the model's checksum.
  - Long notes are processed one part at a time with their progress, and every result is previewed before you apply it.
- Connect AI agents like Claude or Cursor to your notes through MCP: off by default, and locked or hidden notes stay out of
  reach.
  - A local [MCP](https://modelcontextprotocol.io) server: an agent can search and read your notes and create notes of all four
    types. Editing and trashing start switched off, and every tool has its own switch in Settings.
  - An agent edits only the notes it created in the same session, and can lock a note or make it read-only, never the reverse.
  - The agent connects to the app through a channel only your user account can open: no network port.
  - What an agent reads goes to its AI provider, so locked and hidden notes are never found or read, with no switch to change
    that.
  - On Windows and Linux, while MCP is on, an icon in the tray keeps the app reachable with its window closed.
- A window that feels like an app: a dark title bar, no browser menus or shortcuts.
  - The title bar is dark on Windows and macOS, and on Windows 11 it takes the app's own color.
  - Right-click opens a menu only over text, so the browser's Reload, which lost unsaved edits, is gone; on Windows that menu
    offers only cut, copy and paste.
  - Browser keys like print, zoom or find-in-page no longer do anything.
  - On Windows, a minimized window pauses its page, so it uses no CPU in the background.
  - Settings and the secret code keep a readable width on a wide window.
- Various fixes and improvements.
  - Cmd+B, Cmd+I and Cmd+U style a text note on macOS.
  - A read-only note wraps long links and keys as it does while editing, and its find bar only finds, with no replace.
  - The text and code editors use the app's scrollbar.
