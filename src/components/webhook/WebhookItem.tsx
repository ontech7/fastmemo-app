import { memo } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon } from "react-native-heroicons/outline";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

import type { WebhookPayload } from "@/types";

interface Props {
  title: string;
  webhook: WebhookPayload;
  setWebhookUrl: (url: string) => void;
  toggleWebhook: () => void;
}

function WebhookItem({ title, webhook, setWebhookUrl, toggleWebhook }: Props) {
  return (
    <>
      <Text style={styles.titleText}>{title}</Text>

      <View style={[styles.row, { opacity: webhook.enabled ? 1 : 0.5 }]}>
        {/* checkbox */}

        <TouchableOpacity activeOpacity={0.7} style={styles.checkboxWrapper} onPress={toggleWebhook}>
          <View style={[styles.checkbox, webhook.enabled && styles.checkboxChecked]}>
            {webhook.enabled && (
              <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                <CheckIcon size={24} color={COLOR.softWhite} />
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>

        {/* request type */}

        <View style={styles.requestType}>
          <Text style={styles.requestTypeText}>POST</Text>
        </View>

        {/* url */}

        <TextInput
          style={styles.listItemInput}
          textAlignVertical="center"
          onChangeText={setWebhookUrl}
          value={webhook.url}
          placeholder="https://"
          placeholderTextColor={COLOR.textMuted}
          cursorColor={COLOR.textPrimary}
        />
      </View>
    </>
  );
}

export default memo(WebhookItem);

/* STYLES */

const styles = StyleSheet.create({
  titleText: {
    color: COLOR.textPrimary,
    fontSize: FONTSIZE.inputTitle,
    fontFamily: FONT.semiBold,
    lineHeight: 40,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: PADDING_MARGIN.md,
  },
  checkboxWrapper: {
    marginRight: PADDING_MARGIN.sm,
  },
  requestType: {
    paddingVertical: Platform.OS === "ios" ? 2 : 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    height: 48,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
    borderColor: GLASS.border,
    backgroundColor: COLOR.surfaceMuted,
  },
  requestTypeText: {
    color: COLOR.textSecondary,
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
  },
  listItemInput: {
    minHeight: 48,
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.regular,
    color: COLOR.textPrimary,
    borderTopRightRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  checkbox: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    height: 48,
    width: 48,
    borderWidth: 1,
    borderColor: GLASS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
});
