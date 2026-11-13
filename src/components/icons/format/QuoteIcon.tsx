import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-quote` (redraws.html, section 2). */
export default function QuoteIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M10 7.5c-3 .8-4.5 3-4.5 6v3H10V12H7.5c0-1.5 1-2.7 2.5-3.2zM18.5 7.5c-3 .8-4.5 3-4.5 6v3h4.5V12H16c0-1.5 1-2.7 2.5-3.2z" />
    </FormatSvg>
  );
}
