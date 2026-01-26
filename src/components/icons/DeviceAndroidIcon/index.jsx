import React from "react";
import { Image, View } from "react-native";
import { DevicePhoneMobileIcon } from "react-native-heroicons/outline";

import androidImage from "./android.png";

export default function DeviceAndroidIcon({ size, color }) {
  return (
    <View style={{ position: "relative", width: size, height: size }}>
      <Image
        style={{
          position: "absolute",
          zIndex: 2,
          left: size / 3.2,
          top: size / 3.2 - size / 24,
          width: size - size / 1.6,
          height: size - size / 1.6,
        }}
        source={androidImage}
      />

      <DevicePhoneMobileIcon size={size} color={color} />
    </View>
  );
}
