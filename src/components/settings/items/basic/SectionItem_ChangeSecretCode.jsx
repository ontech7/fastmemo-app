import React from "react";
import { useTranslation } from "react-i18next";

import { useRouter } from "@/hooks/useRouter";

import SectionItemList_Text from "../../components/item/SectionItemList_Text";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_ChangeSecretCode({ isLast }) {
  const { t } = useTranslation();

  const router = useRouter();

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Text
        title={t("generalsettings.change_secret_code")}
        text="****"
        onPress={() =>
          router.push({
            pathname: "/secret-code",
            params: { startPhase: "oldCode" },
          })
        }
      />
    </SectionItemList>
  );
}
