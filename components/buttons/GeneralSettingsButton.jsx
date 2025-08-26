import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Cog8ToothIcon } from "react-native-heroicons/outline";

import { useRouter } from "@/hooks/useRouter";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function GeneralSettingsButton() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.button}
        onPress={() => {
          router.push("/settings/general");
        }}
      >
        <Cog8ToothIcon size={28} color={COLOR.softWhite} />
      </TouchableOpacity>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING_MARGIN.md,
    paddingBottom: PADDING_MARGIN.xl,
  },
  button: { padding: PADDING_MARGIN.sm },
});
