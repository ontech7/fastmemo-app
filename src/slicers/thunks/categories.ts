import { createAction, createAsyncThunk } from "@reduxjs/toolkit";

import type { Category } from "@/types";
import type { AppRootState } from "@/slicers/store";

import {
  COLLECTIONS,
  deleteCollectionInCloud,
  deleteElementInCloud,
  exclusiveQueueEntry,
  setElementInCloud,
  updateLastSyncInCloud,
} from "@/libs/firebase";

/**
 * Pure action that resets local categories back to the default one.
 * Declared here (not in categoriesSlice) so that wipeCategoriesThunk can
 * dispatch it without creating a require cycle between categoriesSlice and
 * thunks/categories. The reducer logic lives in categoriesSlice's
 * `extraReducers`.
 */
export const wipeCategories = createAction("categories/wipe");

interface CloudSyncParams {
  deviceUuid: string;
  devicesToSync: string[];
  areMoreThanOneDevice: boolean;
}

interface SyncWithDevicesParams {
  deviceUuid: string;
  devicesToSync: string[];
  dataKey: string;
  elementId: string;
  payload: Category;
}

const CATEGORY_QUEUES = ["addCategories", "deleteCategories"] as const;

const getCategoryPayload = (category: Category): Category => ({
  ...category,
  index: category.index ?? false,
  order: category.order ?? 1,
});

const syncWithDevices = async ({
  deviceUuid,
  devicesToSync,
  dataKey,
  elementId,
  payload,
}: SyncWithDevicesParams): Promise<boolean> => {
  return setElementInCloud({
    collection: COLLECTIONS.various.connectedDevices,
    identifier: deviceUuid,
    payload: {
      ...exclusiveQueueEntry(CATEGORY_QUEUES, dataKey, elementId, payload),
      devicesToSync,
    },
    merge: true,
    noUpdateLastSync: true,
  });
};

export const addCloudCategoriesAsync = createAsyncThunk<Record<string, Category>, CloudSyncParams, { state: AppRootState }>(
  "categories/addCloudCategoriesAsync",
  async ({ deviceUuid, devicesToSync, areMoreThanOneDevice }, { getState }) => {
    const state = getState().categories;
    const addCategories = Object.values(state.cloud.items.add);
    const elementsAdded: Record<string, Category> = {};

    for (const category of addCategories) {
      const payload = getCategoryPayload(category);

      const isDoneOne = await setElementInCloud({
        collection: COLLECTIONS.data.categories,
        identifier: category.icon,
        payload,
        noUpdateLastSync: true,
      });

      let isDoneAll = true;
      if (areMoreThanOneDevice) {
        isDoneAll = await syncWithDevices({
          deviceUuid,
          devicesToSync,
          dataKey: "addCategories",
          elementId: category.icon,
          payload,
        });
      }

      if (isDoneOne && isDoneAll) {
        elementsAdded[category.icon] = category;
      }
    }

    // Once per batch rather than after every write: it's only shown in the devices list.
    if (Object.keys(elementsAdded).length > 0) await updateLastSyncInCloud();

    return elementsAdded;
  }
);

export const deleteCloudCategoriesAsync = createAsyncThunk<Record<string, Category>, CloudSyncParams, { state: AppRootState }>(
  "categories/deleteCloudCategoriesAsync",
  async ({ deviceUuid, devicesToSync, areMoreThanOneDevice }, { getState }) => {
    const state = getState().categories;
    const deleteCategories = Object.values(state.cloud.items.delete);
    const elementsDeleted: Record<string, Category> = {};

    for (const [i, category] of deleteCategories.entries()) {
      const payload: Category = {
        ...getCategoryPayload(category),
        order: category.order ?? i + 1,
      };

      const isDoneOne = await deleteElementInCloud({
        collection: COLLECTIONS.data.categories,
        identifier: category.icon,
        noUpdateLastSync: true,
      });

      let isDoneAll = true;
      if (areMoreThanOneDevice) {
        isDoneAll = await syncWithDevices({
          deviceUuid,
          devicesToSync,
          dataKey: "deleteCategories",
          elementId: category.icon,
          payload,
        });
      }

      if (isDoneOne && isDoneAll) {
        elementsDeleted[category.icon] = category;
      }
    }

    // Once per batch rather than after every write: it's only shown in the devices list.
    if (Object.keys(elementsDeleted).length > 0) await updateLastSyncInCloud();

    return elementsDeleted;
  }
);

/**
 * Wipes all local categories (resetting to the default one) and, when
 * requested, the corresponding cloud collection. Dispatches the pure
 * `wipeCategories` action first so the local state is cleared immediately,
 * then performs the async cloud deletion side effect outside of the reducer.
 */
export const wipeCategoriesThunk = createAsyncThunk<void, { wipeCloud: boolean }, { state: AppRootState }>(
  "categories/wipeCategoriesThunk",
  async ({ wipeCloud }, { dispatch }) => {
    dispatch(wipeCategories());

    if (wipeCloud) {
      await deleteCollectionInCloud(COLLECTIONS.data.categories);
    }
  }
);
