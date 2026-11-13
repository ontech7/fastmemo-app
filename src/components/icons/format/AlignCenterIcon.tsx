import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `alignc` (redraws.html, section 2). */
export default function AlignCenterIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10" />
    </FormatSvg>
  );
}
