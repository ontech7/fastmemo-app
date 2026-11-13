import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-redo` (redraws.html, section 2). */
export default function RedoIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M15 14.5l4.5-4.5L15 5.5M19.5 10H10a5 5 0 000 10h3" />
    </FormatSvg>
  );
}
