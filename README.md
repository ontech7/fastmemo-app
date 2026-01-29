<div align="center">

![Fast Memo](https://i.imgur.com/dPRR6pJ.png)

**A powerful, cross-platform note-taking application with rich text editing, to-do lists, kanban boards, cloud sync, etc.**

![Android](https://badgen.net/badge/Android/v2.7.0/blue) ![Desktop](https://badgen.net/badge/Desktop/v0.1.0/blue)
![iOS](https://badgen.net/badge/iOS/dismissed/grey)

[Download](https://github.com/ontech7/fastmemo-app/releases) | [Documentation](docs/) |
[Report Bug](https://github.com/ontech7/fastmemo-app/issues)

---

If you find this project useful, consider [buying me a coffee](https://www.buymeacoffee.com/ontech7)! ☕

</div>

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Documentation](#documentation)
- [Desktop Installation](#desktop-installation)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [Credits](#credits)

## Features

| Feature                  | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| **Rich Text Editor**     | Create beautifully formatted notes with full rich text support      |
| **To-Do List**           | Organize your checklist                                             |
| **Kanban Boards**        | Visualize tasks with drag-and-drop kanban notes                     |
| **Cloud Sync**           | Encrypted synchronization across all devices (no centralized)       |
| **Biometric Protection** | Secure sensitive notes with fingerprint or secret code              |
| **Webhooks**             | Explore new stuff with Internet of Things                           |
| **Voice Recognition**    | Dictate notes using speech-to-text on text and todo notes           |
| **Multi-language**       | Available in English, Italian, French, German, Spanish, and Chinese |

<details>
<summary><strong>View all features</strong></summary>

- Notes and categories creation with custom icons
- Sort notes by creation or update date
- Filter and deep search across all notes
- Important notes (pinned to top)
- Protected notes (biometric authentication)
- Read-only notes
- Hidden notes
- Bulk actions (delete, toggle important/protected/read-only)
- Temporary trash (auto-delete after 7 days)
- Category management and reordering
- Share notes
- Import/Export with encrypted passphrase

</details>

## Screenshots

![App Preview](https://i.imgur.com/YO8xtam.png)

## Documentation

| Document                                         | Description                                   |
| ------------------------------------------------ | --------------------------------------------- |
| [Roadmap](docs/ROADMAP.md)                       | Upcoming features and development plans       |
| [Cloud Sync](docs/CLOUD_SYNC.md)                 | How online sync works                         |
| [Changelog (Mobile)](docs/CHANGELOG_MOBILE.md)   | Version history for Android                   |
| [Changelog (Desktop)](docs/CHANGELOG_DESKTOP.md) | Version history for Desktop                   |
| [Self-Hosting Guide](docs/SELF_HOSTING.md)       | Deploy Fast Memo on your own server           |
| [Tauri Setup](docs/TAURI_SETUP.md)               | Build the desktop app (macOS, Windows, Linux) |

## Desktop Installation

Since Fast Memo is an open-source app distributed outside official app stores, your operating system may show a security warning. Here's how to proceed:

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
| [Google Firebase](https://firebase.google.com/)                                                | Cloud sync and data storage                           |
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
