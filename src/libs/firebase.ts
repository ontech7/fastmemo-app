import { configs } from "@/configs";
import { defaultCategory } from "@/configs/default";
import { getDeviceInfo } from "@/libs/device";
import type { CloudSettings } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FirebaseApp } from "firebase/app";
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
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import uuid from "react-uuid";

export interface ConnectedDevice {
  uuid: string;
  modelName: string;
  brand: string;
  lastSync: string;
}

interface HandshakeState {
  loading: boolean;
  code: number;
}

interface CloudQueryResult {
  isPresent: boolean;
  data: DocumentData[];
}

interface CloudElementResult {
  isPresent: boolean;
  data: DocumentData;
  id: string | null;
}

interface SetElementParams {
  collection: string;
  identifier: string;
  payload: DocumentData;
  merge?: boolean;
  noUpdateLastSync?: boolean;
}

interface DeleteElementParams {
  collection: string;
  identifier: string;
  noUpdateLastSync?: boolean;
}

interface GetAllElementsParams {
  collection: string;
  queryConstraints: QueryConstraint[];
}

interface GetElementParams {
  collection: string;
  identifier: string;
}

const { modelName, brand } = getDeviceInfo();

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

export const Handshake = {
  Fail: 0,
  Success: 1,
} as const;

/**
 * initialize the firebase instance
 */
export const initFirebase = (options: CloudSettings): void => {
  if (getApps().length) {
    const app = getApp(configs.firebase.appName);

    deleteApp(app)
      .then(() => {})
      .catch((error) => console.log("Error deleting app:", error));
  }

  initializeApp(options, configs.firebase.appName);
};

export const retrieveFirebase = (): { app: FirebaseApp | null; db: Firestore | null } => {
  try {
    const app = getApp(configs.firebase.appName);
    const db = getFirestore(app);

    return { app, db };
  } catch (e) {
    return { app: null, db: null };
  }
};

