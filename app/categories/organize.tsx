import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";

import SafeAreaView from "@/components/SafeAreaView";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN, SIZE } from "@/constants/styles";

import AddCategoryButton from "@/components/buttons/AddCategoryButton";
import BackButton from "@/components/buttons/BackButton";
import OrganizeCategoryList from "@/components/lists/OrganizeCategoryList";
import AppBackground from "@/components/ui/AppBackground";
import { getCategories } from "@/slicers/categoriesSlice";

/*
 * The categories' page: a tap opens a category's edit page, a drag on its handle moves it, saved at once (ADR-038).
 */
export default function OrganizeCategoriesScreen() {
  const { t } = useTranslation();
  const categories = useSelector(getCategories);

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip shortcut />
        <Text style={styles.headerTitle}>{t("organizecategory.title")}</Text>
        {/* The back button's width: the title stays centered. */}
        <View style={styles.headerSpacer} />
      </View>

      <OrganizeCategoryList categories={categories} />

      <AddCategoryButton />
    </SafeAreaView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING_MARGIN.lg,
    height: SIZE.full,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xl,
    width: SIZE.full,
  },
  headerSpacer: {
    width: 42,
  },
  headerTitle: {
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
    flexGrow: 1,
    textAlign: "center",
  },
});
