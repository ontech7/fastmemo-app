import { configs } from "@/configs";
import { useAppUpdate } from "@/providers/AppUpdateProvider";
import { openUrl } from "@/utils/openUrl";
import { isTauri } from "@/utils/platform";
import { toast } from "@/utils/toast";
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
  const { updateAvailable, checkDesktopUpdate } = useAppUpdate();
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
        // A found update opens the install prompt (AppUpdateProvider).
        if (!(await checkDesktopUpdate())) toast(t("generalsettings.no_updates"));
      } catch (error) {
        console.error("Update check failed:", error);
        toast(`${t("error")}: ${error instanceof Error ? error.message : String(error)}`);
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
