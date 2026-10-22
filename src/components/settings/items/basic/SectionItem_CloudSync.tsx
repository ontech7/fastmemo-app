import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";

import CloudStatusDot from "@/components/cloud/CloudStatusDot";
import SectionItemList_Navigation from "@/components/settings/components/item/SectionItemList_Navigation";
import SectionItemList from "@/components/settings/components/list/SectionItemList";
import { PADDING_MARGIN } from "@/constants/styles";

interface Props {
  isLast: boolean;
}

export default function SectionItem_CloudSync({ isLast }: Props) {
  const { t } = useTranslation();

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation
        title={t("generalsettings.cloudsync")}
        extra={<CloudStatusDot style={styles.dot} />}
        route="/settings/cloud-sync/connect"
      />
    </SectionItemList>
  );
}

const styles = StyleSheet.create({
  dot: {
    marginLeft: PADDING_MARGIN.sm,
    alignSelf: "center",
  },
});
