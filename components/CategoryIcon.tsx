import { CATEGORY_MAP } from "@/constants/icons";
import { COLOR } from "@/constants/styles";

import type { CategoryName } from "@/constants/icons";

interface CategoryIconProps {
  size: number;
  name: CategoryName;
  color?: string;
}

export function CategoryIcon({
  size = 28,
  name,
  color = COLOR.softWhite,
}: CategoryIconProps) {
  const { Icon } = CATEGORY_MAP[name];

  return <Icon size={size} color={color} />;
}
