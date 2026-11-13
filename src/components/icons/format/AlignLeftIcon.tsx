import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `alignl` (redraws.html, section 2). */
export default function AlignLeftIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10" />
    </FormatSvg>
  );
}
