# Cloud Sync

This is how Fast Memo syncs your notes between devices. You choose where they're kept: in **your own Google Firebase project**,
or on **your own FastMemo Server** (a PC, NAS, Raspberry Pi or VPS). Either way there is no central Fast Memo server, and notes
are end-to-end encrypted on your devices.

## Table of Contents

- [With Google Firebase](#with-google-firebase)
- [With a FastMemo Server](#with-a-fastmemo-server)
- [How sync works](#how-it-works)
- [End-to-End Encryption](#end-to-end-encryption)

## With Google Firebase

<div align="center">

![Firebase](https://i.imgur.com/W9Uyfp7.png)

</div>

Fast Memo uses **Google Firebase** for secure, end-to-end encrypted cloud synchronization across all your devices. Firebase is a
**free service**, making it accessible for everyone. You bring your own Firebase project — there is no central Fast Memo server,
and the project owner (you) is the only one who can reach the data.

### Requirements

You'll need a Google account to create a Firebase project. Once set up, you'll need:

- **API Key** - Identifies your Firebase project
- **Project ID** - Unique identifier of your project
- **App ID** - Identifier of your app within Firebase

A single Firebase project acts as one **vault**. Up to 3 devices connect to the same vault by entering the same three
credentials above, plus the **encryption password** described below.

## With a FastMemo Server

Run [fastmemo-server](https://github.com/ontech7/fastmemo-server) yourself: one Docker container, one database file. Its README
walks you through it, from trying it on your computer in five minutes to a Raspberry Pi, Coolify or a VPS.

You'll need:

- **Server address** - `https://...` (the web app and the Windows desktop app need HTTPS; Android, macOS and Linux also accept
  `http://` after a warning: over HTTP your device's credentials and note titles travel unencrypted on every network it joins,
  so prefer HTTPS: the guide shows the easy ways, such as Tailscale)
- **Access key** - set on the server, or generated on its first start

The server is one **vault** too: every device connects with the same address and key, plus the **encryption password**. It
allows 10 devices by default (`MAX_DEVICES`). Its dashboard (the server's address in a browser) shows the devices, the reads,
writes and deletes per day, warnings, and makes backups. Removing a device there (or in the app) revokes its access at once.

## How It Works

The same on both clouds:

| Step                | Description                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **1. Handshake**    | Establishes the connection using your Firebase credentials, or your server's address and key       |
| **2. Unlock**       | You enter the encryption password; the vault key is derived locally                                |
| **3. First sync**   | Your notes and the cloud's are merged: what's only here is uploaded (encrypted), the rest comes in |
| **4. Live sync**    | Changes reach your other devices within seconds; a note open on another device updates in place    |
| **5. Multi-device** | Manage connected devices in cloud settings; a note open elsewhere shows "Open on _device_"         |
| **6. Offline mode** | Changes queue locally and go out when back online, retried until the cloud has them                |
| **7. Conflicts**    | A note edited on two devices before they synced keeps both versions (see below)                    |

### Conflicts

Every change carries a revision, so the newer version of a note always wins, whatever order the devices come online in. When a
note was changed on two devices before either change reached the other (for example, one of them was offline), nothing is
overwritten: the newer version stays, and the other is kept next to it as a copy titled "_title_ (conflict)". Keep the one you
want and delete the other. A note deleted on one device and edited later on another comes back; deleted after the edit, it goes
to the trash, edit included.

## End-to-End Encryption

Fast Memo encrypts your note contents **on your device** before they ever reach the cloud (Firestore or your server). The
encryption key is never stored in the cloud and is never baked into the app — it is derived from an **encryption password** that
only you know.

### How the key is protected (envelope encryption)

| Term                    | What it is                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| **Data key (DEK)**      | A random 256-bit key that encrypts every note. It is created once and **never changes**.      |
| **Encryption password** | Your secret. It derives a key (via PBKDF2-SHA256) that **wraps** the data key — nothing else. |
| **Recovery key**        | A one-time code shown at setup. It wraps a second copy of the data key for password recovery. |

Because the password only _wraps_ the data key:

- **Changing your password** re-wraps the data key — a single tiny write. No note is re-encrypted, and other devices that
  already cached the data key keep working without interruption.
- **Each device unlocks once.** After you enter the password, the data key is stored in the device's secure storage (Keychain /
  Keystore on mobile), so you don't re-enter it every launch.

A small `vault` record (a Firestore document, or a row on your server) stores only the public salts and the _wrapped_
(encrypted) copies of the data key plus a verification "canary". None of it is useful without your password or recovery key.

### What is encrypted

- ✅ Note **contents** — text bodies, to-do items, kanban card text, code tabs.
- ⚠️ Note **titles** and metadata (id, type, dates, category id) are currently stored unencrypted, because they are used for
  sync keying and ordering. Title encryption is a planned follow-up.

### If you forget your password

1. On the unlock screen, choose **"Forgot password"**.
2. Enter your **recovery key** and pick a new password.
3. The data key is recovered and re-wrapped under the new password. **No notes are lost.**

If you lose **both** the password and the recovery key, the cloud data cannot be decrypted by anyone — that is the point of
end-to-end encryption. As a last resort you can **reset** the encryption, which creates a fresh vault from the notes currently
on your device and replaces the cloud copy.

### Setup flow

| Situation                                  | What happens                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| **New vault** (fresh project or server)    | You set an encryption password and save the recovery key shown once.         |
| **Existing vault** (joining from a device) | You enter the encryption password to unlock; the device caches the data key. |
| **Upgrading from an older app version**    | Your existing cloud notes are migrated non-destructively under a new vault.  |

> **Migration note:** upgrading from a pre-encryption-password version reads your old cloud notes, sets up the vault, and
> re-encrypts under the new data key without overwriting anything it cannot safely read. Keep all your devices on a recent
> version during the transition — a very old build connecting after migration would read the new format incorrectly.

> **Quick backup:** the setup, unlock, and reset screens offer an optional **Quick backup** button. It exports a
> passphrase-encrypted file of your notes straight from this device (independent of the cloud), so you have a safety net before
> a large sync or a reset. It's optional — your notes are kept locally regardless.
