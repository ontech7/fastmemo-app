import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { Platform, StyleSheet } from "react-native";

export const MONOSPACE_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export const MAX_TABS = 5;
export const TAB_WIDTH_ESTIMATE = 110;

export const styles = StyleSheet.create({
  container: {
    height: SIZE.full,
    paddingVertical: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  titleInput: {
    textAlign: "center",
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
    borderRadius: BORDER.normal,
  },
  tabBarContainer: {
    marginTop: PADDING_MARGIN.lg,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  tabBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderTopLeftRadius: BORDER.small,
    borderTopRightRadius: BORDER.small,
    maxWidth: 160,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 2 },
  },
  tabActive: {
    backgroundColor: "#1e1e1e",
  },
  tabTitle: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.lightBlue,
    maxWidth: 100,
  },
  tabTitleActive: {
    color: COLOR.softWhite,
  },
  tabTitleInput: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    padding: 0,
    minWidth: 60,
  },
  tabDeleteButton: {
    marginLeft: PADDING_MARGIN.sm,
    padding: 2,
  },
  addTabButton: {
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderTopLeftRadius: BORDER.small,
    borderTopRightRadius: BORDER.small,
    justifyContent: "center",
    alignItems: "center",
  },
  languageBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.sm - 2,
    backgroundColor: "#1e1e1e",
    marginHorizontal: PADDING_MARGIN.lg,
    borderTopWidth: 1,
    borderTopColor: "#2d2d2d",
  },
  languageSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: "#2d2d2d",
    borderRadius: BORDER.small,
  },
  languageLabel: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.codeMint,
  },
  tabCounter: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.lightBlue,
  },
  editorContainer: {
    flex: 1,
    marginHorizontal: PADDING_MARGIN.lg,
    backgroundColor: "#282c34",
    borderBottomLeftRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
    overflow: "hidden",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxHeight: "60%",
    backgroundColor: COLOR.darkBlue,
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.blue,
  },
  modalTitle: {
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  modalList: {
    paddingVertical: PADDING_MARGIN.sm,
  },
  languageItem: {
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  languageItemSelected: {
    backgroundColor: COLOR.blue,
  },
  languageItemText: {
    fontSize: FONTSIZE.paragraph,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.lightBlue,
  },
  languageItemTextSelected: {
    color: COLOR.codeMint,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
