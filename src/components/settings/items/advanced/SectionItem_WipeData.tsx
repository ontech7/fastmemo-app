import ComplexDialog from "@/components/dialogs/ComplexDialog";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import useNetInfo from "@/hooks/useNetInfo";
import { useSecret } from "@/hooks/useSecret";
import { useVaultUnlocked } from "@/hooks/useVaultUnlocked";
import { getCloudConnected, selectorWebhook_wipeData } from "@/slicers/settingsSlice";
import { useAppDispatch } from "@/slicers/store";
import { wipeCategoriesThunk } from "@/slicers/thunks/categories";
import { wipeNotesThunk } from "@/slicers/thunks/notes";
import { webhook } from "@/utils/webhook";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { useSelector } from "react-redux";
import SectionItemList_Text from "@/components/settings/components/item/SectionItemList_Text";
import SectionItemList from "@/components/settings/components/list/SectionItemList";

import { COLOR } from "@/constants/styles";

interface Props {
  isLast: boolean;
}

export default function SectionItem_WipeData({ isLast }: Props) {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const { unlockWithSecret } = useSecret();

  const netInfo = useNetInfo();

  const webhook_wipeData = useSelector(selectorWebhook_wipeData);
  const isCloudConnected = useSelector(getCloudConnected);
  const vaultUnlocked = useVaultUnlocked();

  // Wiping the cloud requires a connected, online project AND an unlocked vault.
  // When sync is paused waiting for the passphrase (vault locked), we hide the
  // "wipe + cloud" path so the user can't erase cloud data without first proving
  // ownership of the vault — that would bypass the E2E unlock rules.
  const canWipeCloud = isCloudConnected && !!netInfo?.isConnected && vaultUnlocked;

  const [showWipeDataDialog, setShowWipeDataDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  return (
    <>
      <ComplexDialog
        open={showWipeDataDialog}
        actionsColumn={canWipeCloud}
        adornmentStart={<ExclamationTriangleIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}
        title={t("warning")}
        description={t("popup.are_you_sure_wipe")}
        confirm={{
          label: t("wipe"),
          handler: () => {
            dispatch(wipeNotesThunk({ wipeCloud: false }));
            dispatch(wipeCategoriesThunk({ wipeCloud: false }));
            webhook(webhook_wipeData, {
              action: "generic/wipeData",
              cloud: false,
            });
            setShowWipeDataDialog(false);
            setShowSuccessDialog(true);
          },
        }}
        alternative={
          canWipeCloud
            ? {
                label: t("wipeWithCloud"),
                handler: () => {
                  dispatch(wipeNotesThunk({ wipeCloud: true }));
                  dispatch(wipeCategoriesThunk({ wipeCloud: true }));
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
          onPress={() => unlockWithSecret(() => setShowWipeDataDialog(true))}
        />
      </SectionItemList>
    </>
  );
}
