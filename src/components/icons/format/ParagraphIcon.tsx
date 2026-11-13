import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's `i-par` (redraws.html, section 2). */
export default function ParagraphIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M5.5 7V5h13v2M12 5v14M9.5 19h5" />
    </FormatSvg>
  );
}
