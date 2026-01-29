import React from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function WebhookItem({ title, webhook, setWebhookUrl, toggleWebhook }) {
  return (
    <>
      <Text style={styles.titleText}>{title}</Text>

      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          marginBottom: PADDING_MARGIN.md,
          opacity: webhook.enabled ? 1 : 0.5,
        }}
      >
        {/* checkbox */}

        <TouchableOpacity activeOpacity={0.7} style={{ marginRight: PADDING_MARGIN.sm }} onPress={toggleWebhook}>
          <View style={styles.checkbox}>
            {webhook.enabled && <CheckIcon size={28} color={COLOR.softWhite} style={{ margin: 7 }} />}
          </View>
        </TouchableOpacity>

        {/* request type */}

        <View style={styles.requestType}>
          <Text style={styles.titleText}>POST</Text>
        </View>

        {/* url */}

        <TextInput
          style={styles.listItemInput}
          textAlignVertical="center"
          onChangeText={setWebhookUrl}
          value={webhook.url}
          cursorColor={COLOR.softWhite}
        />
      </View>
    </>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  titleText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.semiBold,
    lineHeight: 40,
  },
  requestType: {
    paddingVertical: Platform.OS === "ios" ? 2 : 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    height: 48,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 2,
    borderLeftColor: COLOR.boldBlue,
    borderTopColor: COLOR.boldBlue,
    borderBottomColor: COLOR.boldBlue,
    borderRightColor: COLOR.darkBlue,
    backgroundColor: COLOR.blue,
  },
  listItemInput: {
    minHeight: 48,
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 4,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.lg - 4,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
    borderTopRightRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  checkbox: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    height: 48,
    width: 48,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
});
