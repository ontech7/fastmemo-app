import { Path, Rect } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `image` (redraws.html, section 2). */
export default function ImageIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Rect x={3.5} y={5} width={17} height={14} rx={2.5} />
      <Path d="M3.5 16L8 11.5l4 4 2.5-2.5 6 5.5M15.5 9.5h.01" />
    </FormatSvg>
  );
}
