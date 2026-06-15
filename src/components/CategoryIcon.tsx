import { Fragment } from "react";

import { CATEGORY_MAP } from "@/constants/icons";

interface Props {
  size?: number;
  name: string;
  color: string;
}

export default function CategoryIcon({ size = 28, name, color }: Props) {
  const entry = CATEGORY_MAP[name];

  // "none" (the index "All" category) maps to Fragment, which rejects size/color.
  if (!entry || entry.Icon === Fragment) return null;

  return <entry.Icon size={size} color={color} />;
}
