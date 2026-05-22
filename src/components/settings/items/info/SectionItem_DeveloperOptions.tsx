import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useSecret } from "@/hooks/useSecret";
import { selectorDeveloperMode } from "@/slicers/settingsSlice";

import SectionItemList_Navigation from "@/components/settings/components/item/SectionItemList_Navigation";
import SectionItemList from "@/components/settings/components/list/SectionItemList";

interface Props {
  isLast: boolean;
}

export default function SectionItem_DeveloperOptions({ isLast }: Props) {
  const { t } = useTranslation();

  const { unlockWithSecret } = useSecret();

  const developerMode = useSelector(selectorDeveloperMode);

  if (!developerMode.enabled) return null;

  const handlePress = () => {
    unlockWithSecret((router, isFingerprint) => {
      if (isFingerprint) {
        router.push("/settings/developer-options");
      } else {
        router.replace("/settings/developer-options");
      }
    }, "none");
  };

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Navigation title={t("generalsettings.developer_options")} onPress={handlePress} />
    </SectionItemList>
  );
}
