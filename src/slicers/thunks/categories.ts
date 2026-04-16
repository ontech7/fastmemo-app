import { createAsyncThunk } from "@reduxjs/toolkit";

import type { Category } from "@/types";
import type { AppRootState } from "@/slicers/store";

import { COLLECTIONS, deleteElementInCloud, setElementInCloud } from "@/libs/firebase";

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
