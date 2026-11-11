import * as Updates from "expo-updates";
import { DevSettings } from "react-native";

/** Starts the app again from its bundle (the crash screen's "Reopen"). */
export async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}
