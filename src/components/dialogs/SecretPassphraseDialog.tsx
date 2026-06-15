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
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { BORDER, COLOR, GLASS } from "@/constants/styles";

interface Props {
  open: boolean;
  title: string;
  description?: string | null;
  onConfirm: (passphrase: string | null) => void;
  onCancel: () => void;
}

export default function SecretPassphraseDialog({ open, title, description = null, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  const textInputRef = useRef(null);

  return (
    <Dialog open={open} slideFrom="center">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogBody>
        <DialogInput
          placeholder={t("generalsettings.export_import_placeholder_input")}
          placeholderTextColor={COLOR.textMuted}
          cursorColor={COLOR.textPrimary}
          style={{ backgroundColor: COLOR.bg, borderColor: GLASS.border, borderRadius: BORDER.normal }}
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
