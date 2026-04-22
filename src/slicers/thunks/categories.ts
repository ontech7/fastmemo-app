import { createAsyncThunk } from "@reduxjs/toolkit";

import type { Category } from "@/types";
import type { AppRootState } from "@/slicers/store";

import { COLLECTIONS, deleteCollectionInCloud, deleteElementInCloud, setElementInCloud } from "@/libs/firebase";

import { wipeCategories } from "@/slicers/categoriesSlice";

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
      [dataKey]: {
        [elementId]: payload,
      },
      devicesToSync,
    },
    merge: true,
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
