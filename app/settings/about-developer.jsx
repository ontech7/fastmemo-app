import React from "react";
import { useTranslation } from "react-i18next";
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowTopRightOnSquareIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";

import BackButton from "@/components/buttons/BackButton";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import authorImage from "../../assets/images/author.png";

const DEVELOPER_NAME = "Andrea Losavio";
const LINKEDIN_URL = "https://www.linkedin.com/in/andrea-losavio/";
const GITHUB_URL = "https://github.com/ontech7";
const WEBSITE_URL = "https://www.andrealosavio.com";

export default function AboutDeveloperScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("aboutdeveloper.title")} 🚀</Text>

        <View style={{ padding: PADDING_MARGIN.md }}></View>
      </View>

      <ScrollView>
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
              <TouchableOpacity activeOpacity={0.7} style={styles.link_button} onPress={() => Linking.openURL(WEBSITE_URL)}>
                <Text style={styles.sectionItemList_title}>{t("aboutdeveloper.website")}</Text>

                <View style={styles.sectionItemList_textWrapper}>
                  <Text style={styles.sectionItemList_text} numberOfLines={1}>
                    Go to website
                  </Text>
                  <ArrowTopRightOnSquareIcon color={COLOR.softWhite} size={18} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionItemList}>
              <TouchableOpacity activeOpacity={0.7} style={styles.link_button} onPress={() => Linking.openURL(LINKEDIN_URL)}>
                <Text style={styles.sectionItemList_title}>LinkedIn</Text>

                <View style={styles.sectionItemList_textWrapper}>
                  <Text style={styles.sectionItemList_text} numberOfLines={1}>
                    Go to website
                  </Text>
                  <ArrowTopRightOnSquareIcon color={COLOR.softWhite} size={18} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
              <TouchableOpacity activeOpacity={0.7} style={styles.link_button} onPress={() => Linking.openURL(GITHUB_URL)}>
                <Text style={styles.sectionItemList_title}>GitHub</Text>

                <View style={styles.sectionItemList_textWrapper}>
                  <Text style={styles.sectionItemList_text} numberOfLines={1}>
                    Go to website
                  </Text>
                  <ArrowTopRightOnSquareIcon color={COLOR.softWhite} size={18} />
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
    width: 180,
    height: 220,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.big,
  },
  appName: {
    color: COLOR.softWhite,
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
  sectionItemList_textWrapper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sectionItemList_text: {
    color: COLOR.lightBlue,
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
