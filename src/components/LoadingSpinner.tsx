import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

interface Props {
  visible: boolean;
  color?: string | null;
  text?: string | null;
  /** Optional determinate progress; renders a bar + "done / total" under the label. */
  progress?: { done: number; total: number } | null;
}

/**
 * Full-window blocking loader: a dimmed scrim with a centered card holding the
 * spinner and an optional label.
 *
 * The scrim uses absolute fill (inset 0) rather than a measured Dimensions size,
 * so it always covers the whole parent and tracks window resizes — on web/Tauri
 * a fixed pixel size captured at load left a strip uncovered after a resize.
 *
 * When `progress` is provided (total > 0) it also shows a determinate bar — used
 * for the vault re-upload, whose duration scales with the number of notes.
 */
export default function LoadingSpinner({ visible, color = null, text = null, progress = null }: Props) {
  if (!visible) return null;

  const showBar = !!progress && progress.total > 0;
  const pct = showBar ? Math.round((progress!.done / progress!.total) * 100) : 0;

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={color || COLOR.accentSoft} />
        {text && <Text style={styles.text}>{text}</Text>}
        {showBar && (
          <View style={styles.progressWrap}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color || COLOR.accentSoft }]} />
            </View>
            <Text style={styles.count}>
              {progress!.done} / {progress!.total}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    backgroundColor: "rgba(5, 9, 26, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: PADDING_MARGIN.xl,
  },
  card: {
    minWidth: 180,
    maxWidth: 320,
    paddingVertical: PADDING_MARGIN.xl,
    paddingHorizontal: PADDING_MARGIN.xl,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    alignItems: "center",
    ...SHADOW.card,
  },
  text: {
    marginTop: PADDING_MARGIN.lg,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.medium,
    color: COLOR.textPrimary,
    textAlign: "center",
  },
  progressWrap: {
    marginTop: PADDING_MARGIN.lg,
    width: "100%",
    alignItems: "center",
  },
  track: {
    width: "100%",
    height: 6,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: BORDER.rounded,
  },
  count: {
    marginTop: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.small,
    fontFamily: FONT.medium,
    color: COLOR.textSecondary,
  },
});
