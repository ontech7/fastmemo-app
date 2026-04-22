import { configs } from "@/configs";
import type { Category, CloudSettings, Note } from "@/types";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
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

import { getCategories, resetCloudCategories, setCategories } from "../slicers/categoriesSlice";
import { getAllNotes, getNoteFilters, resetCloudNotes, setNotes } from "../slicers/notesSlice";
import {
  getCloudConnected,
  getCloudSettings,
  selectorIsCloudSyncEnabled,
  setCloudConnected,
  setCloudSettings,
  setIsCloudSyncEnabled,
} from "../slicers/settingsSlice";

interface ConnectingState {
  loading: boolean;
  code?: number;
}

export const useCloudSync = () => {
  const { t } = useTranslation();

  const allNotes = useSelector(getAllNotes);
  const allCategories = useSelector(getCategories);
  const noteFilters = useSelector(getNoteFilters);

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

  const syncCloudData = async (loadingMethodDisabled?: boolean): Promise<void> => {
    if (!loadingMethodDisabled) setIsLoading(true);

    const { db } = retrieveFirebase();

    await uploadCloudData();
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
