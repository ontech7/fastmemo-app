import React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { RectangleGroupIcon } from "react-native-heroicons/outline";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function ReorganizeButton() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.7}
        onPress={() => {
          router.push("/categories/organize");
        }}
      >
        <RectangleGroupIcon size={28} color={COLOR.softWhite} />
      </TouchableOpacity>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: { paddingHorizontal: PADDING_MARGIN.md },
  button: { padding: PADDING_MARGIN.sm },
});
