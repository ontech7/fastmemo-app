import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { supportedLanguages } from "@/libs/i18n";
import { selectorLanguage } from "@/slicers/settingsSlice";
import { setLanguageThunk } from "@/slicers/thunks/settings";
import { useAppDispatch } from "@/slicers/store";

import SectionItemList_Text from "../../components/item/SectionItemList_Text";
import SectionItemList from "../../components/list/SectionItemList";

interface Props {
  isLast: boolean;
}

export default function SectionItem_AppLanguage({ isLast }: Props) {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();

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

    dispatch(setLanguageThunk(nextLanguage));
  };

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Text title={t("voicerecognition.language")} text={languageName} onPress={changeLanguage} />
    </SectionItemList>
  );
}
