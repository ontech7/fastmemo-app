import { configs } from "@/configs";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { openUrl } from "@/utils/openUrl";
import { InformationCircleIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import type { WebhookPayload } from "@/types";
import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import WebhookItem from "@/components/webhook/WebhookItem";
import { selectorWebhooks, setWebhooks } from "@/slicers/settingsSlice";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

export default function WebhooksScreen() {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const allWebhooks = useSelector(selectorWebhooks);
  const webhooks_keys = Object.keys(allWebhooks);
  const webhooks_values: WebhookPayload[] = Object.values(allWebhooks);

  const toggleWebhook = (key: string) => () => {
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

  const setWebhookUrl = (key: string) => (url: string) => {
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

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />

        <Text style={styles.headerTitle}>{t("webhooks.title")}</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openUrl(`${configs.app.websiteUrl}/${t("languageCode")}/guides/webhooks`)}
        >
          <IconChip>
            <InformationCircleIcon size={20} color={COLOR.softWhite} />
          </IconChip>
        </TouchableOpacity>
      </View>

      <FlashList<WebhookPayload>
        maintainVisibleContentPosition={{
          disabled: true,
        }}
        showsVerticalScrollIndicator={false}
        data={webhooks_values}
        extraData={{ toggleWebhook, setWebhookUrl, t }}
        renderItem={({ item, index }) => (
          <WebhookItem
            title={t("webhooks." + webhooks_keys[index])}
            webhook={item}
            toggleWebhook={toggleWebhook(webhooks_keys[index])}
            setWebhookUrl={setWebhookUrl(webhooks_keys[index])}
          />
        )}
        keyExtractor={(_: WebhookPayload, index: number) => webhooks_keys[index]}
      />
    </SafeAreaView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.md,
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
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
});
