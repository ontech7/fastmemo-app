import { configs } from "@/configs";
import type { Category, CloudSettings, Note } from "@/types";
import type { Firestore } from "firebase/firestore";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { defaultCategory } from "@/configs/default";
import {
  addDeviceToCloud,
  COLLECTIONS,
  deleteActiveFirebase,
  getAllConnectedDevices,
  getAllDeviceUuids,
  getDeviceUuid,
  Handshake,
  handshakeFirebase,
  initFirebase,
  removeDeviceFromCloud,
  retrieveFirebase,
  setElementInCloud,
  updateLastSyncInCloud,
} from "@/libs/firebase";
import { useRouter } from "@/hooks/useRouter";
import { storeVaultContinuation } from "@/libs/registry";
import { getDEK, isVaultUnlocked } from "@/libs/vaultSession";
import { beginVaultProgress, clearVaultProgress, tickVaultProgress } from "@/libs/vaultProgress";
import { forgetDeviceVault, probeVault } from "@/libs/vaultManager";
import { CryptNote, tryDecryptNote } from "@/utils/crypt";
import { getReversedDateTime } from "@/utils/date";
import { toast } from "@/utils/toast";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCategories, resetCloudCategories, setCategories } from "@/slicers/categoriesSlice";
import { getAllNotes, resetCloudNotes, setNotes } from "@/slicers/notesSlice";
import {
  getCloudConnected,
  getCloudSettings,
  selectorIsCloudSyncEnabled,
  setCloudConnected,
  setCloudSettings,
  setIsCloudSyncEnabled,
} from "@/slicers/settingsSlice";

interface ConnectingState {
  loading: boolean;
  code?: number;
}

