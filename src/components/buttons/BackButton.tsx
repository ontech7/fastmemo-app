import type { ViewStyle } from "react-native";
import { Keyboard, TouchableOpacity } from "react-native";
import { ChevronLeftIcon } from "react-native-heroicons/outline";

import IconChip from "@/components/ui/IconChip";
import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";

interface Props {
  callback?: (() => void) | null;
  style?: ViewStyle;
  /** Wrap the chevron in a glass chip (modernized header style). */
  chip?: boolean;
}

export default function BackButton({ callback = null, style = {}, chip = false }: Props) {
  const router = useRouter();

  const onPress = () => {
    if (callback) callback();
    Keyboard.dismiss();
    router.back();
  };

  return (
    <TouchableOpacity style={style} activeOpacity={0.7} onPress={onPress}>
      {chip ? (
        <IconChip>
          <ChevronLeftIcon size={20} color={COLOR.softWhite} />
        </IconChip>
      ) : (
        <ChevronLeftIcon size={28} color={COLOR.softWhite} />
      )}
    </TouchableOpacity>
  );
}
