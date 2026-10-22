import { Linking } from "react-native";

/** Opens a URL in the default browser (the `.web` sibling handles the desktop app). */
export async function openUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}
