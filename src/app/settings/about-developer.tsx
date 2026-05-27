import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { openUrl } from "@/utils/openUrl";
import { ArrowTopRightOnSquareIcon } from "react-native-heroicons/outline";
import authorImage from "@/assets/images/author.png";

const DEVELOPER_NAME = "Andrea Losavio";
const LINKEDIN_URL = "https://www.linkedin.com/in/andrea-losavio/";
const GITHUB_URL = "https://github.com/ontech7";
const WEBSITE_URL = "https://www.andrealosavio.com";

export default function AboutDeveloperScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />

        <Text style={styles.headerTitle}>{t("aboutdeveloper.title")} 🚀</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.appWrapper}>
          <Image style={styles.appIcon} source={authorImage} />

          <Text style={styles.appName}>{t("aboutdeveloper.freelance")}</Text>
        </View>

        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{t("aboutdeveloper.information")}</Text>
          </View>

          <View style={styles.sectionList}>
            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>{t("aboutdeveloper.developer")}</Text>

              <Text style={styles.sectionItemList_text}>{DEVELOPER_NAME}</Text>
            </View>

            <View style={styles.sectionItemList}>
              <TouchableOpacity activeOpacity={0.7} style={styles.link_button} onPress={() => openUrl(WEBSITE_URL)}>
                <Text style={styles.sectionItemList_title}>{t("aboutdeveloper.website")}</Text>

                <View style={styles.sectionItemList_textWrapper}>
                  <Text style={styles.sectionItemList_text} numberOfLines={1}>
                    Go to website
                  </Text>
                  <ArrowTopRightOnSquareIcon color={COLOR.textSecondary} size={18} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionItemList}>
              <TouchableOpacity activeOpacity={0.7} style={styles.link_button} onPress={() => openUrl(LINKEDIN_URL)}>
                <Text style={styles.sectionItemList_title}>LinkedIn</Text>

                <View style={styles.sectionItemList_textWrapper}>
                  <Text style={styles.sectionItemList_text} numberOfLines={1}>
                    Go to website
                  </Text>
                  <ArrowTopRightOnSquareIcon color={COLOR.textSecondary} size={18} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
              <TouchableOpacity activeOpacity={0.7} style={styles.link_button} onPress={() => openUrl(GITHUB_URL)}>
                <Text style={styles.sectionItemList_title}>GitHub</Text>

                <View style={styles.sectionItemList_textWrapper}>
                  <Text style={styles.sectionItemList_text} numberOfLines={1}>
                    Go to website
                  </Text>
                  <ArrowTopRightOnSquareIcon color={COLOR.textSecondary} size={18} />
                </View>
              </TouchableOpacity>
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
    width: 180,
    height: 220,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.big,
  },
  appName: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    marginTop: PADDING_MARGIN.md,
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
  sectionItemList_textWrapper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sectionItemList_text: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    maxWidth: 200,
  },
  link_button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: SIZE.full,
  },
});
