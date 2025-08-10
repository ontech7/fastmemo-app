import React from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

import { selectorIsFingerprintEnabled, setIsFingerprintEnabled } from "../../../../slicers/settingsSlice";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_EnableFingerprint({ isLast }) {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const fingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const toggleFingerprint = async () => {
    const authResult = await LocalAuthentication.authenticateAsync();
    if (authResult?.success) {
      dispatch(setIsFingerprintEnabled(!fingerprintEnabled));
    }
  };

  return (
    <SectionItemList isLast={isLast}>
      <View style={styles.sectionItemList_button}>
        <Text style={styles.sectionItemList_title}>{t("generalsettings.enable_fingerprint")}</Text>

        <Switch
          trackColor={{
            false: COLOR.lightGray,
            true: COLOR.darkYellow + "60",
          }}
          thumbColor={fingerprintEnabled ? COLOR.yellow : COLOR.softWhite}
          onValueChange={toggleFingerprint}
          value={fingerprintEnabled}
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