export const useCloudSync = () => {
  const { t } = useTranslation();

  const router = useRouter();

  const allNotes = useSelector(getAllNotes);
  const allCategories = useSelector(getCategories);

  const selectorCloudSyncEnabled = useSelector(selectorIsCloudSyncEnabled);
  const selectorCloudSettings = useSelector(getCloudSettings);
  const selectorCloudConnected = useSelector(getCloudConnected);

  const [cloudSettings, setLocalCloudSettings] = useState<CloudSettings>(selectorCloudSettings);
  const firestoreSettings: CloudSettings = {
    ...cloudSettings,
    authDomain: (cloudSettings.projectId ?? "") + ".firebaseapp.com",
    storageBucket: (cloudSettings.projectId ?? "") + ".appspot.com",
    messagingSenderId: cloudSettings.appId.split(":")?.[1] ?? "",
  };

  const [isCloudSyncEnabled, setCloudSyncEnabled] = useState<boolean>(selectorCloudSyncEnabled);
  const [isConnected, setIsConnected] = useState<boolean>(selectorCloudConnected);
  const [isConnecting, setIsConnecting] = useState<ConnectingState>({ loading: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const dispatch = useDispatch();

  const toggleCloudSync = async (): Promise<void> => {
    if (isCloudSyncEnabled) {
      await removeDeviceFromCloud();

      // forget the cached DEK for this device, but leave the cloud vault intact
      // so reconnecting (or another device) can still unlock with the passphrase
      if (cloudSettings.projectId) await forgetDeviceVault(cloudSettings.projectId);

      await deleteActiveFirebase();

      setIsConnected(false);
      dispatch(setCloudConnected(false));

      AsyncStorage.setItem("@cloudSync", JSON.stringify({}));
    }

    setCloudSyncEnabled(!isCloudSyncEnabled);
    dispatch(setIsCloudSyncEnabled(!isCloudSyncEnabled));
  };

  const setCloudSetting = (name: keyof CloudSettings, value: string): void => {
    setLocalCloudSettings({
      ...cloudSettings,
      [name]: value,
    });
  };

  const saveCloudSettings = async (): Promise<void> => {
    setIsConnecting({ loading: true });
    setIsLoading(true);

    initFirebase(firestoreSettings);

    handshakeFirebase(setIsConnecting);
  };

  const editCloudSettings = (): void => {
    setIsConnected(false);
  };

  /**
   * Route an already-connected device that has no usable key yet to the right
   * encryption screen: unlock if a vault exists, otherwise set it up / migrate
   * legacy data. Covers the "updated the app while already connected" case where
   * no vault has ever been created. On success it just resyncs.
   */
  const requestVaultAccess = async (): Promise<void> => {
    const projectId = cloudSettings.projectId;

    // Probe first: on an unverifiable read, do NOT route to create (it could
    // overwrite an existing vault). Ask the user to retry instead.
    const probe = await probeVault();
    if (probe.presence === "error") {
      toast(t("cloudsync.vault.verify_failed"));
      return;
    }

    storeVaultContinuation(async () => {
      await syncCloudData(false);
    });

    if (probe.presence === "present") {
      router.push({ pathname: "/settings/cloud-sync/vault-unlock", params: { projectId } });
    } else if (probe.needsMigration) {
      router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "migrate" } });
    } else {
      router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "create" } });
    }
  };

  /**
   * Open the last-resort reset flow. It wipes the cloud vault + notes and then
   * recreates a vault, re-uploading local notes via this resync continuation.
   * `useReplace` swaps the secret-code screen when unlock wasn't via fingerprint
   * (mirrors the "manage devices" gating), so the back stack stays clean.
   */
  const requestReset = (useReplace: boolean): void => {
    storeVaultContinuation(async () => {
      await syncCloudData(false);
    });
    const target = { pathname: "/settings/cloud-sync/vault-reset", params: { projectId: cloudSettings.projectId } } as const;
    if (useReplace) {
      router.replace(target);
    } else {
      router.push(target);
    }
  };

  const uploadCloudData = async (): Promise<void> => {
    // Drive a determinate progress bar over the data-proportional upload: one
    // write per category + per uploadable note. This is the part that takes
    // several seconds on setup/migration/reset (the PBKDF2 freeze before it
    // can't report progress). Cleared in `finally` so a background sync never
    // leaves a stale bar.
    const uploadableNotes = allNotes.reduce((n, note) => (note.local ? n : n + 1), 0);
    beginVaultProgress(allCategories.length + uploadableNotes);

    try {
      ////////////////////////////////
      // categories
      ////////////////////////////////

      for (let i = 0; i < allCategories.length; i++) {
        const category = allCategories[i];

        await setElementInCloud({
          collection: COLLECTIONS.data.categories,
          identifier: category.icon,
          payload: {
            ...category,
            order: category.order ?? i,
          },
        });
        tickVaultProgress();
      }

      ////////////////////////////////
      // notes
      ////////////////////////////////

      for (let i = 0; i < allNotes.length; i++) {
        const note = allNotes[i];

        // offline notes are device-only and must never be uploaded
        if (note.local) continue;

        await setElementInCloud({
          collection: COLLECTIONS.data.notes,
          identifier: note.id,
          payload: CryptNote.encrypt({
            ...note,
            createdAt: note.createdAt ?? getReversedDateTime(note.date),
            updatedAt: note.updatedAt ?? getReversedDateTime(note.date),
          } as Note),
        });
        tickVaultProgress();
      }
    } finally {
      clearVaultProgress();
    }
  };

  const retrieveCloudData = async (db: Firestore | null): Promise<void> => {
    if (!db) return;

    // Never replace local state without the key to read the cloud copies.
    const dek = getDEK();
    if (!dek) return;

    ////////////////////////////////
    // categories
    ////////////////////////////////

    const categories: Category[] = [defaultCategory];
    let categoriesReadOk = false;

    try {
      const q_categories = query(collection(db, COLLECTIONS.data.categories), orderBy("order", "asc"));
      const querySnapshot_categories = await getDocs(q_categories);
      querySnapshot_categories.forEach((doc) => {
        const category = doc.data();
        if (category.index) return;
        categories.push({ ...category, selected: false } as Category);
      });
      categoriesReadOk = true;
    } catch (e) {
      console.log("retrieveCloudData categories error:", e);
    }

    ////////////////////////////////
    // notes
    ////////////////////////////////

    const notes: Note[] = [];
    let notesReadOk = false;

    try {
      const q_notes = query(collection(db, COLLECTIONS.data.notes), orderBy("createdAt", "desc"));
      const querySnapshot_notes = await getDocs(q_notes);
      querySnapshot_notes.forEach((doc) => {
        const note = doc.data() as Note;

        // Reassign to the default category only when we actually have a trustworthy
        // category list. If the categories read failed, categories=[default] and we
        // must NOT reassign — that would strip every note's category (and then
        // propagate the loss on the next upload).
        if (categoriesReadOk && !categories.some((category) => category.icon === note.category.icon)) {
          note.category = defaultCategory;
        }

        // Skip notes this device can't decrypt (e.g. encrypted under a different
        // DEK after a reset). Storing the ciphertext as plaintext would show
        // garbage and, on the next edit, re-encrypt it into permanent garbage.
        const decrypted = tryDecryptNote(note, dek);
        if (decrypted) notes.push(decrypted);
      });
      notesReadOk = true;
    } catch (e) {
      console.log("retrieveCloudData notes error:", e);
    }

    // Category data-loss guard (symmetric to notes): a failed read — or an empty
    // result while this device still holds user categories — must NOT wipe them.
    // setCategories(fromSync) REPLACES local categories, so a transient read
    // failure would otherwise drop them. Genuine deletions propagate via the
    // per-category delete fan-out (deleteLocalCategories), not here.
    const hasLocalCategories = allCategories.some((c) => !c.index);
    if (categoriesReadOk && !(categories.length <= 1 && hasLocalCategories)) {
      dispatch(setCategories({ categories, fromSync: true }));
      dispatch(resetCloudCategories());
    }

    // Notes data-loss guard: a failed read — or an empty result while this device
    // still holds synced notes — must NOT wipe local state. Genuine deletions
    // propagate incrementally through the per-note delete fan-out, not here.
    const hasLocalSynced = allNotes.some((n) => !n.local);
    if (!notesReadOk) return;
    if (notes.length === 0 && hasLocalSynced) return;

    dispatch(setNotes({ notes, fromSync: true }));
    dispatch(resetCloudNotes());
  };

  /** Map of cloud note id -> updatedAt. Metadata is stored unencrypted, so this
   * needs no decryption and lets us diff what this device contributes. */
  const getCloudNotesMeta = async (db: Firestore | null): Promise<Record<string, number>> => {
    if (!db) return {};

    const snapshot = await getDocs(collection(db, COLLECTIONS.data.notes));

    const meta: Record<string, number> = {};
    snapshot.forEach((doc) => {
      meta[doc.id] = Number(doc.data().updatedAt) || 0;
    });
    return meta;
  };

  /** Map of cloud category icon -> stored category (categories aren't encrypted). */
  const getCloudCategoriesMeta = async (db: Firestore | null): Promise<Record<string, Category>> => {
    if (!db) return {};

    const snapshot = await getDocs(collection(db, COLLECTIONS.data.categories));

    const meta: Record<string, Category> = {};
    snapshot.forEach((doc) => {
      meta[doc.id] = doc.data() as Category;
    });
    return meta;
  };

  /**
   * Fan out the notes/categories this device adds or updates (vs the pre-upload
   * cloud state) into the per-device queues, so already-connected devices
   * reconcile them incrementally through SyncOnProvider. Without this, a
   * connecting device's extra notes/categories only land in the shared
   * collections and never reach the other devices — the misaligned-device-1 bug.
   *
   * Only the diff is fanned out (new or changed items); re-sending items already
   * in the cloud could resurrect something another device deliberately deleted.
   */
  const fanOutLocalDiff = async (
    cloudNotesBefore: Record<string, number>,
    cloudCategoriesBefore: Record<string, Category>
  ): Promise<void> => {
    const deviceUuid = await getDeviceUuid();
    const allDevices = await getAllDeviceUuids();
    if (!deviceUuid || !allDevices) return;

    const others = allDevices.filter((uuid) => uuid !== deviceUuid);
    if (others.length === 0) return; // first/only device — nobody to notify

    const addNotes: Record<string, Note> = {};
    for (const note of allNotes) {
      if (note.local) continue; // offline-only notes never sync

      const createdAt = note.createdAt ?? getReversedDateTime(note.date);
      const updatedAt = note.updatedAt ?? getReversedDateTime(note.date);
      const cloudUpdated = cloudNotesBefore[note.id];

      // new (absent from cloud) or a locally newer version -> the others need it
      if (cloudUpdated === undefined || (Number(updatedAt) || 0) > cloudUpdated) {
        addNotes[note.id] = CryptNote.encrypt({ ...note, createdAt, updatedAt } as Note);
      }
    }

    const addCategories: Record<string, Category> = {};
    for (const category of allCategories) {
      if (category.index) continue; // the default "All" category is universal

      const prev = cloudCategoriesBefore[category.icon];
      // `selected` is device-local UI state, so it never counts as a change
      const changed =
        !prev ||
        prev.name !== category.name ||
        (prev.order ?? 0) !== (category.order ?? 0) ||
        !!prev.index !== !!category.index;

      if (changed) {
        addCategories[category.icon] = {
          ...category,
          index: category.index ?? false,
          order: category.order ?? 1,
          selected: false,
        };
      }
    }

    const hasNotes = Object.keys(addNotes).length > 0;
    const hasCategories = Object.keys(addCategories).length > 0;
    if (!hasNotes && !hasCategories) return;

    await setElementInCloud({
      collection: COLLECTIONS.various.connectedDevices,
      identifier: deviceUuid,
      payload: {
        ...(hasNotes ? { addNotes } : {}),
        ...(hasCategories ? { addCategories } : {}),
        devicesToSync: others,
      },
      merge: true,
    });
  };

  const syncCloudData = async (loadingMethodDisabled?: boolean): Promise<void> => {
    // Sync needs the DEK to encrypt/decrypt notes. Without an unlocked vault we
    // would otherwise throw (CryptNote.encrypt is fail-closed). Bail out quietly;
    // the UI already surfaces the "set up / unlock encryption" call-to-action.
    if (!isVaultUnlocked()) return;

    if (!loadingMethodDisabled) setIsLoading(true);

    const { db } = retrieveFirebase();

    // snapshot cloud versions before our upload overwrites them, so we can fan out
    // exactly what this device contributes to the other devices
    const cloudNotesBefore = await getCloudNotesMeta(db);
    const cloudCategoriesBefore = await getCloudCategoriesMeta(db);

    await uploadCloudData();
    await fanOutLocalDiff(cloudNotesBefore, cloudCategoriesBefore);
    await retrieveCloudData(db);

    // update sync timestamp in cloud and in local

    await updateLastSyncInCloud();

    if (!loadingMethodDisabled) setIsLoading(false);
  };

  useEffect(() => {
    if (isConnecting?.loading) return;

    const asyncHandshake = async () => {
      switch (isConnecting?.code) {
        case Handshake.Success: {
          const cloudDevices = await getAllConnectedDevices();

          if (cloudDevices.length >= configs.cloud.deviceLimit) {
            setIsLoading(false);
            toast(t("devicesLimitReached"));
            return;
          }

          const projectId = firestoreSettings.projectId;

          // Finalize the connection once the vault has been unlocked/created and
          // the DEK is in the session (the vault screen runs this continuation).
          const finalizeConnection = async () => {
            await addDeviceToCloud();
            await syncCloudData(true);
            await AsyncStorage.setItem("@cloudSync", JSON.stringify(firestoreSettings));
            setIsConnected(true);
            dispatch(setCloudConnected(true));
            dispatch(setCloudSettings(firestoreSettings));
            setIsLoading(false);
          };

          // Decide which vault path to take, then hand off to its screen. The DEK
          // must exist before any sync, so we never finalize here directly.
          const probe = await probeVault();

          // Unverifiable read: abort the connect rather than risk creating a
          // vault over an existing one. Nothing has been finalized yet.
          if (probe.presence === "error") {
            setIsLoading(false);
            toast(t("cloudsync.vault.verify_failed"));
            return;
          }

          storeVaultContinuation(finalizeConnection);
          setIsLoading(false);

          if (probe.presence === "present") {
            router.push({ pathname: "/settings/cloud-sync/vault-unlock", params: { projectId } });
          } else if (probe.needsMigration) {
            router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "migrate" } });
          } else {
            router.push({ pathname: "/settings/cloud-sync/vault-setup", params: { projectId, mode: "create" } });
          }
          break;
        }
        case Handshake.Fail:
          await removeDeviceFromCloud();

          setIsConnected(false);
          dispatch(setCloudConnected(false));

          await AsyncStorage.setItem("@cloudSync", JSON.stringify({}));

          setIsLoading(false);

          Alert.alert(t("cloudsync.handshakeFailed"), t("cloudsync.handshakeFailedDesc"), [
            {
              text: t("confirm"),
            },
          ]);

          break;
        default:
          break;
      }
    };

    asyncHandshake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnecting]);

  return {
    methods: {
      toggleCloudSync,
      setCloudSetting,
      saveCloudSettings,
      editCloudSettings,
      requestVaultAccess,
      requestReset,
      syncCloudData,
    },
    state: {
      isLoading,
      isCloudSyncEnabled: selectorCloudSyncEnabled,
      isConnecting: isConnecting?.loading ?? false,
      isConnected,
      isEditable: !isConnecting?.loading && !isConnected,
    },
    cloudSettings,
  };
};
