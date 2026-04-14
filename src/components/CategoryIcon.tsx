import { CATEGORY_MAP } from "@/constants/icons";

interface Props {
  size?: number;
  name: string;
  color: string;
}

export default function CategoryIcon({ size = 28, name, color }: Props) {
  const { Icon } = CATEGORY_MAP[name];

  return <Icon size={size} color={color} />;
}
