import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import BackButton from "@/components/buttons/BackButton";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SelectableCardList, { type SelectableCardItem } from "@/components/lists/SelectableCardList";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { APP_ICONS, type AppIconId } from "@/constants/app-icons";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { appIconClosesApp, getAppIcon, setAppIcon } from "@/libs/appIcon";
import { toast } from "@/utils/toast";

export default function AppIconScreen() {
  const { t } = useTranslation();

  const [current, setCurrent] = useState<AppIconId>(() => getAppIcon() ?? "default");
  const [confirming, setConfirming] = useState<AppIconId | null>(null);
  const changing = useRef(false);

  const items = useMemo<SelectableCardItem<AppIconId>[]>(
    () =>
      APP_ICONS.map((icon) => ({
        id: icon.id,
        label: t(icon.labelKey),
        icon: <Image source={icon.preview} style={styles.preview} accessibilityIgnoresInvertColors />,
      })),
    [t]
  );

  const applyIcon = useCallback(
    async (id: AppIconId) => {
      if (changing.current) return;
      changing.current = true;
      try {
        await setAppIcon(id === "default" ? null : id);
        setCurrent(id);
      } catch {
        toast(t("appicon.failed"));
      } finally {
        changing.current = false;
      }
    },
    [t]
  );

  const selectIcon = useCallback(
    (id: AppIconId) => {
      if (id === current) return;
      if (appIconClosesApp) setConfirming(id);
      else applyIcon(id);
    },
    [applyIcon, current]
  );

  const confirmIcon = useCallback(() => {
    if (confirming) applyIcon(confirming);
    setConfirming(null);
  }, [applyIcon, confirming]);

  return (
    <>
      <ConfirmOrCancelDialog
        open={confirming !== null}
        title={t("appicon.close_title")}
        description={t("appicon.close_description")}
        confirmLabel={t("appicon.close_confirm")}
        onConfirm={confirmIcon}
        onCancel={() => setConfirming(null)}
      />

      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <BackButton chip />
          <Text style={styles.headerTitle}>{t("appicon.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scroll}>
          <SelectableCardList<AppIconId> items={items} selectedId={current} onSelect={selectIcon} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
  },
  scroll: {
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
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
  headerSpacer: {
    width: 42,
  },
  preview: {
    width: 48,
    height: 48,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
});
