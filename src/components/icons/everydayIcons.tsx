import type { ReactNode } from "react";
import Svg, { Circle, Path } from "react-native-svg";

/*
 * Category icons for everyday topics that heroicons doesn't draw, drawn the heroicons outline way: a 24 grid, stroke 1.5,
 * round caps and joins, no fill. They take the same props as a heroicon (`size`, `color`), so `CATEGORY_MAP` holds them
 * beside the heroicons.
 */

interface Props {
  size?: number;
  color?: string;
}

const outline = (children: ReactNode) =>
  function EverydayIcon({ size = 24, color = "currentColor" }: Props) {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </Svg>
    );
  };

export const CoffeeIcon = outline(
  <>
    <Path d="M4.5 9.75h11.25v4.5a5.25 5.25 0 0 1-5.25 5.25h-.75a5.25 5.25 0 0 1-5.25-5.25v-4.5Z" />
    <Path d="M15.75 10.5h1.125a2.625 2.625 0 0 1 0 5.25H15.3" />
    <Path d="M7.875 3.75c-.75.75-.75 1.5 0 2.25s.75 1.5 0 2.25M11.625 3.75c-.75.75-.75 1.5 0 2.25s.75 1.5 0 2.25" />
    <Path d="M3.75 21h13.5" />
  </>
);

export const FoodIcon = outline(
  <>
    <Path d="M5.25 3v3.75a2.25 2.25 0 0 0 4.5 0V3M7.5 3v18" />
    <Path d="M17.25 12.75V3c-1.657 0-3 2.686-3 6v3.75h3Zm0 0V21" />
  </>
);

export const DumbbellIcon = outline(
  <>
    <Path d="M8.25 12h7.5" />
    <Path d="M5.25 8.25a1.5 1.5 0 0 1 3 0v7.5a1.5 1.5 0 0 1-3 0v-7.5ZM15.75 8.25a1.5 1.5 0 0 1 3 0v7.5a1.5 1.5 0 0 1-3 0v-7.5Z" />
    <Path d="M2.25 10.5v3M2.25 12h3M21.75 10.5v3M18.75 12h3" />
  </>
);

export const PillIcon = outline(
  <>
    <Path d="M10.902 18.402 18.402 10.902a3.75 3.75 0 0 0-5.304-5.304l-7.5 7.5a3.75 3.75 0 0 0 5.304 5.304Z" />
    <Path d="m9.348 9.348 5.304 5.304" />
  </>
);

export const PawIcon = outline(
  <>
    <Path d="M12 12c-2.5 0-5.25 3.1-5.25 5.25 0 1.6 1.2 2.25 2.6 2.25.95 0 1.65-.45 2.65-.45s1.7.45 2.65.45c1.4 0 2.6-.65 2.6-2.25C17.25 15.1 14.5 12 12 12Z" />
    <Circle cx={5.25} cy={10.5} r={1.5} />
    <Circle cx={9} cy={6} r={1.5} />
    <Circle cx={15} cy={6} r={1.5} />
    <Circle cx={18.75} cy={10.5} r={1.5} />
  </>
);

export const PlantIcon = outline(
  <>
    <Path d="M12 21v-9" />
    <Path d="M12 12c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6Z" />
    <Path d="M12 9.75c0-3.1 2.4-5.5 5.5-5.5 0 3.1-2.4 5.5-5.5 5.5Z" />
    <Path d="M7.5 21h9" />
  </>
);

export const CarIcon = outline(
  <>
    <Path d="M3.75 12.75h16.5v4.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-4.5Z" />
    <Path d="m5.25 12.75 1.3-4.33a1.5 1.5 0 0 1 1.436-1.07h8.028a1.5 1.5 0 0 1 1.436 1.07l1.3 4.33" />
    <Path d="M5.25 18.75v1.5a.75.75 0 0 0 .75.75h1.5a.75.75 0 0 0 .75-.75v-1.5M15.75 18.75v1.5a.75.75 0 0 0 .75.75h1.5a.75.75 0 0 0 .75-.75v-1.5" />
    <Circle cx={7.125} cy={15.75} r={0.75} />
    <Circle cx={16.875} cy={15.75} r={0.75} />
  </>
);

