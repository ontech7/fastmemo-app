import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ArchiveBoxXMarkIcon } from "react-native-heroicons/outline";

import { useRouter } from "@/hooks/useRouter";

import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function TemporaryTrashButton() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.7}
        onPress={() => {
          router.push("/temporary-trash");
        }}
      >
        <ArchiveBoxXMarkIcon size={28} color={COLOR.softWhite} />
      </TouchableOpacity>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.lg,
  },
  button: { padding: PADDING_MARGIN.sm },
});
