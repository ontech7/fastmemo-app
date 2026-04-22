import { useTranslation } from "react-i18next";

import SectionItemList_Navigation from "@/components/settings/components/item/SectionItemList_Navigation";
import SectionItemList from "@/components/settings/components/list/SectionItemList";

interface Props {
  isLast: boolean;
}

export default function SectionItem_VoiceRecognition({ isLast }: Props) {
  const { t } = useTranslation();

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation title={t("generalsettings.voice_recognition")} route="/settings/voice-recognition" />
    </SectionItemList>
  );
}
