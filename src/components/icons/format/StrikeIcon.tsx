import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-strike` (redraws.html, section 2). */
export default function StrikeIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M4 12h16M16.5 8c-.4-1.8-2-3-4.5-3-2.7 0-4.3 1.4-4.3 3.2 0 1.5.9 2.3 2.3 2.8M7.3 15.5c.3 2 2 3.5 4.7 3.5 2.8 0 4.5-1.4 4.5-3.3 0-.6-.1-1.2-.5-1.7" />
    </FormatSvg>
  );
}
