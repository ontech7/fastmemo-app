import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import SafeAreaView from "@/components/SafeAreaView";
import { selectorVoiceRecognition, setVoiceRecognition } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import BackButton from "../../components/buttons/BackButton";

export default function VoiceRecognitionScreen() {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const allValues = useSelector(selectorVoiceRecognition);

  const { t: lang } = useTranslation(undefined, { lng: allValues.language });

  const setValue = async (key, value) => {
    dispatch(
      setVoiceRecognition({
        ...allValues,
        [key]: value,
      })
    );
  };

  const changeLanguage = () => {
    let nextLanguage = allValues.language;

    switch (allValues.language) {
      case "en-US":
        nextLanguage = "it-IT";
        break;
      case "it-IT":
        nextLanguage = "de-DE";
        break;
      case "de-DE":
        nextLanguage = "es-ES";
        break;
      case "es-ES":
        nextLanguage = "fr-FR";
        break;
      case "fr-FR":
        nextLanguage = "zh-CH";
        break;
      case "zh-CH":
        nextLanguage = "ja-JP";
        break;
      case "ja-JP":
        nextLanguage = "en-US";
        break;
      default:
        nextLanguage = "en-US";
        break;
    }

    setValue("language", nextLanguage);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("voicerecognition.title")}</Text>

        <View style={{ padding: PADDING_MARGIN.md }}></View>
      </View>

      <ScrollView>
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionList}>
            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>{t("voicerecognition.enabled")}</Text>

              <Switch
                trackColor={{
                  false: COLOR.lightGray,
                  true: COLOR.darkYellow + "60",
                }}
                thumbColor={allValues.enabled ? COLOR.yellow : COLOR.softWhite}
                onValueChange={(value) => setValue("enabled", value)}
                value={allValues.enabled}
                style={{ height: 25 }}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <View style={styles.sectionList}>
            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>{t("voicerecognition.interimResults")}</Text>

              <Switch
                trackColor={{
                  false: COLOR.lightGray,
                  true: COLOR.darkYellow + "60",
                }}
                thumbColor={allValues.interimResults ? COLOR.yellow : COLOR.softWhite}
                onValueChange={(value) => setValue("interimResults", value)}
                value={allValues.interimResults}
                style={{ height: 25 }}
              />
            </View>

            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>{t("voicerecognition.continuous")}</Text>

              <Switch
                trackColor={{
                  false: COLOR.lightGray,
                  true: COLOR.darkYellow + "60",
                }}
                thumbColor={allValues.continuous ? COLOR.yellow : COLOR.softWhite}
                onValueChange={(value) => setValue("continuous", value)}
                value={allValues.continuous}
                style={{ height: 25 }}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.sectionItemList, styles.sectionItemList_last]}
              onPress={changeLanguage}
            >
              <Text style={styles.sectionItemList_title}>{t("voicerecognition.language")}</Text>

              <Text style={styles.sectionItemList_text}>{lang("languageName")}</Text>
            </TouchableOpacity>
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
    borderBottomWidth: 1.5,
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
