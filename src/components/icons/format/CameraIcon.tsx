import { Circle, Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-cam` (redraws.html, section 2). */
export default function CameraIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M4 8.5h3L8.5 6h7L17 8.5h3V19H4z" />
      <Circle cx={12} cy={13.5} r={3.2} />
    </FormatSvg>
  );
}
