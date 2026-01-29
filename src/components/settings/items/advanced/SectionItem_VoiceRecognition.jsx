import React from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

import SectionItemList_Navigation from "../../components/item/SectionItemList_Navigation";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_VoiceRecognition({ isLast }) {
  const { t } = useTranslation();
  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation
        title={t("generalsettings.voice_recognition")}
        route="/settings/voice-recognition"
        extra={<Text style={betaStyle}>BETA</Text>}
      />
    </SectionItemList>
  );
}

const betaStyle = {
  marginLeft: PADDING_MARGIN.sm,
  paddingLeft: PADDING_MARGIN.sm,
  paddingTop: 1,
  paddingRight: PADDING_MARGIN.sm - 2,
  color: COLOR.yellow,
  borderRadius: BORDER.small,
  borderWidth: 1,
  borderColor: COLOR.yellow,
};
