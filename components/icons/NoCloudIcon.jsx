import React from "react";
import { View } from "react-native";
import CloudIcon from "react-native-heroicons/outline/CloudIcon";

export default function NoCloudIcon({ size, color }) {
  return (
    <View style={{ position: "relative", width: size, height: size }}>
      <View
        style={{
          zIndex: 2,
          position: "absolute",
          left: 14,
          top: 0,
          transform: [{ rotate: "45deg" }],
          width: 2,
          height: "110%",
          backgroundColor: color,
        }}
      />

      <CloudIcon size={size} color={color} />
    </View>
  );
}
