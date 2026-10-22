import { createAction, createAsyncThunk } from "@reduxjs/toolkit";

import type { AppRootState } from "@/slicers/store";

import { cloud } from "@/libs/cloud";

/**
 * Pure action that resets local categories back to the default one.
 * Declared here (not in categoriesSlice) so that wipeCategoriesThunk can
 * dispatch it without creating a require cycle between categoriesSlice and
 * thunks/categories. The reducer logic lives in categoriesSlice's
 * `extraReducers`.
 */
export const wipeCategories = createAction("categories/wipe");

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
      await cloud.wipeCategories();
    }
  }
);
