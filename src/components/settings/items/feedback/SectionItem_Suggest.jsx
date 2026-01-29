import React from "react";
import { configs } from "@/configs";
import { useTranslation } from "react-i18next";
import { Platform, Share } from "react-native";

import SectionItemList_Text from "../../components/item/SectionItemList_Text";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_Suggest({ isLast }) {
  const { t } = useTranslation();

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Text
        title={t("generalsettings.suggest")}
        onPress={() =>
          Share.share({
            message:
              Platform.OS === "web"
                ? configs.app.websiteUrl
                : Platform.OS === "android"
                  ? configs.app.playStoreUrl
                  : configs.app.appStoreUrl,
          })
        }
      />
    </SectionItemList>
  );
}
