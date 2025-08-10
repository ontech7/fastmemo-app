import React from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { popupAlert } from "@/utils/alert";
import { toggleWithSecret } from "@/utils/crypt";
import { webhook } from "@/utils/webhook";

import { wipeCategories } from "../../../../slicers/categoriesSlice";
import { wipeNotes } from "../../../../slicers/notesSlice";
import { getCloudConnected, selectorIsFingerprintEnabled, selectorWebhook_wipeData } from "../../../../slicers/settingsSlice";
import SectionItemList_Text from "../../components/item/SectionItemList_Text";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_WipeData({ isLast }) {
  const { t } = useTranslation();

  const router = useRouter();

  const dispatch = useDispatch();

  const webhook_wipeData = useSelector(selectorWebhook_wipeData);

  const isCloudConnected = useSelector(getCloudConnected);
  const isFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const netInfo = useNetInfo();

  const wipeData = () => {
    popupAlert(
      t("warning"),
      t("popup.are_you_sure_wipe"),
      {
        confirmText: t("wipe"),
        confirmHandler: () => {
          dispatch(wipeNotes(false));
          dispatch(wipeCategories(false));
          webhook(webhook_wipeData, {
            action: "generic/wipeData",
            cloud: false,
          });
        },
      },
      isCloudConnected && netInfo?.isConnected
        ? {
            alternateText: t("wipeWithCloud"),
            alternateHandler: () => {
              dispatch(wipeNotes(true));
              dispatch(wipeCategories(true));
              webhook(webhook_wipeData, {
                action: "generic/wipeData",
                cloud: true,
              });
            },
          }
        : {}
    );
  };

  const wipeDataWithSecret = () => {
    toggleWithSecret({
      router,
      isFingerprintEnabled,
      callback: wipeData,
    });
  };

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Text title={t("generalsettings.wipe_data")} onPress={wipeDataWithSecret} />
    </SectionItemList>
  );
}
