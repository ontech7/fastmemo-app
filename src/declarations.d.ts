declare module "*.png" {
  import { ImageSourcePropType } from "react-native";
  const content: ImageSourcePropType;
  export default content;
}

// redux-persist 6 supports these (see its persistStore.js and getStoredState.js), but its typings omit them.
declare module "redux-persist/es/types" {
  interface PersistorOptions {
    manualPersist?: boolean;
  }

  // eslint-disable-next-line unused-imports/no-unused-vars -- merging requires repeating its type parameters
  interface PersistConfig<S, RS = any, HSS = any, ESS = any> {
    deserialize?: boolean | ((serialized: string) => unknown);
  }
}
