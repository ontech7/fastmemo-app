import { useTranslation } from "react-i18next";
import { LockClosedIcon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

import ComplexDialog from "./ComplexDialog";

interface Props {
  open: boolean;
  /** Dismiss (Close button or tap outside). */
  onClose: () => void;
  /** Go to Cloud sync settings. */
  onGo: () => void;
}

/**
 * Startup prompt shown when the cloud is connected but encryption needs the
 * user's attention (no cached key — they must unlock or set it up). Used instead
 * of a toast because sync stays paused until they act, and a toast is easy to miss.
 * Dismissible by tapping outside or "Close".
 */
export default function VaultPromptDialog({ open, onClose, onGo }: Props) {
  const { t } = useTranslation();

  return (
    <ComplexDialog
      open={open}
      onDismiss={onClose}
      adornmentStart={<LockClosedIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}
      title={t("cloudsync.vault.prompt_title")}
      description={t("cloudsync.vault.prompt_desc")}
      cancel={{ label: t("cloudsync.vault.prompt_close"), handler: onClose }}
      confirm={{ label: t("cloudsync.vault.prompt_go"), handler: onGo }}
    />
  );
}
