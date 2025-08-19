import React, { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Animated, Easing, StyleSheet, TouchableOpacity } from "react-native";
import { PlusIcon } from "react-native-heroicons/outline";

import { storeNote } from "@/libs/registry";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function AddNoteButton({ isDeleteMode, toggleDeleteMode, style = {} }) {
  const router = useRouter();

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const rotateEventButton = () => {
    Animated.timing(rotateAnim, {
      toValue: isDeleteMode ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    rotateEventButton();
  }, [isDeleteMode]);

  return (
    <TouchableOpacity
      style={[styles.addBtn, style]}
      activeOpacity={0.7}
      onPress={() => {
        if (!isDeleteMode) {
          storeNote({});
          router.push("/notes/text");
        } else {
          toggleDeleteMode();
        }
      }}
    >
      <Animated.View style={{ transform: [{ rotate: rotateInterpolation }] }}>
        <PlusIcon size={28} color={COLOR.darkBlue} />
      </Animated.View>
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  addBtn: {
    zIndex: 2,
    position: "absolute",
    bottom: 40,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
});
