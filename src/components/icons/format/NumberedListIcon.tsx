import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-ol` (redraws.html, section 2). */
export default function NumberedListIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M10.5 6.5h10M10.5 12h10M10.5 17.5h10M4.5 5.3l1.2-.8v4M4.3 11.2c.5-.9 2.2-.8 2.2.3 0 .8-1 1.3-2.2 2.5h2.3M4.3 16.3c.9-.6 2.2-.3 2.1.6-.1.6-.7.8-1.2.8.7 0 1.3.3 1.3.9 0 1-1.5 1.2-2.3.6" />
    </FormatSvg>
  );
}
