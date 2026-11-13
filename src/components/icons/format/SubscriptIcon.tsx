import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-sub` (redraws.html, section 2). */
export default function SubscriptIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M5 6.5l8 9M13 6.5l-8 9M16.5 16.5c.6-1.2 3.2-1.2 3.2.5 0 1.2-1.7 1.8-3.2 3.5H20" />
    </FormatSvg>
  );
}
