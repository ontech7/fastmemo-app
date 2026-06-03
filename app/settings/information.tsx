import BackButton from "@/components/buttons/BackButton";
import LottieView from "@/components/lottie/LottieAnimation";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { selectorDeveloperMode, setDeveloperMode } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import pkg from "@/../package.json";
import lottieJson from "@/assets/lottie/Logo.json";

// Library versions are read straight from package.json so they never need to be
// updated by hand. We strip the semver range prefix (^, ~, >=, …) for display.
const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
const version = (name: string) => (deps[name] ?? "").replace(/^[\^~>=<\s]+/, "").trim();

const REACT_VER = version("react");
const REACT_NATIVE_VER = version("react-native");
const FIREBASE_VER = version("firebase");
const EXPO_SDK_VER = version("expo");
const HEROICONS_VER = version("react-native-heroicons");
const TAURI_VER = version("@tauri-apps/cli");
const LLAMA_RN_VER = version("llama.rn");
const CODEMIRROR_VER = version("@codemirror/view");

const DEV_MODE_TAPS_REQUIRED = 7;
const DEV_MODE_COUNTDOWN_START = 4;

export default function InformationScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const developerMode = useSelector(selectorDeveloperMode);

  const currentAppVersion = Platform.OS === "web" ? configs.app.version.web : configs.app.version.mobile;

  const logoAnimRef = useRef<any>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = useCallback(() => {
    if (developerMode.enabled) {
      toast(t("developerModeAlready"));
      return;
    }

    tapCountRef.current += 1;

    // Reset tap count after 2 seconds of inactivity
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);

    const currentTaps = tapCountRef.current;

    if (currentTaps >= DEV_MODE_TAPS_REQUIRED) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      dispatch(setDeveloperMode({ ...developerMode, enabled: true }));
      toast(t("developerModeActivated"));
    } else if (currentTaps >= DEV_MODE_COUNTDOWN_START) {
      const remaining = DEV_MODE_TAPS_REQUIRED - currentTaps;
      toast(t("developerModeTaps", { remaining }));
    }
  }, [developerMode, dispatch, t]);

  useEffect(() => {
    setTimeout(() => {
      logoAnimRef.current?.play();
    }, 300);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />

        <Text style={styles.headerTitle}>{t("info.title")}</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.appWrapper}>
          <View style={styles.appIcon}>
            <LottieView ref={logoAnimRef} style={styles.lottieStyle} source={lottieJson} loop={false} />
          </View>

          <Text style={styles.appName}>{t("info.fastmemo")}</Text>
        </View>

        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{t("info.app")}</Text>
          </View>

          <View style={styles.sectionList}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.sectionItemList, styles.sectionItemList_last]}
              onPress={handleVersionTap}
            >
              <Text style={styles.sectionItemList_title}>{t("info.version")}</Text>

              <Text style={styles.sectionItemList_text}>{currentAppVersion}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{t("info.libraries")}</Text>
          </View>

          <View style={styles.sectionList}>
            {Platform.OS === "web" && (
              <View style={styles.sectionItemList}>
                <Text style={styles.sectionItemList_title}>Tauri</Text>

                <Text style={styles.sectionItemList_text}>{TAURI_VER}</Text>
              </View>
            )}

            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>React</Text>

              <Text style={styles.sectionItemList_text}>{REACT_VER}</Text>
            </View>

            {Platform.OS !== "web" && (
              <View style={styles.sectionItemList}>
                <Text style={styles.sectionItemList_title}>React Native</Text>

                <Text style={styles.sectionItemList_text}>{REACT_NATIVE_VER}</Text>
              </View>
            )}

            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>Google Firebase</Text>

              <Text style={styles.sectionItemList_text}>{FIREBASE_VER}</Text>
            </View>

            {Platform.OS !== "web" && (
              <View style={styles.sectionItemList}>
                <Text style={styles.sectionItemList_title}>Expo SDK</Text>

                <Text style={styles.sectionItemList_text}>{EXPO_SDK_VER}</Text>
              </View>
            )}

            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>CodeMirror</Text>

              <Text style={styles.sectionItemList_text}>{CODEMIRROR_VER}</Text>
            </View>

            {Platform.OS !== "web" && (
              <View style={styles.sectionItemList}>
                <Text style={styles.sectionItemList_title}>llama.rn</Text>

                <Text style={styles.sectionItemList_text}>{LLAMA_RN_VER}</Text>
              </View>
            )}

            <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
              <Text style={styles.sectionItemList_title}>Heroicons</Text>

              <Text style={styles.sectionItemList_text}>{HEROICONS_VER}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  appWrapper: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: PADDING_MARGIN.lg,
  },
  appIcon: {
    padding: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  appName: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    marginTop: PADDING_MARGIN.md,
  },
  lottieStyle: {
    width: 50,
    height: 50,
  },
  sectionWrapper: {
    marginTop: PADDING_MARGIN.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
  },
  sectionHeaderTitle: {
    color: COLOR.textSecondary,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.sm,
    fontFamily: FONT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLOR.surface,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1,
    borderColor: GLASS.border,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemList_title: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
});
