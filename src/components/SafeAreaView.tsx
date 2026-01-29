import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ViewProps } from "react-native";

export interface SafeAreaViewProps extends ViewProps {}

export default function SafeAreaView({ children, ...props }: SafeAreaViewProps) {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View {...props}>
      <View style={{ height: top }} />
      {children}
      <View style={{ height: bottom }} />
    </View>
  );
}
