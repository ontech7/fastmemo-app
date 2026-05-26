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
import { CryptNote } from "@/utils/crypt";
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

  const uploadCloudData = async (): Promise<void> => {
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
    }
  };

  const retrieveCloudData = async (db: Firestore | null): Promise<void> => {
    if (!db) return;

    ////////////////////////////////
    // categories
    ////////////////////////////////

    const q_categories = query(collection(db, COLLECTIONS.data.categories), orderBy("order", "asc"));
    const querySnapshot_categories = await getDocs(q_categories);

    const categories: Category[] = [defaultCategory];

    querySnapshot_categories.forEach((doc) => {
      const category = doc.data();

      if (category.index) return;

      categories.push({
        ...category,
        selected: false,
      } as Category);
    });

    ////////////////////////////////
    // notes
    ////////////////////////////////

    const q_notes = query(collection(db, COLLECTIONS.data.notes), orderBy("createdAt", "desc"));
    const querySnapshot_notes = await getDocs(q_notes);

    const notes: Note[] = [];

    querySnapshot_notes.forEach((doc) => {
      const note = doc.data();

      // fix discrepancy between existing category and note category
      const categoryExists = categories.some((category) => category.icon == note.category.icon);

      if (!categoryExists) {
        note.category = defaultCategory;
      }

      notes.push(CryptNote.decrypt(note as Note));
    });

    dispatch(setCategories({ categories, fromSync: true }));
    dispatch(resetCloudCategories());
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
        addCategories[category.icon] = { ...category, index: category.index ?? false, order: category.order ?? 1, selected: false };
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
        case Handshake.Success:
          const cloudDevices = await getAllConnectedDevices();

          if (cloudDevices.length >= configs.cloud.deviceLimit) {
            setIsLoading(false);
            toast(t("devicesLimitReached"));
            return;
          }

          await addDeviceToCloud();

          await syncCloudData(true);

          await AsyncStorage.setItem("@cloudSync", JSON.stringify(firestoreSettings));

          setIsConnected(true);

          dispatch(setCloudConnected(true));
          dispatch(setCloudSettings(firestoreSettings));

          setIsLoading(false);
          break;
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
