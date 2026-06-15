import { configs } from "@/configs";
import { useAppUpdate } from "@/providers/AppUpdateProvider";
import { openUrl } from "@/utils/openUrl";
import { isTauri } from "@/utils/platform";
import { selectorDeveloperMode } from "@/slicers/settingsSlice";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useSelector } from "react-redux";

import SectionItemList_Navigation from "@/components/settings/components/item/SectionItemList_Navigation";
import SectionItemList from "@/components/settings/components/list/SectionItemList";
import BlinkingDot from "@/components/ui/BlinkingDot";

interface Props {
  isLast: boolean;
}

export default function SectionItem_CheckUpdates({ isLast }: Props) {
  const { t } = useTranslation();
  const { updateAvailable } = useAppUpdate();
  const [isChecking, setIsChecking] = useState(false);

  // SectionItem_DeveloperOptions is the only entry after this one in SECTION_INFO,
  // and it renders nothing unless developer mode is enabled. When it's disabled this
  // item becomes the last visible row, so drop its bottom border in that case.
  const developerMode = useSelector(selectorDeveloperMode);
  const isLastVisible = isLast || !developerMode.enabled;

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
      } catch (error: any) {
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
    <SectionItemList isLast={isLastVisible}>
      <SectionItemList_Navigation
        title={isChecking ? t("generalsettings.checking_updates") : t("generalsettings.check_updates")}
        extra={updateAvailable ? <BlinkingDot style={{ marginLeft: 8, alignSelf: "center" }} /> : null}
        onPress={checkForUpdates}
      />
    </SectionItemList>
  );
}
