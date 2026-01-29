# Cloud Sync

This is how Fast Memo sync with Cloud database.

## Table of Contents

- [With Google Firebase](#with-google-firebase)
- [With PostgreSQL](#with-postgresql)

## With Google Firebase

<div align="center">

![Firebase](https://i.imgur.com/W9Uyfp7.png)

</div>

Fast Memo uses **Google Firebase** for secure, encrypted cloud synchronization across all your devices. Firebase is a **free
service**, making it accessible for everyone.

### Requirements

You'll need a Google account to create a Firebase project. Once set up, you'll need:

- **API Key** - Identifies your Firebase project
- **Project ID** - Unique identifier of your project
- **App ID** - Identifier of your app within Firebase

### How It Works

| Step                | Description                                          |
| ------------------- | ---------------------------------------------------- |
| **1. Handshake**    | Establishes secure connection using your credentials |
| **2. Upload**       | Local data is encrypted and uploaded to Firestore    |
| **3. Download**     | Cloud changes from other devices are synced locally  |
| **4. Encryption**   | All data is encrypted during transmission            |
| **5. Multi-device** | Manage connected devices in cloud settings           |
| **6. Auto-sync**    | Checks for updates every 20 seconds                  |
| **7. Offline mode** | Changes queue locally and sync when back online      |

## With PostgreSQL

_Soon_
