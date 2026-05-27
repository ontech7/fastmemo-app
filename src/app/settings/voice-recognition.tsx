import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { supportedLanguages } from "@/libs/i18n";
import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { selectorVoiceRecognition, setVoiceRecognition } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

export default function VoiceRecognitionScreen() {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const allValues = useSelector(selectorVoiceRecognition);

  const setValue = async (key: string, value: boolean | string) => {
    dispatch(
      setVoiceRecognition({
        ...allValues,
        [key]: value,
      })
    );
  };

  const languageName =
    allValues.language !== "system"
      ? supportedLanguages[allValues.language.split("-")[0]].name
      : t("voicerecognition.language_default");

  const changeLanguage = () => {
    let nextLanguage = allValues.language;

    switch (allValues.language) {
      case "system":
        nextLanguage = "en-US";
        break;
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
        nextLanguage = "system";
        break;
      default:
        nextLanguage = "system";
        break;
    }

    setValue("language", nextLanguage);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />

        <Text style={styles.headerTitle}>{t("voicerecognition.title")}</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionList}>
            <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
              <Text style={styles.sectionItemList_title}>{t("voicerecognition.enabled")}</Text>

              <Switch
                trackColor={{
                  false: COLOR.surfaceMuted,
                  true: COLOR.accentMuted,
                }}
                thumbColor={COLOR.softWhite}
                onValueChange={(value: boolean) => setValue("enabled", value)}
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
                  false: COLOR.surfaceMuted,
                  true: COLOR.accentMuted,
                }}
                thumbColor={COLOR.softWhite}
                onValueChange={(value: boolean) => setValue("interimResults", value)}
                value={allValues.interimResults}
                style={{ height: 25 }}
              />
            </View>

            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>{t("voicerecognition.continuous")}</Text>

              <Switch
                trackColor={{
                  false: COLOR.surfaceMuted,
                  true: COLOR.accentMuted,
                }}
                thumbColor={COLOR.softWhite}
                onValueChange={(value: boolean) => setValue("continuous", value)}
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

              <Text style={styles.sectionItemList_text}>{languageName}</Text>
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
  sectionWrapper: {
    marginTop: PADDING_MARGIN.lg,
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
