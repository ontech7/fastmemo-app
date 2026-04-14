import { View, ViewProps } from "react-native";
import { EllipsisVerticalIcon } from "react-native-heroicons/outline";

import type { SvgProps, NumberProp } from "react-native-svg";

interface Props {
  containerProps?: ViewProps;
  iconProps?: SvgProps & { size?: NumberProp };
  size?: number;
}

export default function DragIcon({ containerProps = {}, iconProps = {}, size = 24 }: Props) {
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
