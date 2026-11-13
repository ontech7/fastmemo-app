import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-code` (redraws.html, section 2). */
export default function CodeBlockIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14" />
    </FormatSvg>
  );
}
