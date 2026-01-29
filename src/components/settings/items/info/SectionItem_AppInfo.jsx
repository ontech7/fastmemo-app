import React from "react";
import { useTranslation } from "react-i18next";

import SectionItemList_Navigation from "../../components/item/SectionItemList_Navigation";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_AppInfo({ isLast }) {
  const { t } = useTranslation();

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation title={t("generalsettings.about_the_app")} route="/settings/information" />
    </SectionItemList>
  );
}
