import { configs } from "@/configs";
import { useTranslation } from "react-i18next";
import { Linking, Platform } from "react-native";

import SectionItemList_Navigation from "../../components/item/SectionItemList_Navigation";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_CheckUpdates({ isLast }) {
  const { t } = useTranslation();

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation
        title={t("generalsettings.check_updates")}
        onPress={() =>
          Linking.openURL(
            Platform.OS === "web"
              ? `${configs.app.websiteUrl}/download#latest`
              : Platform.OS === "android"
                ? configs.app.playStoreUrl
                : configs.app.appStoreUrl
          )
        }
      />
    </SectionItemList>
  );
}
