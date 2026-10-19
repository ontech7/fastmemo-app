import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";

import IconChip from "@/components/ui/IconChip";
import { COLOR } from "@/constants/styles";

interface Props {
  onPressDelete: () => void;
  color?: string | null;
}

export default function DeleteNotesButton({ onPressDelete, color = null }: Props) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPressDelete} accessibilityRole="button" accessibilityLabel={t("delete")}>
      <IconChip>
        <TrashIcon size={20} color={color || COLOR.softWhite} />
      </IconChip>
    </TouchableOpacity>
  );
}
