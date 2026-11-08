import { useTranslation } from "react-i18next";

import SectionItemList_Navigation from "@/components/settings/components/item/SectionItemList_Navigation";
import SectionItemList from "@/components/settings/components/list/SectionItemList";

interface Props {
  isLast: boolean;
}

/** Desktop only: `components/settings/data.ts` lists it under `isTauri()`. */
export default function SectionItem_Mcp({ isLast }: Props) {
  const { t } = useTranslation();
  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation title={t("generalsettings.mcp")} route="/settings/mcp" />
    </SectionItemList>
  );
}
