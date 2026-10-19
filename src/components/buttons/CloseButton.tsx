import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import XMarkIcon from "react-native-heroicons/outline/XMarkIcon";

import IconChip from "@/components/ui/IconChip";
import { useRouter } from "@/hooks/useRouter";

import { COLOR } from "@/constants/styles";

import type { ViewStyle } from "react-native";

interface Props {
  callback?: (() => void) | null;
  style?: ViewStyle;
  /** Wrap the X in a glass chip (modernized header style). */
  chip?: boolean;
}

export default function CloseButton({ callback = null, style = {}, chip = false }: Props) {
  const { t } = useTranslation();

  const router = useRouter();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("a11y.close")}
      style={style}
      activeOpacity={0.7}
      onPress={() => {
        if (callback) callback();
        router.back();
      }}
    >
      {chip ? (
        <IconChip>
          <XMarkIcon size={20} color={COLOR.softWhite} />
        </IconChip>
      ) : (
        <XMarkIcon size={28} color={COLOR.softWhite} />
      )}
    </TouchableOpacity>
  );
}
