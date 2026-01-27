![Fast Memo](https://i.imgur.com/dPRR6pJ.png)

![Android](https://badgen.net/badge/android/v2.7.0/blue) ![iOS](https://badgen.net/badge/iOS/dismissed/grey)
![Desktop](https://badgen.net/badge/Desktop/v0.1.0-beta/blue)

Memo application for Mobile, Tablet and Desktop, made in React Native using Expo.

If you like it, kindly [buy me a coffee](https://www.buymeacoffee.com/ontech7) ☕

(original release: **14/11/2022** - migration _newArch_: **11/08/2025**)

## Screenshots / Previews

![Build](https://i.imgur.com/YO8xtam.png)

## Features

- [x] Notes creation
- [x] Categories creation (title + icon)
- [x] Category update (title + icon)
- [x] Filter notes
- [x] Important notes (on top of Normal notes)
- [x] Protected notes (with biometric)
- [x] Read-only notes
- [x] Multiple delete notes, toggle important notes, protected notes and read-only notes
- [x] Temporary trash (delete notes after 7 days)
- [x] Reorganize categories order
- [x] Rich Text
- [x] Share notes
- [x] Import/Export notes with generated passphrase
- [x] Internalization (i18n) for Italian, English, French, German, Spanish and Chinese
- [x] Cloud Sync with encryption
- [x] Hidden notes
- [x] Deep search
- [x] Reorder notes by createdAt and updatedAt dates
- [x] Voice recognition on text and todo notes
- [x] Kanban note
- [ ] ...

## Documentation

- [**Changelog**](docs/CHANGELOG.md) - Version history and updates
- [**Self-Hosting Guide**](docs/SELF_HOSTING.md) - Deploy FastMemo on your own web server
- [**Tauri Setup**](docs/TAURI_SETUP.md) - Build the desktop application (macOS, Windows, Linux)

## Cloud Sync with Google Firebase

![Firebase](https://i.imgur.com/W9Uyfp7.png)

This section provides an overview of the cloud synchronization process using **Google Firebase** to enable data sharing across
devices.  
The main goal is to ensure seamless and reliable synchronization between a local app and a Firestore app, using the API key,
project ID, and app ID provided by Google Firebase.

### Requirements

Before getting started, you need a Google account to create a Firestore app and obtain the necessary credentials for connection.

Make sure you have the following information:

- **API key**: a unique key that identifies the Firebase project.
- **Project ID**: the unique identifier of the Firebase project.
- **App ID**: the identifier of the app within the Firebase project.

### Functionality

Cloud synchronization with Google Firebase is designed to be completely autonomous and on-demand.  
It does not rely on a centralized database or real-time solution but allows for data upload and download between the local app
and Firestore.

Here's how it works:

1. **Connection Handshake**: A connection is established between the local app and the Firestore app using the provided
   credentials. If the connection is successful, the synchronization process can begin.

2. **Uploading Local Data**: Once the connection is established, the data present in the local app is uploaded to the Firestore
   app. This ensures that the data is up-to-date and synchronized at the start of the process.

3. **Downloading Cloud Data**: Subsequently, the data present in the Firestore app is downloaded to the local app. This ensures
   that any changes or updates made by other devices are reflected in the local app, ensuring 100% synchronization.

4. **Encryption of Sent Data**: Every change made in the local app is sent to the Firestore app in an encrypted manner, ensuring
   data security during synchronization.

5. **Managing Multiple Devices**: The cloud synchronization solution allows for the connection of multiple devices. These
   devices can be managed in the cloud settings, particularly in the "Manage Devices" section.

6. **Periodic Checking of Firestore App**: Every 20 seconds, the Firestore app is checked to see if there are any pending
   changes from other devices. If there are changes to be downloaded, they are retrieved and applied to the local app.

7. **Offline Synchronization**: If the device is offline during the synchronization process, the pending changes are
   accumulated. Once the device is back online, the accumulated changes are sent to the Firestore app to ensure complete
   synchronization.

Cloud synchronization with Google Firebase offers a reliable and secure way to share and synchronize data across devices.  
Leveraging the features of Firestore and the Firebase APIs, you can ensure seamless synchronization.  
It's worth noting that Google Firebase is a **free service**, making it an accessible choice for everyone.

## Bugs / Contribution

If you encounter any bugs or experience issues while using **Fast Memo**, we kindly ask you to report the problem by opening an
issue on this repository. Follow the steps below to report a bug:

1. Click on the "Issues" tab at the top of the page.
2. Click on "New Issue" to open a new issue.
3. Describe the bug in as much detail as possible. Providing information such as the operating system, app version, the actions
   you took before the issue occurred, and any error messages will help us better understand the problem.
4. Click "Submit new issue" to create your report.

I will take care of the bugs and improve the Fast Memo experience. Please be patient and keep an eye on your issue for any
updates or clarification requests from me.

**I apprecciate if people will contribute to this project by doing pull requests!**

## Libraries used

- [**Expo**](https://expo.dev/): Open-source wrapper framework for building React Native apps, for iOS, Android and eventually
  web.
- [**React Native**](https://reactnative.dev/): Open-source framework for building apps for iOS and Android.
- [**Heroicons**](https://heroicons.com/): A React Native library for icons
- [**Google Firebase**](https://firebase.google.com/): A serverless platform for save and syncing elaborated data, in a scalable
  solutions.
- [**React Redux**](https://react-redux.js.org/): A state-management library for React and React Native.
- [**Redux Persist**](https://github.com/rt2zz/redux-persist): An add-on for React Redux to have an easy persistance of the data
  inside the app.

## Credits

Written by [Andrea Losavio](https://www.linkedin.com/in/andrea-losavio/).

## APPlogies

_Disclaimer: when I started making this app, I was on another repo with Expo SDK 48 and React Navigation, using JavaScript
instead of TypeScript. Now there is a new repo, migrated on Expo SDK 53 and using Expo Router and New Architecture. I'm sorry if
it's still in JavaScript. Don't have time to convert it to TS._
