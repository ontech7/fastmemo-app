import { CATEGORY_MAP } from "@/constants/icons";

export default function CategoryIcon({ size = 28, name, color }) {
  const { Icon } = CATEGORY_MAP[name];

  return <Icon size={size} color={color} />;
}
