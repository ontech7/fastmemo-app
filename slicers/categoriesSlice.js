import { createSlice } from "@reduxjs/toolkit";

import { COLLECTIONS, deleteCollectionInCloud, only_if_cloudConnected } from "@/libs/firebase";
import { order_asc_sort } from "@/utils/sort";
import { defaultCategory } from "@/configs/default";

import { CATEGORY_MAP } from "@/constants/icons";

import { addCloudCategoriesAsync, deleteCloudCategoriesAsync } from "./thunks/categories";

const initialState = {
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
    createCategory: (state, action) => {
      const category = {
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

    deleteCategory: (state, action) => {
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

    setCategories: (state, action) => {
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

    swapCategory: (state, action) => {
      const { icon } = action.payload;
      state.items.forEach((category) => {
        category.selected = category.icon === icon;
      });
    },

    updateCategory: (state, action) => {
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

    wipeCategories: (state, action) => {
      state.items = [defaultCategory];
      if (action.payload) {
        deleteCollectionInCloud(COLLECTIONS.data.categories);
      }
    },

    addLocalCategories: (state, action) => {
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

    deleteLocalCategories: (state, action) => {
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
      .addCase(addCloudCategoriesAsync.fulfilled, (state, action) => {
        Object.keys(action.payload).forEach((id) => {
          delete state.cloud.items.add[id];
        });
      })
      .addCase(deleteCloudCategoriesAsync.fulfilled, (state, action) => {
        Object.keys(action.payload).forEach((id) => {
          delete state.cloud.items.delete[id];
        });
      });
  },
});

// Actions
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

// Selectors
export const getCurrentCategory = (state) => state.categories.items.find((cat) => cat.selected);

export const getCategories = (state) => state.categories.items;

export const getCloudCategories = (state) => state.categories.cloud.items;

export const getUnusedCategories = (catExcpt) => (state) => {
  const mutableCategoryMap = { ...CATEGORY_MAP };
  state.categories.items.forEach((category) => {
    if (catExcpt !== category.icon) {
      mutableCategoryMap[category.icon] = null;
    }
  });
  return Object.values(mutableCategoryMap).filter(Boolean);
};

export default categoriesSlice.reducer;
