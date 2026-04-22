import { TouchableOpacity } from "react-native";
import { DocumentMagnifyingGlassIcon } from "react-native-heroicons/outline";

import { COLOR } from "@/constants/styles";

interface Props {
  onPress: () => void;
  color?: string | null;
}

export default function DeepSearchButton({ onPress, color = null }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <DocumentMagnifyingGlassIcon color={color || COLOR.softWhite} />
    </TouchableOpacity>
  );
}
