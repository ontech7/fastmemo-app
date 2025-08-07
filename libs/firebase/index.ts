import { configs } from "@/configs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { brand, modelName } from "expo-device";
import { deleteApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  collection as collectionFirestore,
  deleteDoc,
  doc,
  getDoc,
  getDocsFromServer,
  getFirestore,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";

import { defaultCategory } from "@/configs/default";

import type {
  ConnectedDeviceCollectionData,
  HandshakeCollectionData,
} from "./types";
import type { FirebaseOptions } from "firebase/app";
import type { DocumentData, QueryConstraint } from "firebase/firestore";

export type FirebaseCollection =
  | keyof typeof COLLECTIONS.data
  | keyof typeof COLLECTIONS.various;

export const COLLECTIONS = {
  data: {
    categories: "categories",
    notes: "notes",
  },
  various: {
    handshake: "handshake",
    connectedDevices: "connectedDevices",
  },
} as const;

export enum Handshake {
  Fail,
  Success,
}

/**
 * initialize the firebase instance
 */
export const initFirebase = (options: FirebaseOptions) => {
  if (getApps().length) {
    const app = getApp(configs.firebase.appName);

    deleteApp(app)
      .then(() => {})
      .catch((error) => console.log("Error deleting app:", error));
  }

  initializeApp(options, configs.firebase.appName);
};

export const retrieveFirebase = () => {
  try {
    const app = getApp(configs.firebase.appName);
    const db = getFirestore(app);

    return { app, db };
  } catch (e) {
    return { app: null, db: null };
  }
};

export const deleteActiveFirebase = async () => {
  try {
    const { app } = retrieveFirebase();

    if (app == null) {
      return false;
    }

    await deleteApp(app);

    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

const getHandshake = async () => {
  try {
    const res_add_handshake = await setElementInCloud<HandshakeCollectionData>({
      collection: COLLECTIONS.various.handshake,
      identifier: "123",
      payload: {
        done: "true",
      },
      noUpdateLastSync: true,
    });

    const res_del_handshake = await deleteElementInCloud({
      collection: COLLECTIONS.various.handshake,
      identifier: "123",
      noUpdateLastSync: true,
    });

    return res_add_handshake && res_del_handshake;
  } catch (e) {
    console.log("handshake: " + e);
    return false;
  }
};

/**
 * handshake to verify if the cloud settings are correct or available
 */
export const handshakeFirebase = async (
  setterCallback: (params: { loading: boolean; code: Handshake }) => void
) => {
  const ok = () => setterCallback({ loading: false, code: Handshake.Success });
  const ko = () => setterCallback({ loading: false, code: Handshake.Fail });

  try {
    const t = setTimeout(() => ko(), 5000);

    const isHandshakeSuccess = await getHandshake();

    clearTimeout(t);

    isHandshakeSuccess ? ok() : ko();
  } catch (e) {
    console.log(e);

    ko();
  }
};

/**
 * offline check to see if the cloud is connected
 */
export const isCloudConnected = () => {
  try {
    const { app, db } = retrieveFirebase();
    return app != null && db != null;
  } catch (e) {
    return false;
  }
};

/**
 * middleware that works only if the device is connected
 * to the Google Firestore cloud
 */
export const only_if_cloudConnected = (callback: (...args: any[]) => void) => {
  if (isCloudConnected()) callback();
};

/**
 * get the current device uuid
 */
export const getDeviceUuid = async () => {
  try {
    const data = await AsyncStorage.getItem("@deviceUuid");

    if (data !== null) {
      return data;
    } else {
      const deviceUuid = uuid();
      await AsyncStorage.setItem("@deviceUuid", deviceUuid);
      return deviceUuid;
    }
  } catch (e) {
    return null;
  }
};

/**
 * get all the connected devices on the cloud
 */
export const getAllConnectedDevices = async () => {
  const { db } = retrieveFirebase();

  if (db == null) {
    return [];
  }

  try {
    const q = query(
      collectionFirestore(db, COLLECTIONS.various.connectedDevices)
    );

    const querySnapshot = await getDocsFromServer(q);

    let devices: {
      uuid: string;
      modelName: string;
      brand: string;
      lastSync: string;
    }[] = [];

    querySnapshot.forEach((doc) => {
      const { uuid, modelName, brand, lastSync } = doc.data();
      devices.push({ uuid, modelName, brand, lastSync });
    });

    return devices;
  } catch (e) {
    console.log(e);

    return [];
  }
};

/**
 * add the current device to "connectedDevices" collection
 */
export const addDeviceToCloud = async () => {
  try {
    const deviceUuid = await getDeviceUuid();

    if (deviceUuid == null) {
      return false;
    }

    const res_addDevice =
      await setElementInCloud<ConnectedDeviceCollectionData>({
        collection: COLLECTIONS.various.connectedDevices,
        identifier: deviceUuid,
        payload: {
          uuid: deviceUuid,
          modelName: modelName || "web",
          brand: brand || "web",
          lastSync: `${new Date().getTime()}`,
          addCategories: {},
          deleteCategories: {},
          addNotes: {},
          deleteNotes: {},
          devicesToSync: [],
        },
      });

    return res_addDevice;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * remove the device from "connectedDevices" collection
 */
export const removeDeviceFromCloud = async (deviceUuid?: string) => {
  try {
    const _deviceUuid = deviceUuid ?? (await getDeviceUuid());

    if (_deviceUuid == null) {
      return false;
    }

    const res_removeDevice = await deleteElementInCloud({
      collection: COLLECTIONS.various.connectedDevices,
      identifier: _deviceUuid,
      noUpdateLastSync: true,
    });

    return res_removeDevice;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * remove the device from all devicesToSync
 */
export const removeDeviceFromDevicesToSync = async (deviceUuid: string) => {
  try {
    const devices = await getAllElementsInCloud<ConnectedDeviceCollectionData>({
      collection: COLLECTIONS.various.connectedDevices,
      queryConstraints: [where("devicesToSync", "array-contains", deviceUuid)],
    });

    if (!devices.isPresent) {
      throw new Error("No devices found to remove");
    }

    for (var i = 0; i < devices.data.length; i++) {
      const devicesToSyncExceptRemoved = devices.data[i].devicesToSync.filter(
        (deviceToSync) => deviceToSync != deviceUuid
      );

      await setElementInCloud<ConnectedDeviceCollectionData>({
        collection: COLLECTIONS.various.connectedDevices,
        identifier: devices.data[i].uuid,
        payload: {
          devicesToSync: devicesToSyncExceptRemoved,
          ...(devicesToSyncExceptRemoved.length == 0
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

    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * remove all devices from "connectedDevices" collection
 * and re-add the current one
 */
export const removeAllDevicesFromCloud = async () => {
  try {
    const deviceUuid = await getDeviceUuid();

    if (deviceUuid == null) {
      return false;
    }

    const res_deleteCollection = await deleteCollectionInCloud(
      COLLECTIONS.various.connectedDevices
    );

    const res_addDevice = await addDeviceToCloud();

    return res_deleteCollection && res_addDevice;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * get all the active devices uuid on firestore
 * @returns string[] | null
 */
export const getAllDeviceUuids = async () => {
  try {
    const devices = await getCollectionIdentifiersInCloud(
      COLLECTIONS.various.connectedDevices
    );
    return devices;
  } catch (e) {
    return null;
  }
};

/**
 * updates the last global sync and the device last sync
 */
export const updateLastSyncInCloud = async () => {
  const { db } = retrieveFirebase();
  if (db == null) return false;

  const timestamp = new Date().getTime() + "";

  try {
    const deviceUuid = await getDeviceUuid();

    if (deviceUuid == null) {
      return false;
    }

    await AsyncStorage.setItem("@lastSyncLocal", timestamp);

    await setDoc(
      doc(db, COLLECTIONS.various.connectedDevices, deviceUuid),
      { lastSync: timestamp },
      { merge: true }
    );

    return timestamp;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * get all the elements in the cloud
 */
export const getAllElementsInCloud = async <
  T extends Record<string, any> = DocumentData,
>({
  collection,
  queryConstraints = [],
}: {
  collection: FirebaseCollection;
  queryConstraints?: QueryConstraint[];
}) => {
  const EMPTY_OBJECT: { isPresent: false; data: T[] } = {
    isPresent: false,
    data: [],
  };

  const { db } = retrieveFirebase();

  if (db == null) {
    return EMPTY_OBJECT;
  }

  try {
    const q = query(collectionFirestore(db, collection), ...queryConstraints);

    const querySnapshot = await getDocsFromServer(q);

    const result: T[] = [];

    querySnapshot.forEach((docSnap) => {
      result.push(docSnap.data() as T);
    });

    return {
      isPresent: result.length !== 0,
      data: result,
    };
  } catch (e) {
    console.log(e);
    return EMPTY_OBJECT;
  }
};

/**
 * get one element from the cloud
 */
export const getElementInCloud = async <
  T extends Record<string, any> = DocumentData,
>({
  collection,
  identifier,
}: {
  collection: FirebaseCollection;
  identifier: string;
}) => {
  const EMPTY_OBJECT = { isPresent: false, data: {}, id: null };

  const { db } = retrieveFirebase();

  if (db == null) {
    return EMPTY_OBJECT;
  }

  try {
    const lastSyncSnap = await getDoc(doc(db, collection, identifier));

    const isPresent = lastSyncSnap.exists();

    return {
      isPresent,
      data: (isPresent ? lastSyncSnap.data() : {}) as T,
      id: isPresent ? lastSyncSnap.id : null,
    };
  } catch (e) {
    console.log(e);

    return EMPTY_OBJECT;
  }
};

/**
 * set one element to the cloud
 */
export const setElementInCloud = async <
  T extends Record<string, any> = DocumentData,
>({
  collection,
  identifier,
  payload,
  merge = false,
  noUpdateLastSync,
}: {
  collection: FirebaseCollection;
  identifier: string;
  payload: Partial<T>;
  merge?: boolean;
  noUpdateLastSync?: boolean;
}) => {
  const { db } = retrieveFirebase();

  if (db == null) {
    return false;
  }

  try {
    await setDoc(doc(db, collection, identifier), payload as T, { merge });

    if (!noUpdateLastSync) {
      return !!(await updateLastSyncInCloud());
    }

    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * delete one element in the cloud
 */
export const deleteElementInCloud = async ({
  collection,
  identifier,
  noUpdateLastSync,
}: {
  collection: FirebaseCollection;
  identifier: string;
  noUpdateLastSync?: boolean;
}) => {
  const { db } = retrieveFirebase();
  if (db == null) {
    return false;
  }

  try {
    await deleteDoc(doc(db, collection, identifier));

    if (!noUpdateLastSync) {
      const res_updateLastSync = await updateLastSyncInCloud();

      if (!res_updateLastSync) {
        return false;
      }
    }

    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * get all the identifiers in the cloud of a specific collection
 */
export const getCollectionIdentifiersInCloud = async (
  collection: FirebaseCollection
) => {
  const { db } = retrieveFirebase();
  if (db == null) {
    return null;
  }

  try {
    const q = query(collectionFirestore(db, collection));
    const querySnapshot = await getDocsFromServer(q);

    let arrayIdentifiers: string[] = [];

    querySnapshot.forEach((doc) => arrayIdentifiers.push(doc.id));

    return arrayIdentifiers;
  } catch (e) {
    console.log(e);
    return null;
  }
};

/**
 * delete an entire collection in the cloud
 */
export const deleteCollectionInCloud = async (
  collection: FirebaseCollection
) => {
  const { db } = retrieveFirebase();

  if (db == null) {
    return false;
  }

  try {
    const q = query(collectionFirestore(db, collection));
    const querySnapshot = await getDocsFromServer(q);

    let arrayIdentifiers: string[] = [];

    querySnapshot.forEach((doc) => arrayIdentifiers.push(doc.id));

    for (var i = 0; i < arrayIdentifiers.length; i++) {
      await deleteDoc(doc(db, collection, arrayIdentifiers[i]));
    }

    if (collection == COLLECTIONS.data.categories) {
      await setDoc(doc(db, collection, "none"), defaultCategory);
    }

    return await updateLastSyncInCloud();
  } catch (e) {
    console.log(e);
    return false;
  }
};
