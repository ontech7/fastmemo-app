import { useTranslation } from "react-i18next";
import type { ViewStyle } from "react-native";
import { Keyboard, TouchableOpacity } from "react-native";
import ChevronLeftIcon from "react-native-heroicons/outline/ChevronLeftIcon";

import IconChip from "@/components/ui/IconChip";
import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { useTourTarget } from "@/hooks/useTourTarget";

interface Props {
  callback?: (() => void) | null;
  style?: ViewStyle;
  /** Wrap the chevron in a glass chip (modernized header style). */
  chip?: boolean;
  /** Something the first-note tour can point at, under this name. */
  tourTarget?: string;
  /**
   * Esc presses it on desktop. Off where leaving would lose what's on screen (a one-time key, text being typed) or while
   * the screen is in a mode the back key should end first.
   */
  shortcut?: boolean;
}

export default function BackButton({ callback = null, style = {}, chip = false, tourTarget, shortcut = true }: Props) {
  const { t } = useTranslation();
  const targetRef = useTourTarget(tourTarget);

  const router = useRouter();

  const onPress = () => {
    if (callback) callback();
    Keyboard.dismiss();
    router.back();
  };

  return (
    <TouchableOpacity
      ref={targetRef}
      style={style}
      activeOpacity={0.7}
      onPress={onPress}
      testID={shortcut ? SHORTCUT_TARGET.back : undefined}
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
