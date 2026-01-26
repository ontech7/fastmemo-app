import { useTranslation } from "react-i18next";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";

import ComplexDialog from "./ComplexDialog";

export default function ConfirmOrCancelDialog({
  open,
  title = null,
  description,
  cancelLabel = null,
  onCancel = null,
  confirmLabel = null,
  onConfirm,
}) {
  const { t } = useTranslation();

  return (
    <ComplexDialog
      open={open}
      adornmentStart={<ExclamationTriangleIcon size={22} style={{ marginBottom: -3 }} />}
      title={title || t("warning")}
      description={description}
      cancel={
        onCancel
          ? {
              label: cancelLabel || t("cancel"),
              handler: onCancel,
            }
          : null
      }
      confirm={{
        label: confirmLabel || t("confirm"),
        handler: onConfirm,
      }}
    />
  );
}
