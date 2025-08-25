import React, { useState } from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import { toggleWithSecret } from "@/utils/crypt";
import { webhook } from "@/utils/webhook";
import { useRouter } from "@/hooks/useRouter";
import ComplexDialog from "@/components/dialogs/ComplexDialog";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";

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

  const [showWipeDataDialog, setShowWipeDataDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  return (
    <>
      <ComplexDialog
        open={showWipeDataDialog}
        actionsColumn={isCloudConnected && netInfo?.isConnected}
        adornmentStart={<ExclamationTriangleIcon size={22} style={{ marginBottom: -3 }} />}
        title={t("warning")}
        description={t("popup.are_you_sure_wipe")}
        confirm={{
          label: t("wipe"),
          handler: () => {
            dispatch(wipeNotes(false));
            dispatch(wipeCategories(false));
            webhook(webhook_wipeData, {
              action: "generic/wipeData",
              cloud: false,
            });
            setShowWipeDataDialog(false);
            setShowSuccessDialog(true);
          },
        }}
        alternative={
          isCloudConnected && netInfo?.isConnected
            ? {
                label: t("wipeWithCloud"),
                handler: () => {
                  dispatch(wipeNotes(true));
                  dispatch(wipeCategories(true));
                  webhook(webhook_wipeData, {
                    action: "generic/wipeData",
                    cloud: true,
                  });
                  setShowWipeDataDialog(false);
                  setShowSuccessDialog(true);
                },
              }
            : null
        }
        cancel={{
          label: t("cancel"),
          handler: () => setShowWipeDataDialog(false),
        }}
      />

      <ConfirmOrCancelDialog
        open={showSuccessDialog}
        title={t("report.messages.success.title")}
        description={t("popup.generic_success_description")}
        onConfirm={() => setShowSuccessDialog(false)}
      />

      <SectionItemList isLast={isLast}>
        <SectionItemList_Text
          title={t("generalsettings.wipe_data")}
          onPress={() =>
            toggleWithSecret({
              router,
              isFingerprintEnabled,
              callback: () => setShowWipeDataDialog(true),
            })
          }
        />
      </SectionItemList>
    </>
  );
}
