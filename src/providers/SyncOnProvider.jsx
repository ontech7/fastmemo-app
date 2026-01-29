import useNetInfo from "@/hooks/useNetInfo";
import { isEmpty, isObjectEmpty } from "@/utils/string";
import { where } from "firebase/firestore";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { COLLECTIONS, getAllDeviceUuids, getAllElementsInCloud, getDeviceUuid, setElementInCloud } from "../libs/firebase";
import { addLocalCategories, deleteLocalCategories, getCloudCategories } from "../slicers/categoriesSlice";
import { addLocalNotes, deleteLocalNotes, getCloudNotes } from "../slicers/notesSlice";
import { getCloudConnected, setCloudConnected, setIsCloudSyncEnabled } from "../slicers/settingsSlice";
import { addCloudCategoriesAsync, deleteCloudCategoriesAsync } from "../slicers/thunks/categories";
import { addCloudNotesAsync, deleteCloudNotesAsync } from "../slicers/thunks/notes";
import { toast } from "../utils/toast";

const PENDING_CHANGES_DELAY = 15000;
const DEBOUNCE_NOTES_DELAY = 200;

let tDebounceNotes = null;
const debounce = (callback) => {
  return (...args) => {
    clearTimeout(tDebounceNotes);
    tDebounceNotes = setTimeout(() => {
      callback(...args);
    }, DEBOUNCE_NOTES_DELAY);
  };
};

