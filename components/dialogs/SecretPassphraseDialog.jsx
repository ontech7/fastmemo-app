import { useRef } from "react";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogInput,
  DialogTitle,
} from "@ontech7/react-native-dialog";
import { useTranslation } from "react-i18next";

export default function SecretPassphraseDialog({ open, title, description = null, onConfirm, onCancel }) {
  const { t } = useTranslation();

  const textInputRef = useRef(null);

  return (
    <Dialog open={open} slideFrom="bottom">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogBody>
        <DialogInput
          placeholder={t("generalsettings.export_import_placeholder_input")}
          secureTextEntry
          autoCapitalize="none"
          onChangeText={(text) => (textInputRef.current = text)}
        />
      </DialogBody>
      <DialogFooter>
        <DialogAction onPress={onCancel}>{t("cancel")}</DialogAction>
        <DialogAction onPress={() => onConfirm(textInputRef.current)}>{t("confirm")}</DialogAction>
      </DialogFooter>
    </Dialog>
  );
}
