import { configs } from "@/configs";
import { openUrl } from "@/utils/openUrl";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import SectionItemList_Navigation from "../../components/item/SectionItemList_Navigation";
import SectionItemList from "../../components/list/SectionItemList";

// @ts-ignore - __TAURI__ is injected by Tauri runtime
const isTauri = () => typeof window !== "undefined" && "__TAURI__" in window;

export default function SectionItem_CheckUpdates({ isLast }) {
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async () => {
    if (isChecking) return;

    if (isTauri()) {
      setIsChecking(true);
      try {
        const { checkUpdate, installUpdate } = await import("@tauri-apps/api/updater");
        const { relaunch } = await import("@tauri-apps/api/process");

        const { shouldUpdate, manifest } = await checkUpdate();

        if (shouldUpdate && manifest) {
          const userConfirmed = window.confirm(
            `${t("generalsettings.update_available")}: v${manifest.version}\n\n${t("generalsettings.update_confirm")}`
          );

          if (userConfirmed) {
            await installUpdate();
            await relaunch();
          }
        } else {
          window.alert(t("generalsettings.no_updates"));
        }
      } catch (error) {
        console.error("Update check failed:", error);
        window.alert(`${t("error")}: ${error.message || error}`);
      } finally {
        setIsChecking(false);
      }
    } else {
      openUrl(
        Platform.OS === "web"
          ? `${configs.app.websiteUrl}/download#latest`
          : Platform.OS === "android"
            ? configs.app.playStoreUrl
            : configs.app.appStoreUrl
      );
    }
  };

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation
        title={isChecking ? t("generalsettings.checking_updates") : t("generalsettings.check_updates")}
        onPress={checkForUpdates}
      />
    </SectionItemList>
  );
}
