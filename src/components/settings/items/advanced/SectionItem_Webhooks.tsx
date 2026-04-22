import { useTranslation } from "react-i18next";

import type { TextStyle } from "react-native";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

import SectionItemList_Navigation from "../../components/item/SectionItemList_Navigation";
import SectionItemList from "../../components/list/SectionItemList";

interface Props {
  isLast: boolean;
}

export default function SectionItem_Webhooks({ isLast }: Props) {
  const { t } = useTranslation();
  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation title={t("generalsettings.webhooks")} route="/settings/webhooks" />
    </SectionItemList>
  );
}

const betaStyle: TextStyle = {
  marginLeft: PADDING_MARGIN.sm,
  paddingLeft: PADDING_MARGIN.sm,
  paddingTop: 1,
  paddingRight: PADDING_MARGIN.sm - 2,
  color: COLOR.yellow,
  borderRadius: BORDER.small,
  borderWidth: 1,
  borderColor: COLOR.yellow,
};
