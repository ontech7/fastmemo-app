import { DialogInput } from "@ontech7/react-native-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import ComplexDialog from "@/components/dialogs/ComplexDialog";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { normalizeLink } from "@/libs/links";

interface Props {
  visible: boolean;
  initialText: string;
  initialAddress: string;
  /** The address as `normalizeLink` gives it, and the text (the address as typed when left empty). */
  onConfirm: (address: string, text: string) => void;
  onClose: () => void;
}

/**
 * A link's text and address. An address `normalizeLink` refuses keeps the dialog open with a message under the field. The
 * parent mounts it anew for each link (`key`), so the fields start from the link's own.
 */
export default function LinkDialog({ visible, initialText, initialAddress, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const [address, setAddress] = useState(initialAddress);
  const [invalid, setInvalid] = useState(false);

  const confirm = () => {
    const href = normalizeLink(address);
    if (!href) return setInvalid(true);
    onConfirm(href, text.trim() ? text : address.trim());
  };

  return (
    <ComplexDialog
      open={visible}
      title={t("note.link.title")}
      confirm={{ label: t("confirm"), handler: confirm }}
      cancel={{ label: t("cancel"), handler: onClose }}
      onDismiss={onClose}
    >
      <View style={styles.fields}>
        <Text style={styles.label}>{t("note.link.text")}</Text>
        <DialogInput
          value={text}
          onChangeText={setText}
          placeholderTextColor={COLOR.textMuted}
          cursorColor={COLOR.textPrimary}
          style={styles.input}
          accessibilityLabel={t("note.link.text")}
        />
        <Text style={styles.label}>{t("note.link.address")}</Text>
        <DialogInput
          value={address}
          onChangeText={(value: string) => {
            setAddress(value);
            setInvalid(false);
          }}
          placeholder="https://"
          placeholderTextColor={COLOR.textMuted}
          cursorColor={COLOR.textPrimary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          accessibilityLabel={t("note.link.address")}
        />
        {invalid && (
          <Text style={styles.invalid} accessibilityLiveRegion="polite">
            {t("note.link.invalid")}
          </Text>
        )}
      </View>
    </ComplexDialog>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  fields: {
    gap: PADDING_MARGIN.xs,
  },
  label: {
    marginTop: PADDING_MARGIN.xs,
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
  input: {
    backgroundColor: COLOR.bg,
    borderColor: GLASS.border,
    borderRadius: BORDER.normal,
  },
  invalid: {
    color: COLOR.dangerSoft,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
});
