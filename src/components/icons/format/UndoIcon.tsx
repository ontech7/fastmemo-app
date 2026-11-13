import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-undo` (redraws.html, section 2). */
export default function UndoIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M9 14.5L4.5 10 9 5.5M4.5 10H14a5 5 0 010 10h-3" />
    </FormatSvg>
  );
}
