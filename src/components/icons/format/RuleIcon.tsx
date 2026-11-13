import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-rule` (redraws.html, section 2). */
export default function RuleIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M3.5 12h17" />
      <Path d="M7 7h10M7 17h10" opacity={0.4} />
    </FormatSvg>
  );
}