export const PlaneIcon = outline(
  <Path d="M21 15.75v-1.5l-7.5-4.5V4.5a1.5 1.5 0 0 0-3 0v5.25L3 14.25v1.5l7.5-2.25V18l-2.25 1.5V21L12 20.25l3.75.75v-1.5L13.5 18v-4.5l7.5 2.25Z" />
);

export const ShirtIcon = outline(
  <Path d="M8.25 3.75 3.75 6l-1.5 4.5 3 1.5 1.5-1.5v9.75h10.5V10.5l1.5 1.5 3-1.5-1.5-4.5-4.5-2.25C15.35 5.05 13.8 6 12 6s-3.35-.95-3.75-2.25Z" />
);

export const BikeIcon = outline(
  <>
    <Circle cx={6} cy={15.75} r={3.75} />
    <Circle cx={18} cy={15.75} r={3.75} />
    <Path d="M6 15.75h5.25L9 9.75l-3 6ZM9 9.75h6.75l-4.5 6M15.75 9.75 18 15.75" />
    <Path d="M7.875 8.25h2.25M9 8.25v1.5M15.75 9.75l-.375-2.25M14.625 7.5H16.5" />
  </>
);

export const BallIcon = outline(
  <>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 3v18M3 12h18" />
    <Path d="M5.636 5.636c2.4 3.4 2.4 9.328 0 12.728M18.364 5.636c-2.4 3.4-2.4 9.328 0 12.728" />
  </>
);

export const GamepadIcon = outline(
  <>
    <Path d="M7.5 7.5h9A4.5 4.5 0 0 1 21 12v1.5a3 3 0 0 1-5.12 2.12l-1.63-1.37h-4.5l-1.63 1.37A3 3 0 0 1 3 13.5V12a4.5 4.5 0 0 1 4.5-4.5Z" />
    <Path d="M7.5 9.75v3M6 11.25h3" />
    <Circle cx={15.375} cy={10.125} r={0.375} />
    <Circle cx={17.625} cy={12.375} r={0.375} />
  </>
);

export const BabyBottleIcon = outline(
  <>
    <Path d="M10.875 3.375a1.125 1.125 0 0 1 2.25 0V5.25h-2.25V3.375Z" />
    <Path d="M9 5.25h6V7.5H9V5.25Z" />
    <Path d="M9.75 7.5h4.5a2.25 2.25 0 0 1 2.25 2.25v9.75a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5V9.75A2.25 2.25 0 0 1 9.75 7.5Z" />
    <Path d="M10.5 12H12M10.5 15H12M10.5 18H12" />
  </>
);

export const WineIcon = outline(
  <>
    <Path d="M7.5 3h9c.25 1.5.75 3 .75 4.5a5.25 5.25 0 0 1-10.5 0c0-1.5.5-3 .75-4.5Z" />
    <Path d="M6.9 7.5h10.2M12 12.75V21M8.25 21h7.5" />
  </>
);

export const BeachIcon = outline(
  <>
    <Path d="M3 11.25a9 7.5 0 0 1 18 0 3 1.5 0 0 0-6 0 3 1.5 0 0 0-6 0 3 1.5 0 0 0-6 0Z" />
    <Path d="M12 11.25v9M3.75 20.25h16.5" />
  </>
);

export const ToothIcon = outline(
  <Path d="M7.5 3.75c-2.25 0-3.75 1.875-3.75 4.125 0 2.25.75 3.75 1.5 5.625.75 1.875.75 6.75 2.625 6.75 1.5 0 1.5-4.5 4.125-4.5s2.625 4.5 4.125 4.5c1.875 0 1.875-4.875 2.625-6.75.75-1.875 1.5-3.375 1.5-5.625 0-2.25-1.5-4.125-3.75-4.125-1.5 0-2.625.75-4.5.75s-3-.75-4.5-.75Z" />
);

export const MountainIcon = outline(
  <>
    <Path d="M2.25 19.5 8.625 7.5l3.75 6 2.625-3.375 6.75 9.375H2.25Z" />
    <Circle cx={18} cy={5.25} r={1.5} />
  </>
);

export const ReceiptIcon = outline(
  <>
    <Path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21V3Z" />
    <Path d="M9 7.5h6M9 10.5h6M9 13.5h3.75" />
  </>
);
