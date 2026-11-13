import type { ReactNode } from "react";
import Svg from "react-native-svg";

import { COLOR } from "@/constants/styles";

interface Props {
  size?: number;
  color?: string;
  children: ReactNode;
}

/** The drawing all the formatting bar's icons share: a 24 box, a line of 1.6 with round ends and joins, no fill. */
export default function FormatSvg({ size = 24, color = COLOR.textPrimary, children }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}
