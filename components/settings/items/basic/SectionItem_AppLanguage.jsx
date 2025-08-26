import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { supportedLanguages } from "@/libs/i18n";
import { selectorLanguage, setLanguage } from "@/slicers/settingsSlice";

import SectionItemList_Text from "../../components/item/SectionItemList_Text";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_AppLanguage({ isLast }) {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const language = useSelector(selectorLanguage);

  const languageName = language !== "system" ? supportedLanguages[language].name : t("voicerecognition.language_default");

  const changeLanguage = () => {
    let nextLanguage = language;

    switch (language) {
      case "system":
        nextLanguage = "en";
        break;
      case "en":
        nextLanguage = "it";
        break;
      case "it":
        nextLanguage = "de";
        break;
      case "de":
        nextLanguage = "es";
        break;
      case "es":
        nextLanguage = "fr";
        break;
      case "fr":
        nextLanguage = "zh";
        break;
      case "zh":
        nextLanguage = "ja";
        break;
      case "ja":
        nextLanguage = "system";
        break;
      default:
        nextLanguage = "system";
        break;
    }

    dispatch(setLanguage(nextLanguage));
  };

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Text title={t("voicerecognition.language")} text={languageName} onPress={changeLanguage} />
    </SectionItemList>
  );
}
