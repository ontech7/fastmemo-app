<div align="center">

<img width="600" height="114" alt="GithubLogo" src="https://github.com/user-attachments/assets/2b91e421-2c6b-4739-bb16-1220bd591667" />

**A powerful, cross-platform note-taking application with rich text editing, to-do lists, kanban boards, and end-to-end
encrypted cloud sync.**

![Android](https://badgen.net/badge/Android/v4.0.0/blue) ![Desktop](https://badgen.net/badge/Desktop/v2.0.0/blue)
![iOS](https://badgen.net/badge/iOS/dismissed/grey)

[Download](https://github.com/ontech7/fastmemo-app/releases) | [Documentation](docs/) |
[Report Bug](https://github.com/ontech7/fastmemo-app/issues)

---

If you find this project useful, consider [buying me a coffee](https://www.buymeacoffee.com/ontech7)! ☕

</div>

## Table of Contents

- [Features](#features)
- [Cloud Sync](#cloud-sync)
- [Screenshots](#screenshots)
- [Documentation](#documentation)
- [Desktop Installation](#desktop-installation)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [Credits](#credits)

## Features

| Feature                  | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| **AI Assistant (BETA)**  | On-device AI with Qwen3.5 (0.8B-4B). No data leaves your phone         |
| **Rich Text Editor**     | Create beautifully formatted notes with full rich text support         |
| **To-Do List**           | Organize your checklist                                                |
| **Kanban Boards**        | Visualize tasks with drag-and-drop kanban notes                        |
| **Code Editor**          | Write code with syntax highlighting, tabs, and language detection      |
| **Cloud Sync**           | End-to-end encrypted sync on your Firebase or your own FastMemo Server |
| **Biometric Protection** | Secure sensitive notes with fingerprint or secret code                 |
| **Webhooks**             | Explore new stuff with Internet of Things                              |
| **Voice Recognition**    | Dictate notes using speech-to-text on text and todo notes              |
| **Multi-language**       | English, Italian, French, German, Spanish, Chinese and Japanese        |

<details>
<summary><strong>View all features</strong></summary>

- On-device AI actions inside note editors: generate title, summarize (long notes too, summary on top), fix grammar, make
  shorter, translate into a chosen language, suggest checklist items, suggest category, clean up voice dictation
- Notes and categories creation with custom icons
- Sort notes by creation or update date
- Filter and deep search across all notes
- Important notes (pinned to top)
- Protected notes (biometric authentication)
- Read-only notes
- Hidden notes
- Bulk actions (delete, toggle important/protected/read-only)
- Temporary trash (deleted for good after 30 days by default; 3, 7, 15 or 30)
- Category management and reordering
- Share notes
- Import/Export with encrypted passphrase

</details>

## Cloud Sync

Fast Memo works fully offline: your notes live on your device and sync is optional. When you turn it on, **you choose where your
notes are kept**. There is no Fast Memo account and no central Fast Memo server, and either way the note contents are
**end-to-end encrypted** on your devices, with a password only you know, before they leave them.

![Google Firebase](docs/images/cloud-firebase.png)

![FastMemo Server](docs/images/cloud-fastmemo-server.png)

|                                 | Google Firebase                                                               | FastMemo Server                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**                  | Your own project on Google's cloud                                            | A small open-source server you run yourself (one Docker container)                                                                    |
| **Where your notes are stored** | In your Firebase project, on Google's servers                                 | On your PC, NAS, Raspberry Pi or VPS                                                                                                  |
| **Cost**                        | The free plan is enough                                                       | Free, on your own hardware                                                                                                            |
| **What you enter in the app**   | API Key, Project ID and App ID                                                | The server's address and access key                                                                                                   |
| **Devices**                     | Up to 3                                                                       | 10 by default (configurable)                                                                                                          |
| **Best for**                    | The quickest setup, with nothing to keep running                              | Full control: your notes stay on your own hardware                                                                                    |
| **Setup**                       | [Google Firebase guide](https://fastmemo.losav.cc/en/guides/google-firebase/) | [FastMemo Server guide](https://fastmemo.losav.cc/en/guides/self-hosting/) · [repository](https://github.com/ontech7/fastmemo-server) |

Both work the same way in the app, on Android, desktop and the web:

- **End-to-end encryption**: only your encryption password unlocks the notes, and it never leaves your devices; a recovery key
  gets you back in if you forget it. Note titles are not encrypted yet.
- **Live sync**: changes reach your other devices within seconds, and a note open elsewhere updates in place.
- **Offline first**: changes made offline are queued and sent when you're back online.
- **No lost edits**: a note changed on two devices before they synced keeps both versions, one as a "(conflict)" copy.

How it all works, from the first sync to the encryption design: [Cloud Sync](docs/CLOUD_SYNC.md).

## Screenshots

<img width="2940" height="3126" alt="screenshots_app" src="https://github.com/user-attachments/assets/28ace577-7cb7-4fed-bd0b-a8eb836dba60" />

## Documentation

| Document                                                     | Description                                   |
| ------------------------------------------------------------ | --------------------------------------------- |
| [Cloud Sync](docs/CLOUD_SYNC.md)                             | Firebase or FastMemo Server, encryption       |
| [Releases](https://github.com/ontech7/fastmemo-app/releases) | What's new in each version (Android, desktop) |
| [Self-Hosting Guide](docs/SELF_HOSTING.md)                   | Host the Fast Memo web app yourself           |
| [Tauri Setup](docs/TAURI_SETUP.md)                           | Build the desktop app (macOS, Windows, Linux) |

## Desktop Installation

Since Fast Memo is an open-source app distributed outside official app stores, your operating system may show a security
warning. Here's how to proceed:

<details>
<summary><strong>macOS</strong></summary>

macOS Gatekeeper will block the app because it's not notarized by Apple.

**Option 1: System Settings**

1. Try to open the app (it will be blocked)
2. Go to **System Settings → Privacy & Security**
3. Scroll down and click **"Open Anyway"**

**Option 2: Terminal**

```bash
xattr -cr /Applications/Fast\ Memo.app
```

</details>

<details>
<summary><strong>Windows</strong></summary>

Windows SmartScreen may show a warning because the app is not signed with an EV certificate.

1. Click **"More info"**
2. Click **"Run anyway"**

</details>

<details>
<summary><strong>Linux</strong></summary>

If the AppImage doesn't run, make sure it's executable:

```bash
chmod +x Fast_Memo_*.AppImage
./Fast_Memo_*.AppImage
```

</details>

## Tech Stack

| Technology                                                                                     | Purpose                                               |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [Expo](https://expo.dev/)                                                                      | React Native framework for cross-platform development |
| [React Native](https://reactnative.dev/)                                                       | Core framework for iOS and Android                    |
| [Tauri](https://tauri.app/)                                                                    | Desktop application framework                         |
| [llama.rn](https://github.com/mybigday/llama.rn)                                               | On-device LLM inference (Qwen3.5 GGUF)                |
| [CodeMirror 6](https://codemirror.net/)                                                        | Code editor engine (bundled via esbuild)              |
| [Google Firebase](https://firebase.google.com/)                                                | Cloud sync on your own Firebase project               |
| [FastMemo Server](https://github.com/ontech7/fastmemo-server)                                  | Self-hosted cloud sync (Node.js, SQLite/PostgreSQL)   |
| [Redux](https://react-redux.js.org/) + [Redux Persist](https://github.com/rt2zz/redux-persist) | State management and persistence                      |
| [Heroicons](https://heroicons.com/)                                                            | Icon library                                          |

## Contributing

Contributions are welcome! If you'd like to help improve Fast Memo:

1. **Report bugs** - Open an [issue](https://github.com/ontech7/fastmemo-app/issues) with details about the problem, your OS,
   app version, and steps to reproduce.
2. **Submit PRs** - Fork the repo, make your changes, and submit a pull request.

## Credits

Created by Andrea Losavio • [LinkedIn](https://www.linkedin.com/in/andrea-losavio/) - [Website](https://andrealosavio.com)

---

<div align="center">
<sub>Originally released: November 14, 2022 | Migrated to New Architecture: August 11, 2025</sub>
</div>
