import { useTranslation } from "react-i18next";
import type { ViewStyle } from "react-native";
import { Keyboard, TouchableOpacity } from "react-native";
import ChevronLeftIcon from "react-native-heroicons/outline/ChevronLeftIcon";

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
  const { t } = useTranslation();

  const router = useRouter();

  const onPress = () => {
    if (callback) callback();
    Keyboard.dismiss();
    router.back();
  };

  return (
    <TouchableOpacity
      style={style}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.back")}
    >
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
