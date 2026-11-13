import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `ul` (redraws.html, section 2). */
export default function BulletListIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
    </FormatSvg>
  );
}
