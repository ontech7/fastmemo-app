import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";
import { useTranslation } from "react-i18next";
import type { TextStyle } from "react-native";
import { Text } from "react-native";
import SectionItemList_Navigation from "@/components/settings/components/item/SectionItemList_Navigation";
import SectionItemList from "@/components/settings/components/list/SectionItemList";

interface Props {
  isLast: boolean;
}

export default function SectionItem_AIAssistant({ isLast }: Props) {
  const { t } = useTranslation();
  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation
        title={t("generalsettings.ai_assistant")}
        route="/settings/ai-assistant"
        extra={<Text style={betaStyle}>BETA</Text>}
      />
    </SectionItemList>
  );
}

const betaStyle: TextStyle = {
  marginLeft: PADDING_MARGIN.sm,
  paddingLeft: PADDING_MARGIN.sm,
  paddingTop: 1,
  paddingRight: PADDING_MARGIN.sm - 2,
  color: COLOR.oceanBreeze,
  borderRadius: BORDER.small,
  borderWidth: 1,
  borderColor: COLOR.oceanBreeze,
};
