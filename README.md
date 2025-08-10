![Fast Memo](https://i.imgur.com/dPRR6pJ.png)

![version](https://badgen.net/badge/version/v2.3.0/black?icon=github)
![Android](https://badgen.net/badge/android/deployed/green?icon=github)
![iOS](https://badgen.net/badge/iOS/dismissed/grey?icon=github)
![web](https://badgen.net/badge/web/coming%20soon/grey?icon=github)

Memo application for Mobile and Tablets, made in React Native using Expo

# Build

![Build](https://i.imgur.com/YO8xtam.png)

# Features

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
- [ ] ...

# Cloud Sync with Google Firebase

![Firebase](https://i.imgur.com/W9Uyfp7.png)

This section provides an overview of the cloud synchronization process using **Google Firebase** to enable data sharing across
devices.  
The main goal is to ensure seamless and reliable synchronization between a local app and a Firestore app, using the API key,
project ID, and app ID provided by Google Firebase.

## Requirements

Before getting started, you need a Google account to create a Firestore app and obtain the necessary credentials for connection.

Make sure you have the following information:

- **API key**: a unique key that identifies the Firebase project.
- **Project ID**: the unique identifier of the Firebase project.
- **App ID**: the identifier of the app within the Firebase project.

## Functionality

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

## Conclusion

Cloud synchronization with Google Firebase offers a reliable and secure way to share and synchronize data across devices.  
Leveraging the features of Firestore and the Firebase APIs, you can ensure seamless synchronization.  
It's worth noting that Google Firebase is a **free service**, making it an accessible choice for everyone.

# Libraries used

- [**Expo**](https://expo.dev/): Open-source wrapper framework for building React Native apps, for iOS, Android and eventually
  web.
- [**React Native**](https://reactnative.dev/): Open-source framework for building apps for iOS and Android.
- [**Heroicons**](https://heroicons.com/): A React Native library for icons
- [**Google Firebase**](https://firebase.google.com/): A serverless platform for save and syncing elaborated data, in a scalable
  solutions.
- [**React Redux**](https://react-redux.js.org/): A state-management library for React and React Native.
- [**Redux Persist**](https://github.com/rt2zz/redux-persist): An add-on for React Redux to have an easy persistance of the data
  inside the app.
