import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, TouchableOpacity } from "react-native";
import { ListBulletIcon } from "react-native-heroicons/outline";

import { useRouter } from "@/hooks/useRouter";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function AddNoteTextButton({ isDeleteMode, toggleDeleteMode, style = {} }) {
  const router = useRouter();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scaleInterpolation = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const scaleEventButton = () => {
    Animated.timing(scaleAnim, {
      toValue: isDeleteMode ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    scaleEventButton();
  }, [isDeleteMode]);

  return (
    <Animated.View style={{ transform: [{ scaleX: scaleInterpolation }] }}>
      <TouchableOpacity
        style={[styles.addBtn, style]}
        activeOpacity={0.7}
        onPress={() => {
          if (!isDeleteMode) {
            router.push("/notes/new-todo");
          } else {
            toggleDeleteMode();
          }
        }}
      >
        <ListBulletIcon size={24} color={COLOR.darkBlue} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  addBtn: {
    zIndex: 2,
    position: "absolute",
    bottom: 135,
    right: 29,
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
});
