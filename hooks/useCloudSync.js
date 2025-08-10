import { useEffect, useState } from "react";
import { configs } from "@/configs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

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
import { popupAlert } from "@/utils/alert";
import { CryptNote } from "@/utils/crypt";
import { getReversedDateTime } from "@/utils/date";
import { toast } from "@/utils/toast";
import { defaultCategory } from "@/configs/default";

import { getCategories, resetCloudCategories, setCategories } from "../slicers/categoriesSlice";
import { getAllNotes, resetCloudNotes, setNotes } from "../slicers/notesSlice";
import {
  getCloudConnected,
  getCloudSettings,
  selectorIsCloudSyncEnabled,
  setCloudConnected,
  setCloudSettings,
  setIsCloudSyncEnabled,
} from "../slicers/settingsSlice";

export const useCloudSync = () => {
  const { t } = useTranslation();

  const allNotes = useSelector(getAllNotes);
  const allCategories = useSelector(getCategories);

  const selectorCloudSyncEnabled = useSelector(selectorIsCloudSyncEnabled);
  const selectorCloudSettings = useSelector(getCloudSettings);
  const selectorCloudConnected = useSelector(getCloudConnected);

  const [cloudSettings, setLocalCloudSettings] = useState(selectorCloudSettings);
  const firestoreSettings = {
    ...cloudSettings,
    authDomain: (cloudSettings.projectId ?? "") + ".firebaseapp.com",
    storageBucket: (cloudSettings.projectId ?? "") + ".appspot.com",
    messagingSenderId: cloudSettings.appId.split(":")?.[1] ?? "",
  };

  const [isCloudSyncEnabled, setCloudSyncEnabled] = useState(selectorCloudSyncEnabled);
  const [isConnected, setIsConnected] = useState(selectorCloudConnected);
  const [isConnecting, setIsConnecting] = useState({ loading: false });
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useDispatch();

  const toggleCloudSync = async () => {
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

  const setCloudSetting = (name, value) => {
    setLocalCloudSettings({
      ...cloudSettings,
      [name]: value,
    });
  };

  const saveCloudSettings = async () => {
    setIsConnecting({ loading: true });
    setIsLoading(true);

    initFirebase(firestoreSettings);

    handshakeFirebase(setIsConnecting);
  };

  const editCloudSettings = () => {
    setIsConnected(false);
  };

  const uploadCloudData = async () => {
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
        }),
      });
    }
  };

  const retrieveCloudData = async (db) => {
    ////////////////////////////////
    // categories
    ////////////////////////////////

    const q_categories = query(collection(db, COLLECTIONS.data.categories), orderBy("order", "asc"));
    const querySnapshot_categories = await getDocs(q_categories);

    let categories = [defaultCategory];

    querySnapshot_categories.forEach((doc) => {
      const category = doc.data();

      if (category.index) return;

      // @ts-ignore
      categories.push({
        ...category,
        selected: false,
      });
    });

    ////////////////////////////////
    // notes
    ////////////////////////////////

    const q_notes = query(collection(db, COLLECTIONS.data.notes), orderBy("createdAt", "desc"));
    const querySnapshot_notes = await getDocs(q_notes);

    let notes = [];

    querySnapshot_notes.forEach((doc) => {
      let note = doc.data();

      // fix discrepancy between existing category and note category
      const categoryExists = categories.some((category) => category.icon == note.category.icon);

      if (!categoryExists) {
        note.category = defaultCategory;
      }

      // @ts-ignore
      notes.push(CryptNote.decrypt(note));
    });

    dispatch(setCategories({ categories, fromSync: true }));
    dispatch(resetCloudCategories());
    dispatch(setNotes({ notes, fromSync: true }));
    dispatch(resetCloudNotes());
  };

  const syncCloudData = async (loadingMethodDisabled) => {
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
      // @ts-ignore
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

          popupAlert(t("cloudsync.handshakeFailed"), t("cloudsync.handshakeFailedDesc"), {
            confirmText: t("confirm"),
            confirmHandler: () => {},
          });

          break;
        default:
          break;
      }
    };

    asyncHandshake();
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
