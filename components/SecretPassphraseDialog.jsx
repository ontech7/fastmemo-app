import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import Dialog from "react-native-dialog";

import { COLOR } from "@/constants/styles";

export default function SecretPassphraseDialog({ title, description, visible, setVisible, onSetSecretPassphrase }) {
  const { t } = useTranslation();

  const textInputRef = useRef(null);

  const handleConfirm = () => onSetSecretPassphrase(textInputRef.current);

  const handleCancel = () => setVisible(false);

  return (
    <Dialog.Container visible={visible}>
      {title && <Dialog.Title style={Platform.OS !== "ios" ? { color: COLOR.black } : {}}>{title}</Dialog.Title>}

      {description && (
        <Dialog.Description style={Platform.OS !== "ios" ? { color: COLOR.black } : {}}>{description}</Dialog.Description>
      )}

      <Dialog.Input
        style={Platform.OS !== "ios" ? { color: COLOR.black } : {}}
        onChangeText={(text) => (textInputRef.current = text)}
      />

      <Dialog.Button
        style={Platform.OS !== "ios" ? { color: COLOR.boldBlue } : {}}
        label={t("cancel")}
        onPress={handleCancel}
      />

      <Dialog.Button
        style={Platform.OS !== "ios" ? { color: COLOR.boldBlue } : {}}
        label={t("confirm")}
        onPress={handleConfirm}
      />
    </Dialog.Container>
  );
}
