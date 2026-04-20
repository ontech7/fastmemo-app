import SafeAreaView from "@/components/SafeAreaView";
import LottieView from "@/components/lottie/LottieAnimation";
import { configs } from "@/configs";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
import { selectorDeveloperMode, setDeveloperMode } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";
import React, { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import BackButton from "../../components/buttons/BackButton";

import lottieJson from "../../assets/lottie/Logo.json";

const REACT_VER = "19.0.0";
const REACT_NATIVE_VER = "0.79.5";
const FIREBASE_VER = "9.22.1";
const EXPO_SDK_VER = "53.0.20";
const HEROICONS_VER = "4.0.0";
const TAURI_VER = "1.6.3";
const LLAMA_RN_VER = "0.12.0-rc.8";

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
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("info.title")}</Text>

        <View style={{ padding: PADDING_MARGIN.md }}></View>
      </View>

      <ScrollView>
        <View style={styles.appWrapper}>
          <View style={{ ...styles.appIcon, padding: PADDING_MARGIN.md }}>
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
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
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
  appWrapper: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: PADDING_MARGIN.xl,
  },
  appIcon: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
  },
  appName: {
    color: COLOR.softWhite,
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
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.sm,
    fontWeight: FONTWEIGHT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
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
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.medium,
  },
});
