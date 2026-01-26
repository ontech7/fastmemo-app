import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

import { useSecret } from "@/hooks/useSecret";
import { selectorShowHidden, setShowHidden } from "../../../../slicers/settingsSlice";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_ShowHidden({ isLast }) {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const { unlockWithSecret } = useSecret();

  const showHidden = useSelector(selectorShowHidden);
  const toggleShowHidden = () => dispatch(setShowHidden(!showHidden));

  const toggleShowHiddenWithSecret = () => {
    unlockWithSecret(toggleShowHidden);
  };

  return (
    <SectionItemList isLast={isLast}>
      <View style={styles.sectionItemList_button}>
        <Text style={styles.sectionItemList_title}>{t("generalsettings.show_hidden")}</Text>

        <Switch
          trackColor={{
            false: COLOR.lightGray,
            true: COLOR.darkYellow + "60",
          }}
          thumbColor={showHidden ? COLOR.yellow : COLOR.softWhite}
          onValueChange={toggleShowHiddenWithSecret}
          value={showHidden}
          style={{ height: 25 }}
        />
      </View>
    </SectionItemList>
  );
}

/* STYLES */

const styles = StyleSheet.create({
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
    paddingHorizontal: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
  },
});
