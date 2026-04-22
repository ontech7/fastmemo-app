import { useTranslation } from "react-i18next";
import { ArrowUpTrayIcon } from "react-native-heroicons/outline";

import ComplexDialog from "./ComplexDialog";

interface Props {
  open: boolean;
  latestVersion: string;
  onConfirm: () => void;
}

export default function UpdateAvailableDialog({ open, latestVersion, onConfirm }: Props) {
  const { t } = useTranslation();

  return (
    <ComplexDialog
      open={open}
      adornmentStart={<ArrowUpTrayIcon size={22} style={{ marginBottom: -3 }} />}
      title={t("popup.update_available_title")}
      description={t("popup.update_available_description", { version: latestVersion })}
      confirm={{
        label: t("popup.update_available_confirm"),
        handler: onConfirm,
      }}
    />
  );
}