export const deleteActiveFirebase = async (): Promise<boolean> => {
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

const getHandshake = async (): Promise<boolean> => {
  try {
    const res_add_handshake = await setElementInCloud({
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
export const handshakeFirebase = async (setterCallback: (state: HandshakeState) => void): Promise<void> => {
  const ok = () => setterCallback({ loading: false, code: Handshake.Success });
  const ko = () => setterCallback({ loading: false, code: Handshake.Fail });

  try {
    const t = setTimeout(() => ko(), 5000);

    const isHandshakeSuccess = await getHandshake();

    clearTimeout(t);

    if (isHandshakeSuccess) {
      ok();
    } else {
      ko();
    }
  } catch (e) {
    console.log(e);

    ko();
  }
};

/**
 * offline check to see if the cloud is connected
 */
export const isCloudConnected = (): boolean => {
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
export const only_if_cloudConnected = (callback: () => void): void => {
  if (isCloudConnected()) callback();
};

/**
 * get the current device uuid
 */
export const getDeviceUuid = async (): Promise<string | null> => {
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
export const getAllConnectedDevices = async (): Promise<ConnectedDevice[]> => {
  const { db } = retrieveFirebase();

  if (db == null) {
    return [];
  }

  try {
    const q = query(collectionFirestore(db, COLLECTIONS.various.connectedDevices));

    const querySnapshot = await getDocsFromServer(q);

    const devices: ConnectedDevice[] = [];

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
export const addDeviceToCloud = async (): Promise<boolean> => {
  try {
    const deviceUuid = await getDeviceUuid();

    if (deviceUuid == null) {
      return false;
    }

    const res_addDevice = await setElementInCloud({
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
export const removeDeviceFromCloud = async (deviceUuid?: string | null): Promise<boolean> => {
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
export const removeDeviceFromDevicesToSync = async (deviceUuid: string): Promise<boolean> => {
  try {
    const devices = await getAllElementsInCloud({
      collection: COLLECTIONS.various.connectedDevices,
      queryConstraints: [where("devicesToSync", "array-contains", deviceUuid)],
    });

    if (!devices.isPresent) {
      throw new Error("No devices found to remove");
    }

    for (let i = 0; i < devices.data.length; i++) {
      const devicesToSyncExceptRemoved = devices.data[i].devicesToSync.filter(
        (deviceToSync: string) => deviceToSync != deviceUuid
      );

      await setElementInCloud({
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
export const removeAllDevicesFromCloud = async (): Promise<boolean> => {
  try {
    const deviceUuid = await getDeviceUuid();

    if (deviceUuid == null) {
      return false;
    }

    const res_deleteCollection = await deleteCollectionInCloud(COLLECTIONS.various.connectedDevices);

    const res_addDevice = await addDeviceToCloud();

    return !!res_deleteCollection && res_addDevice;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * get all the active devices uuid on firestore
 */
export const getAllDeviceUuids = async (): Promise<string[] | null> => {
  try {
    const devices = await getCollectionIdentifiersInCloud(COLLECTIONS.various.connectedDevices);
    return devices;
  } catch (e) {
    return null;
  }
};

/**
 * updates the last global sync and the device last sync
 */
export const updateLastSyncInCloud = async (): Promise<string | false> => {
  const { db } = retrieveFirebase();
  if (db == null) return false;

  const timestamp = new Date().getTime() + "";

  try {
    const deviceUuid = await getDeviceUuid();

    if (deviceUuid == null) {
      return false;
    }

    await AsyncStorage.setItem("@lastSyncLocal", timestamp);

    await setDoc(doc(db, COLLECTIONS.various.connectedDevices, deviceUuid), { lastSync: timestamp }, { merge: true });

    return timestamp;
  } catch (e) {
    console.log(e);
    return false;
  }
};

/**
 * get all the elements in the cloud
 */
export const getAllElementsInCloud = async ({
  collection,
  queryConstraints,
}: GetAllElementsParams): Promise<CloudQueryResult> => {
  const EMPTY_OBJECT: CloudQueryResult = {
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

    const result: DocumentData[] = [];

    querySnapshot.forEach((docSnap) => {
      result.push(docSnap.data());
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
export const getElementInCloud = async ({ collection, identifier }: GetElementParams): Promise<CloudElementResult> => {
  const EMPTY_OBJECT: CloudElementResult = { isPresent: false, data: {}, id: null };

  const { db } = retrieveFirebase();

  if (db == null) {
    return EMPTY_OBJECT;
  }

  try {
    const lastSyncSnap = await getDoc(doc(db, collection, identifier));

    const isPresent = lastSyncSnap.exists();

    return {
      isPresent,
      data: isPresent ? lastSyncSnap.data() : {},
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
export const setElementInCloud = async ({
  collection,
  identifier,
  payload,
  merge = false,
  noUpdateLastSync = false,
}: SetElementParams): Promise<boolean> => {
  const { db } = retrieveFirebase();

  if (db == null) {
    return false;
  }

  try {
    await setDoc(doc(db, collection, identifier), payload, { merge });

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
  noUpdateLastSync = false,
}: DeleteElementParams): Promise<boolean> => {
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
export const getCollectionIdentifiersInCloud = async (collection: string): Promise<string[] | null> => {
  const { db } = retrieveFirebase();
  if (db == null) {
    return null;
  }

  try {
    const q = query(collectionFirestore(db, collection));
    const querySnapshot = await getDocsFromServer(q);

    const arrayIdentifiers: string[] = [];

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
export const deleteCollectionInCloud = async (collection: string): Promise<string | false> => {
  const { db } = retrieveFirebase();

  if (db == null) {
    return false;
  }

  try {
    const q = query(collectionFirestore(db, collection));
    const querySnapshot = await getDocsFromServer(q);

    const arrayIdentifiers: string[] = [];

    querySnapshot.forEach((d) => arrayIdentifiers.push(d.id));

    for (let i = 0; i < arrayIdentifiers.length; i++) {
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
