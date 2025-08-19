import React from "react";
import { configs } from "@/configs";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { InformationCircleIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import WebhookItem from "@/components/webhook/WebhookItem";
import { selectorWebhooks, setWebhooks } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function WebhooksScreen() {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const allWebhooks = useSelector(selectorWebhooks);
  const webhooks_keys = Object.keys(allWebhooks);
  const webhooks_values = Object.values(allWebhooks);

  const toggleWebhook = (key) => () => {
    const webhook = allWebhooks[key];

    dispatch(
      setWebhooks({
        ...allWebhooks,
        [key]: {
          url: webhook.url,
          enabled: !webhook.enabled,
        },
      })
    );
  };

  const setWebhookUrl = (key) => (url) => {
    const webhook = allWebhooks[key];

    dispatch(
      setWebhooks({
        ...allWebhooks,
        [key]: {
          url: url,
          enabled: webhook.enabled,
        },
      })
    );
  };

  const renderItem = ({ item, index }) => (
    <WebhookItem
      title={t("webhooks." + webhooks_keys[index])}
      webhook={item}
      toggleWebhook={toggleWebhook(webhooks_keys[index])}
      setWebhookUrl={setWebhookUrl(webhooks_keys[index])}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("webhooks.title")}</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(`${configs.app.websiteUrl}/${t("languageCode")}/guides/webhooks`)}
        >
          <InformationCircleIcon size={28} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>

      <FlashList
        showsVerticalScrollIndicator={false}
        data={webhooks_values}
        renderItem={renderItem}
        keyExtractor={(_, index) => webhooks_keys[index]}
        estimatedItemSize={40}
      />
    </SafeAreaView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.md,
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    flexGrow: 1,
    textAlign: "center",
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  sectionWrapper: {
    marginBottom: PADDING_MARGIN.lg,
    backgroundColor: COLOR.boldBlue,
    borderRadius: BORDER.normal,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    borderBottomWidth: 1,
    borderColor: COLOR.darkBlue,
  },
  sectionHeaderTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  sectionList: {
    height: 0,
    borderRadius: BORDER.normal,
    overflow: "hidden",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: 0,
  },
  accordionWrapper: { height: "100%" },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: COLOR.darkBlue,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemList_button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionItemList_title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
    marginBottom: PADDING_MARGIN.sm,
  },
});
