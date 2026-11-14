import { Path, Rect } from "react-native-svg";

import FormatSvg from "./FormatSvg";

interface Props {
  size?: number;
  color?: string;
}

/** The formatting bar's inline code: the code block's brackets, small, in a box of text. */
export default function InlineCodeIcon({ size, color }: Props) {
  return (
    <FormatSvg size={size} color={color}>
      <Rect x={2.8} y={6.5} width={18.4} height={11} rx={3} />
      <Path d="M9.8 9.6L7.4 12l2.4 2.4M14.2 9.6l2.4 2.4-2.4 2.4" />
    </FormatSvg>
  );
}
