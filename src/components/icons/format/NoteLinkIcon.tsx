import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-nlink` (redraws.html, section 2). */
export default function NoteLinkIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M12.5 4H6.5v16h11v-6.5M12 12l7.5-7.5M14.5 4.5h5v5" />
    </FormatSvg>
  );
}
