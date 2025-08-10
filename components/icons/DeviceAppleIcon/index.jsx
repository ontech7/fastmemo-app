import React from "react";
import { Image, View } from "react-native";
import { DevicePhoneMobileIcon } from "react-native-heroicons/outline";

import appleImage from "./apple.png";

export default function DeviceAppleIcon({ size, color }) {
  return (
    <View style={{ position: "relative", width: size, height: size }}>
      <Image
        style={{
          position: "absolute",
          zIndex: 2,
          left: size / 4,
          top: size / 4 - size / 16,
          width: size - size / 2,
          height: size - size / 2,
        }}
        source={appleImage}
      />

      <DevicePhoneMobileIcon size={size} color={color} />
    </View>
  );
}
