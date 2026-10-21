import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ArrowDownTrayIcon from "react-native-heroicons/outline/ArrowDownTrayIcon";
import ArrowPathIcon from "react-native-heroicons/outline/ArrowPathIcon";
import ArrowsPointingOutIcon from "react-native-heroicons/outline/ArrowsPointingOutIcon";
import Bars3BottomLeftIcon from "react-native-heroicons/outline/Bars3BottomLeftIcon";
import Bars3BottomRightIcon from "react-native-heroicons/outline/Bars3BottomRightIcon";
import Bars3Icon from "react-native-heroicons/outline/Bars3Icon";
import ShareIcon from "react-native-heroicons/outline/ShareIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";

import ImageViewer from "@/components/ui/ImageViewer";
import PopupMenu, { PopupMenuDivider, PopupMenuLabel, PopupMenuOption, usePopupMenu } from "@/components/ui/PopupMenu";
import { BORDER, COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";
import type { EditorImage, ImageChange } from "@/libs/richTextEditor";
import { isImageDataUrl } from "@/utils/dataUrl";
import { exportImage } from "@/utils/export";
import { toast } from "@/utils/toast";

interface Props {
  /** The image tapped in the editor, and where on screen; null when the menu is closed. */
  image: EditorImage | null;
  at: { x: number; y: number } | null;
  onChange: (image: EditorImage, change: ImageChange, value?: string) => void;
  onClose: () => void;
}

interface Choice {
  value: string;
  label: string;
  /** Shown instead of the label. */
  icon?: ReactNode;
  text?: string;
}

const ICON = { size: 18, color: COLOR.softWhite };

/** The line's CSS text-align as the menu's choices. */
const alignOf = (align: string) => (/center/.test(align) ? "center" : /right|end/.test(align) ? "right" : "left");

interface ChoiceRowProps {
  choices: Choice[];
  selected: string;
  onSelect: (value: string) => void;
}

/** A row of choices, the current one marked, that closes the menu once one is picked. */
function ChoiceRow({ choices, selected, onSelect }: ChoiceRowProps) {
  const { close } = usePopupMenu();
  return (
    <View style={styles.row}>
      {choices.map((choice) => {
        const checked = choice.value === selected;
        return (
          <Pressable
            key={choice.value}
            accessibilityRole="radio"
            accessibilityLabel={choice.label}
            aria-checked={checked}
            onPress={() => {
              onSelect(choice.value);
              close();
            }}
            style={({ pressed }) => [styles.choice, checked && styles.choiceSelected, pressed && styles.choicePressed]}
          >
            {choice.icon ?? <Text style={[styles.choiceText, checked && styles.choiceTextSelected]}>{choice.text}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * What can be done to an image of a text note, opened by tapping it: its width in the note, its line's alignment, a
 * quarter turn, the full screen viewer, share (phone) or save (web, desktop), delete. A read-only note's image can only be
 * looked at and shared.
 */
export default function NoteImageMenu({ image, at, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<EditorImage | null>(null);
  // The viewer opens once the menu has closed: two modals at once don't go well on Android.
  const viewNext = useRef<EditorImage | null>(null);

  const share = async (src: string) => {
    try {
      await exportImage(src);
    } catch {
      toast(t("note.image.failed"));
    }
  };
  const shareLabel = Platform.OS === "web" ? t("note.image.save") : t("note.image.share");
  const ShareActionIcon = Platform.OS === "web" ? ArrowDownTrayIcon : ShareIcon;

  const sizes: Choice[] = [
    { value: "25%", text: t("note.image.size_s"), label: t("a11y.image.small") },
    { value: "50%", text: t("note.image.size_m"), label: t("a11y.image.medium") },
    { value: "75%", text: t("note.image.size_l"), label: t("a11y.image.large") },
    { value: "100%", text: t("note.image.size_full"), label: t("a11y.image.full") },
  ];
  const aligns: Choice[] = [
    { value: "left", icon: <Bars3BottomLeftIcon {...ICON} />, label: t("a11y.image.align_left") },
    { value: "center", icon: <Bars3Icon {...ICON} />, label: t("a11y.image.align_center") },
    { value: "right", icon: <Bars3BottomRightIcon {...ICON} />, label: t("a11y.image.align_right") },
  ];

  const closed = () => {
    onClose();
    if (viewNext.current) setViewing(viewNext.current);
    viewNext.current = null;
  };

  return (
    <>
      <PopupMenu at={image && at} onClose={closed}>
        {image?.editable && (
          <>
            <PopupMenuLabel>{t("note.image.size")}</PopupMenuLabel>
            <ChoiceRow choices={sizes} selected={image.size} onSelect={(value) => onChange(image, "size", value)} />
            {image.alignable && (
              <>
                <PopupMenuLabel>{t("note.image.align")}</PopupMenuLabel>
                <ChoiceRow
                  choices={aligns}
                  selected={alignOf(image.align)}
                  onSelect={(value) => onChange(image, "align", value)}
                />
              </>
            )}
            <PopupMenuDivider />
          </>
        )}
        {image && (
          <PopupMenuOption
            label={t("note.image.view")}
            trailing={<ArrowsPointingOutIcon size={16} color={COLOR.textSecondary} />}
            onSelect={() => (viewNext.current = image)}
          />
        )}
        {image?.editable && image.rotatable && (
          <PopupMenuOption
            label={t("note.image.rotate")}
            trailing={<ArrowPathIcon size={16} color={COLOR.textSecondary} />}
            onSelect={() => onChange(image, "rotate")}
          />
        )}
        {image && isImageDataUrl(image.src) && (
          <PopupMenuOption
            label={shareLabel}
            trailing={<ShareActionIcon size={16} color={COLOR.textSecondary} />}
            onSelect={() => share(image.src)}
          />
        )}
        {image?.editable && (
          <PopupMenuOption
            label={t("note.image.delete")}
            trailing={<TrashIcon size={16} color={COLOR.textSecondary} />}
            onSelect={() => onChange(image, "delete")}
          />
        )}
      </PopupMenu>

      {viewing && (
        <ImageViewer
          src={viewing.src}
          width={viewing.width}
          height={viewing.height}
          onClose={() => setViewing(null)}
          action={
            isImageDataUrl(viewing.src)
              ? {
                  icon: <ShareActionIcon size={20} color={COLOR.softWhite} />,
                  label: shareLabel,
                  onPress: () => share(viewing.src),
                }
              : undefined
          }
        />
      )}
    </>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingBottom: PADDING_MARGIN.xs,
  },
  choice: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: "transparent",
  },
  choiceSelected: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
  choicePressed: {
    opacity: 0.7,
  },
  choiceText: {
    color: COLOR.textPrimary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
  },
  choiceTextSelected: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
  },
});
