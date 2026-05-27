import { StyleSheet, View } from "react-native";
import { useSelector } from "react-redux";

import { BORDER, GLASS, PADDING_MARGIN } from "@/constants/styles";

import { getCategories } from "@/slicers/categoriesSlice";
import GeneralSettingsButton from "./buttons/GeneralSettingsButton";
import ReorganizeButton from "./buttons/ReorganizeButton";
import TemporaryTrashButton from "./buttons/TemporaryTrashButton";
import UpdateAppButton from "./buttons/UpdateAppButton";
import FavoriteCategoryList from "./lists/FavoriteCategoryList";
import GlassSurface from "./ui/GlassSurface";

export default function Sidebar() {
  const categories = useSelector(getCategories);

  return (
    <View style={styles.container}>
      <GlassSurface style={StyleSheet.absoluteFill} radius={BORDER.big} bordered={false} fill={GLASS.navyFill} />
      <View style={styles.sideBar}>
        <View style={styles.header}>
          <ReorganizeButton />
        </View>

        <View style={styles.divider} />

        <View style={styles.body}>
          <FavoriteCategoryList categories={categories} />
        </View>

        <UpdateAppButton />

        <View style={styles.divider} />

        <View style={styles.footer}>
          <TemporaryTrashButton />
          <GeneralSettingsButton />
        </View>
      </View>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    marginVertical: PADDING_MARGIN.md,
    marginRight: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  sideBar: {
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm,
  },
  header: {
    alignItems: "center",
  },
  body: {
    flex: 1,
  },
  footer: {
    alignItems: "center",
    gap: PADDING_MARGIN.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: PADDING_MARGIN.sm,
    marginHorizontal: PADDING_MARGIN.md,
    backgroundColor: GLASS.border,
  },
});
