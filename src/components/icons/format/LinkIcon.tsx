import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `linki` (redraws.html, section 2). */
export default function LinkIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M10.5 13.5a4 4 0 005.7 0l2.8-2.8a4 4 0 00-5.7-5.7l-1 1M13.5 10.5a4 4 0 00-5.7 0L5 13.3a4 4 0 005.7 5.7l1-1" />
    </FormatSvg>
  );
}