export function useSyncOn() {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const tPendingChanges = useRef(null);

  const isCloudConnected = useSelector(getCloudConnected);
  const netInfo = useNetInfo();

  const cloudCategories = useSelector(getCloudCategories);
  const cloudCategories_add = Object.values(cloudCategories.add);
  const cloudCategories_delete = Object.values(cloudCategories.delete);

  const cloudNotes = useSelector(getCloudNotes);
  const cloudNotes_add = Object.values(cloudNotes.add);
  const cloudNotes_delete = Object.values(cloudNotes.delete);

  ///////////////////////////////////
  // Pending cloud changes checker
  // syncToLocal - notes & categories
  ///////////////////////////////////

  useEffect(() => {
    clearInterval(tPendingChanges.current);

    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected) {
      return;
    }

    const syncToLocal = async () => {
      const devices = await getAllDeviceUuids();
      const deviceUuid = await getDeviceUuid();

      // if no internet connectivity, stop thread
      if (devices == null) {
        clearInterval(tPendingChanges.current);
        return;
      }

      // device got removed from the cloud, should disconnect
      if (!devices.includes(deviceUuid)) {
        dispatch(setIsCloudSyncEnabled(false));
        dispatch(setCloudConnected(false));
        clearInterval(tPendingChanges.current);
        toast(t("disconnected"));
        return;
      }

      // only one device connected to the cloud
      if (devices.length == 1 && devices.includes(deviceUuid)) {
        return;
      }

      const devicesData = await getAllElementsInCloud({
        collection: COLLECTIONS.various.connectedDevices,
        queryConstraints: [where("devicesToSync", "array-contains", deviceUuid)],
      });

      // no pending changes
      if (!devicesData.isPresent) {
        return;
      }

      for (var i = 0; i < devicesData.data.length; i++) {
        const deviceData = devicesData.data[i];

        // if there is some "add categories" data, put it in the local "add" object
        if (!isObjectEmpty(deviceData.addCategories)) {
          dispatch(addLocalCategories(deviceData.addCategories));
        }

        // if there is some "add notes" data, put it in the local "add" object
        if (!isObjectEmpty(deviceData.addNotes)) {
          dispatch(addLocalNotes(deviceData.addNotes));
        }

        // if there is some "delete notes" data, put it in the local "delete" object
        if (!isObjectEmpty(deviceData.deleteNotes)) {
          dispatch(deleteLocalNotes(deviceData.deleteNotes));
        }

        // if there is some "delete categories" data, put it in the local "delete" object
        if (!isObjectEmpty(deviceData.deleteCategories)) {
          dispatch(deleteLocalCategories(deviceData.deleteCategories));
        }

        const devicesExceptMe = deviceData.devicesToSync.filter((otherDeviceUuid) => otherDeviceUuid != deviceUuid);

        setElementInCloud({
          collection: COLLECTIONS.various.connectedDevices,
          identifier: deviceData.uuid,
          payload: {
            devicesToSync: devicesExceptMe,
            ...(devicesExceptMe.length == 0
              ? {
                  addCategories: {},
                  deleteCategories: {},
                  addNotes: {},
                  deleteNotes: {},
                }
              : {}),
          },
          merge: true,
        });
      }

      toast(t("dataSynced"));
    };

    syncToLocal();
    tPendingChanges.current = setInterval(syncToLocal, PENDING_CHANGES_DELAY);
  }, [isCloudConnected, netInfo]);

  ///////////////////////////////////
  // Pending local changes checker
  // syncToCloud - categories
  ///////////////////////////////////

  useEffect(() => {
    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected) {
      return;
    }

    // if both groups are empty, call syncToCloud method
    if (isEmpty(cloudCategories_add) && isEmpty(cloudCategories_delete)) {
      return;
    }

    const syncCategoriesToCloud = async () => {
      const devices = await getAllDeviceUuids();
      const deviceUuid = await getDeviceUuid();

      // if no internet connectivity, return
      if (devices == null) {
        return;
      }

      const devicesExceptMe = devices.filter((otherDeviceUuid) => otherDeviceUuid != deviceUuid);

      if (!isEmpty(cloudCategories_add)) {
        await dispatch(
          // @ts-ignore
          addCloudCategoriesAsync({
            deviceUuid,
            devicesToSync: devicesExceptMe,
            areMoreThanOneDevice: devicesExceptMe.length > 0,
          })
          // @ts-ignore
        ).unwrap();
      }

      if (!isEmpty(cloudCategories_delete)) {
        await dispatch(
          // @ts-ignore
          deleteCloudCategoriesAsync({
            deviceUuid,
            devicesToSync: devicesExceptMe,
            areMoreThanOneDevice: devicesExceptMe.length > 0,
          })
          // @ts-ignore
        ).unwrap();
      }
    };

    syncCategoriesToCloud();
  }, [isCloudConnected, netInfo, cloudCategories_add, cloudCategories_delete]);

  ///////////////////////////////////
  // Pending local changes checker
  // syncToCloud - notes
  ///////////////////////////////////

  useEffect(() => {
    // if not connected correctly or if internet connectivity is lost (offline sync)
    if (!isCloudConnected || !netInfo?.isConnected) {
      return;
    }

    // if both groups are empty, don't call syncToCloud method
    if (isEmpty(cloudNotes_add) && isEmpty(cloudNotes_delete)) {
      return;
    }

    const syncNotesToCloud = async () => {
      const devices = await getAllDeviceUuids();
      const deviceUuid = await getDeviceUuid();

      // if no internet connectivity, return
      if (devices == null) {
        return;
      }

      const devicesExceptMe = devices.filter((otherDeviceUuid) => otherDeviceUuid != deviceUuid);

      if (!isEmpty(cloudNotes_add)) {
        await dispatch(
          // @ts-ignore
          addCloudNotesAsync({
            deviceUuid,
            devicesToSync: devicesExceptMe,
            areMoreThanOneDevice: devicesExceptMe.length > 0,
          })
          // @ts-ignore
        ).unwrap();
      }

      if (!isEmpty(cloudNotes_delete)) {
        await dispatch(
          // @ts-ignore
          deleteCloudNotesAsync({
            deviceUuid,
            devicesToSync: devicesExceptMe,
            areMoreThanOneDevice: devicesExceptMe.length > 0,
          })
          // @ts-ignore
        ).unwrap();
      }
    };

    debounce(syncNotesToCloud)();
  }, [isCloudConnected, netInfo, cloudNotes_add, cloudNotes_delete]);
}

export default function SyncOnProvider() {
  useSyncOn();

  return null;
}
