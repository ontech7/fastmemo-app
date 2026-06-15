import { ReactNode } from "react";
import { Keyboard, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { CheckCircleIcon } from "react-native-heroicons/outline";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

/** Shared chrome for the vault flow screens (set/unlock/recover/change/reset). */
export function VaultScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} ellipsizeMode="tail">
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bottomOffset={PADDING_MARGIN.xl}
      >
        {children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

export function VaultDescription({ children }: { children: ReactNode }) {
  return <Text style={styles.description}>{children}</Text>;
}

export function VaultLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function VaultInput(props: TextInputProps) {
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        cursorColor={COLOR.textPrimary}
        placeholderTextColor={COLOR.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

export function VaultError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

/** Reassurance card: a short bulleted list explaining what end-to-end encryption means. */
export function VaultInfoCard({ points }: { points: string[] }) {
  return (
    <View style={styles.infoCard}>
      {points.map((point, i) => (
        <View key={i} style={[styles.infoRow, i === points.length - 1 && styles.infoRowLast]}>
          <CheckCircleIcon size={18} color={COLOR.accentSoft} />
          <Text style={styles.infoText}>{point}</Text>
        </View>
      ))}
    </View>
  );
}

export function VaultButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      // Dismiss the keyboard first: otherwise the full-screen loader is centered
      // behind the open keyboard and the user sees no feedback while we work.
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      style={[styles.button, danger && styles.buttonDanger, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function VaultLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", flex: 1, paddingTop: PADDING_MARGIN.xs },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: PADDING_MARGIN.sm,
    textAlign: "center",
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40 },
  scroll: { paddingHorizontal: PADDING_MARGIN.lg },
  scrollContent: { paddingBottom: PADDING_MARGIN.xl },
  description: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    lineHeight: 22,
    marginBottom: PADDING_MARGIN.lg,
  },
  label: {
    color: COLOR.textSecondary,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
    marginBottom: PADDING_MARGIN.xs,
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    alignItems: "center",
    marginBottom: PADDING_MARGIN.lg,
  },
  input: {
    flex: 1,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md,
    fontSize: FONTSIZE.medium,
  },
  error: {
    color: COLOR.darkImportant,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
    marginTop: -PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  infoCard: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    padding: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.md,
  },
  infoRowLast: { marginBottom: 0 },
  infoText: {
    flex: 1,
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: PADDING_MARGIN.md + 2,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accentMuted,
    marginTop: PADDING_MARGIN.sm,
    ...SHADOW.fab,
  },
  buttonDanger: { backgroundColor: COLOR.darkImportant },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: COLOR.softWhite, fontFamily: FONT.semiBold, fontSize: FONTSIZE.paragraph },
  link: { alignItems: "center", paddingVertical: PADDING_MARGIN.md },
  linkText: { color: COLOR.accentSoft, fontFamily: FONT.medium, fontSize: FONTSIZE.paragraph },
});
