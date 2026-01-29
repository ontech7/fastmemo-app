import { View } from "react-native";
import { EllipsisVerticalIcon } from "react-native-heroicons/outline";

export default function DragIcon({ containerProps = {}, iconProps = {}, size = 24 }) {
  return (
    <View
      {...containerProps}
      style={{
        position: "relative",
        flexDirection: "row",
        width: size,
        height: size,
      }}
    >
      <EllipsisVerticalIcon {...iconProps} style={{ position: "absolute", left: -4 }} />
      <EllipsisVerticalIcon {...iconProps} style={{ position: "absolute", right: -4 }} />
    </View>
  );
}
