import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

import type { Category, CategoriesState, RootState } from "@/types";
import type { CategoryMapEntry } from "@/constants/icons";

import { defaultCategory } from "@/configs/default";
import { only_if_cloudConnected } from "@/libs/firebase";
import { order_asc_sort } from "@/utils/sort";

import { CATEGORY_MAP } from "@/constants/icons";

import { addCloudCategoriesAsync, deleteCloudCategoriesAsync } from "./thunks/categories";

const initialState: CategoriesState = {
  items: [defaultCategory],
  cloud: {
    items: {
      add: {},
      delete: {},
    },
  },
};

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    createCategory: (state, action: PayloadAction<{ name: string; icon: string }>) => {
      const category: Category = {
        order: state.items.length,
        name: action.payload.name,
        icon: action.payload.icon,
        index: false,
        selected: false,
      };

      state.items.push(category);

      only_if_cloudConnected(() => {
        state.cloud.items.add[category.icon] = category;
      });
    },

    deleteCategory: (state, action: PayloadAction<Category>) => {
      const { icon, index, selected } = action.payload;

      if (index) return;

      if (selected) {
        state.items.forEach((category) => {
          category.selected = category.icon === defaultCategory.icon;
        });
      }

      let order = 0;
      state.items = state.items.filter((category) => {
        if (category.icon !== icon) {
          category.order = order++;
          only_if_cloudConnected(() => {
            state.cloud.items.add[category.icon] = category;
          });
          return true;
        }
        return false;
      });

      only_if_cloudConnected(() => {
        state.cloud.items.delete[icon] = action.payload;
      });
    },

    setCategories: (state, action: PayloadAction<{ categories: Category[]; reorder?: boolean; fromSync?: boolean }>) => {
      const { categories, reorder, fromSync } = action.payload;

      state.items = reorder ? [...categories].sort(order_asc_sort) : categories;

      if (!fromSync) {
        only_if_cloudConnected(() => {
          state.items.forEach((category) => {
            state.cloud.items.add[category.icon] = category;
          });
        });
      }
    },

    swapCategory: (state, action: PayloadAction<{ icon: string }>) => {
      const { icon } = action.payload;
      state.items.forEach((category) => {
        category.selected = category.icon === icon;
      });
    },

    updateCategory: (
      state,
      action: PayloadAction<{ nextCategory: { name: string; icon: string }; prevCategory: Category; index: boolean }>
    ) => {
      const { nextCategory, prevCategory, index } = action.payload;
      if (index) return;

      const category = state.items.find((cat) => cat.icon === prevCategory.icon);
      if (category) {
        category.name = nextCategory.name;
        category.icon = nextCategory.icon;

        only_if_cloudConnected(() => {
          state.cloud.items.add[category.icon] = category;
        });
      }
    },

    wipeCategories: (state) => {
      state.items = [defaultCategory];
    },

    addLocalCategories: (state, action: PayloadAction<Record<string, Category>>) => {
      Object.values(action.payload).forEach((cloudCategory) => {
        const idx = state.items.findIndex((localCategory) => localCategory.icon === cloudCategory.icon);
        if (idx === -1) {
          state.items.push(cloudCategory);
        } else {
          state.items[idx] = cloudCategory;
        }
      });
      state.items.sort(order_asc_sort);
    },

    deleteLocalCategories: (state, action: PayloadAction<Record<string, Category>>) => {
      Object.values(action.payload).forEach((cloudCategory) => {
        if (cloudCategory.selected) {
          state.items.forEach((category) => {
            category.selected = category.icon === defaultCategory.icon;
          });
        }
        state.items = state.items.filter((localCategory) => localCategory.icon !== cloudCategory.icon);
      });
      state.items.sort(order_asc_sort);
    },

    resetCloudCategories: (state) => {
      state.cloud.items.add = {};
      state.cloud.items.delete = {};
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(addCloudCategoriesAsync.fulfilled, (state, action: PayloadAction<Record<string, Category>>) => {
        Object.keys(action.payload).forEach((id) => {
          delete state.cloud.items.add[id];
        });
      })
      .addCase(deleteCloudCategoriesAsync.fulfilled, (state, action: PayloadAction<Record<string, Category>>) => {
        Object.keys(action.payload).forEach((id) => {
          delete state.cloud.items.delete[id];
        });
      });
  },
});

export const {
  createCategory,
  deleteCategory,
  setCategories,
  swapCategory,
  updateCategory,
  wipeCategories,
  addLocalCategories,
  deleteLocalCategories,
  resetCloudCategories,
} = categoriesSlice.actions;

export const getCategories = (state: RootState): Category[] => state.categories.items;

export const getCloudCategories = (state: RootState): CategoriesState["cloud"]["items"] => state.categories.cloud.items;

export const getCurrentCategory = createSelector([getCategories], (categories): Category | undefined =>
  categories.find((cat) => cat.selected)
);

export const getUnusedCategories = (catExcpt: string) =>
  createSelector([getCategories], (categories): CategoryMapEntry[] => {
    const mutableCategoryMap: Record<string, CategoryMapEntry | null> = { ...CATEGORY_MAP };
    categories.forEach((category) => {
      if (catExcpt !== category.icon) {
        mutableCategoryMap[category.icon] = null;
      }
    });
    return Object.values(mutableCategoryMap).filter(Boolean) as CategoryMapEntry[];
  });

export default categoriesSlice.reducer;
