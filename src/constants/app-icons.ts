import type { ImageSourcePropType } from "react-native";

import christmasPreview from "~/assets/images/app-icons/christmas-preview.png";
import defaultPreview from "~/assets/images/app-icons/default-preview.png";
import easterPreview from "~/assets/images/app-icons/easter-preview.png";
import halloweenPreview from "~/assets/images/app-icons/halloween-preview.png";
import summerPreview from "~/assets/images/app-icons/summer-preview.png";

/** The alternate icons: the same names as the expo-alternate-app-icons entries in app.config.ts. */
export type AppIconName = "Halloween" | "Christmas" | "Easter" | "Summer";

export type AppIconId = AppIconName | "default";

export interface AppIconOption {
  id: AppIconId;
  labelKey: string;
  /** A small copy of the icon (scripts/build-app-icons.mjs): the 1024 px one would be decoded whole for a thumbnail. */
  preview: ImageSourcePropType;
}

export const APP_ICONS: AppIconOption[] = [
  { id: "default", labelKey: "appicon.default", preview: defaultPreview },
  { id: "Halloween", labelKey: "appicon.halloween", preview: halloweenPreview },
  { id: "Christmas", labelKey: "appicon.christmas", preview: christmasPreview },
  { id: "Easter", labelKey: "appicon.easter", preview: easterPreview },
  { id: "Summer", labelKey: "appicon.summer", preview: summerPreview },
];
