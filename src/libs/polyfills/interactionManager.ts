import { runWhenIdle } from "@/utils/idle";

/**
 * React Native 0.87 removed `InteractionManager` (dev: invariant on access; release: undefined),
 * but `react-native-draggable-flatlist` (unmaintained, used by the todo editor) still calls
 * `InteractionManager.runAfterInteractions` during render whenever the list's keys change, so
 * every reorder/add/delete threw. Re-provide that one method on top of `runWhenIdle`.
 *
 * It must patch the CommonJS exports object itself: the library reads the property off it at
 * call time. Remove together with react-native-draggable-flatlist.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactNative = require("react-native");

Object.defineProperty(ReactNative, "InteractionManager", {
  configurable: true,
  enumerable: true,
  value: {
    runAfterInteractions: (task?: () => void) => runWhenIdle(() => task?.(), 500),
  },
});
