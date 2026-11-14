import { Path } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's highlight: a marker's tip over the line it draws. */
export default function HighlightIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Path d="M14.5 4.5l5 5-7.5 7.5H7v-5z" />
      <Path d="M12 7l5 5" />
      <Path d="M4 20.5h16" />
    </FormatSvg>
  );
}
