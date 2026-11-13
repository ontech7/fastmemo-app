import { Path, Rect } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-chk` (redraws.html, section 2). */
export default function CheckListIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Rect x={3.5} y={4.5} width={5.5} height={5.5} rx={1.4} />
      <Rect x={3.5} y={14} width={5.5} height={5.5} rx={1.4} />
      <Path d="M12.5 7.2h8M12.5 16.8h8M4.9 16.8l1 1 1.8-2.1" />
    </FormatSvg>
  );
}
