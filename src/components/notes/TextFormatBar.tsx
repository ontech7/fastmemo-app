import type { ReactNode, Ref } from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import ChevronDownIcon from "react-native-heroicons/outline/ChevronDownIcon";

import {
  AlignCenterIcon,
  AlignLeftIcon,
  BulletListIcon,
  CameraIcon,
  CheckListIcon,
  CodeBlockIcon,
  HighlightIcon,
  InlineCodeIcon,
  ImageIcon,
  LinkIcon,
  MoreIcon,
  NoteLinkIcon,
  NumberedListIcon,
  ParagraphIcon,
  PlusIcon,
  QuoteIcon,
  RedoIcon,
  RuleIcon,
  StrikeIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TickIcon,
  UndoIcon,
} from "@/components/icons/format";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import type { EditorState, FormatCommand, LineType } from "@/libs/richTextEditor";

export type InsertKind = "image" | "photo" | "link" | "noteLink" | "rule";

export interface TextFormatBarRef {
  closeMenu(): void;
}

interface Props {
  ref?: Ref<TextFormatBarRef>;
  state: EditorState;
  onLine: (type: LineType) => void;
  onFormat: (command: FormatCommand) => void;
  onInsert: (kind: InsertKind) => void;
  /** The phone: "Photo" is in the insert menu (Task 36 turns it on). */
  camera?: boolean;
  /** Web and desktop: docked under the text, centred, instead of riding on the keyboard. */
  docked?: boolean;
  /** Shown in place of the menus, above the bar (Task 14's picker). */
  above?: ReactNode;
}

type MenuName = "style" | "lists" | "insert" | "more";

interface Entry {
  key: string;
  label: string;
  icon: ReactNode;
  /** Undefined: an entry without a tick (an insert). */
  checked?: boolean;
  onPress: () => void;
}

/** The inserts the editor has wired (the photo also needs a camera). */
const WIRED_INSERTS: readonly InsertKind[] = ["image", "photo", "link", "noteLink", "rule"];

/** The bar's own height, menus never counted: the editor keeps this much room for it above the keyboard. */
export const TEXT_FORMAT_BAR_HEIGHT = 44 + 2 * PADDING_MARGIN.sm + 1;

const ICON = 20;
const MENU_WIDTH = 216;
const ROOMY_WIDTH = 600;
const BLOCK_LINES: readonly LineType[] = ["h1", "h2", "quote"];
const LIST_LINES: readonly LineType[] = ["ul", "ol", "todo"];

/**
 * The text note's formatting bar (spec B.1): undo, redo · Aa, B, I, U · lists, +, ···. Its menus are views above the bar in
 * the same container, never a modal or anything that takes the focus: the keyboard stays up and the page keeps its
 * selection. On the phone a menu is inside the container's bounds (Android hands a touch outside a view's bounds to what
 * is under it: the text, whose selection would go), and a touch around it closes it. One menu at a time; it closes when an
 * entry is chosen, on `closeMenu()`, when the keyboard hides, and with Esc on the web.
 */
export default function TextFormatBar({ ref, state, onLine, onFormat, onInsert, camera, docked, above }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<{ menu: MenuName; left: number } | null>(null);
  const menu = open?.menu ?? null;
  const openerXRef = useRef<Record<MenuName, number>>({ style: 0, lists: 0, insert: 0, more: 0 });
  const barWidthRef = useRef(0);
  // A window wide enough (a desktop's): the controls get room between them; a narrow one keeps them packed.
  const { width: windowWidth } = useWindowDimensions();
  const roomy = docked && windowWidth >= ROOMY_WIDTH;
  const scrollXRef = useRef(0);
  const closeMenu = useCallback(() => setOpen(null), []);
  // Over its opener, inside the bar.
  const openMenu = (name: MenuName) => {
    const x = openerXRef.current[name] - scrollXRef.current;
    const left = Math.max(PADDING_MARGIN.sm, Math.min(x, barWidthRef.current - MENU_WIDTH - PADDING_MARGIN.sm));
    setOpen({ menu: name, left });
  };

  useImperativeHandle(ref, () => ({ closeMenu }), [closeMenu]);

  // The keyboard going down closes the menu (the phone); Esc does on the web.
  useEffect(() => {
    if (!menu) return;
    if (Platform.OS === "web") {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeMenu();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    const sub = Keyboard.addListener("keyboardDidHide", closeMenu);
    return () => sub.remove();
  }, [menu, closeMenu]);

  const toggleMenu = (name: MenuName) => (menu === name ? closeMenu() : openMenu(name));
  const measureOpener = (name: MenuName) => (e: LayoutChangeEvent) => {
    openerXRef.current[name] = e.nativeEvent.layout.x;
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollXRef.current = e.nativeEvent.contentOffset.x;
  };

  const choose = (action: () => void) => () => {
    closeMenu();
    action();
  };
  const line = (type: LineType) => choose(() => onLine(type));
  const format = (command: FormatCommand) => choose(() => onFormat(command));
  const insert = (kind: InsertKind) => choose(() => onInsert(kind));
  const iconColor = COLOR.softWhite;
  const glyph = (text: string) => <Text style={styles.entryGlyph}>{text}</Text>;

  const entries = (name: MenuName): Entry[] => {
    if (name === "style")
      return [
        {
          // the line back to text, and every style off: the line's, or the selection's
          key: "p",
          label: t("note.format.normal"),
          icon: <ParagraphIcon size={ICON} color={iconColor} />,
          checked: state.line === "p" && !state.bold && !state.italic && !state.underline && !state.code && !state.highlight,
          onPress: format("normal"),
        },
        { key: "h1", label: t("note.format.h1"), icon: glyph("H1"), checked: state.line === "h1", onPress: line("h1") },
        { key: "h2", label: t("note.format.h2"), icon: glyph("H2"), checked: state.line === "h2", onPress: line("h2") },
        {
          key: "quote",
          label: t("note.format.quote"),
          icon: <QuoteIcon size={ICON} color={iconColor} />,
          checked: state.line === "quote",
          onPress: line("quote"),
        },
      ];
    if (name === "lists")
      return [
        {
          key: "ul",
          label: t("note.format.bullets"),
          icon: <BulletListIcon size={ICON} color={iconColor} />,
          checked: state.line === "ul",
          onPress: line("ul"),
        },
        {
          key: "ol",
          label: t("note.format.numbers"),
          icon: <NumberedListIcon size={ICON} color={iconColor} />,
          checked: state.line === "ol",
          onPress: line("ol"),
        },
        {
          key: "todo",
          label: t("note.format.checks"),
          icon: <CheckListIcon size={ICON} color={iconColor} />,
          checked: state.line === "todo",
          onPress: line("todo"),
        },
      ];
    if (name === "insert") {
      const all: (Entry & { kind: InsertKind })[] = [
        {
          kind: "image",
          key: "image",
          label: t("note.format.image"),
          icon: <ImageIcon size={ICON} color={iconColor} />,
          onPress: insert("image"),
        },
        {
          kind: "photo",
          key: "photo",
          label: t("note.format.photo"),
          icon: <CameraIcon size={ICON} color={iconColor} />,
          onPress: insert("photo"),
        },
        {
          kind: "link",
          key: "link",
          label: t("note.format.link"),
          icon: <LinkIcon size={ICON} color={iconColor} />,
          onPress: insert("link"),
        },
        {
          kind: "noteLink",
          key: "noteLink",
          label: t("note.format.note_link"),
          icon: <NoteLinkIcon size={ICON} color={iconColor} />,
          onPress: insert("noteLink"),
        },
        {
          kind: "rule",
          key: "rule",
          label: t("note.format.rule"),
          icon: <RuleIcon size={ICON} color={iconColor} />,
          onPress: insert("rule"),
        },
      ];
      return all.filter((e) => WIRED_INSERTS.includes(e.kind) && (e.kind !== "photo" || camera));
    }
    return [
      {
        key: "codeBlock",
        label: t("note.format.code_block"),
        icon: <CodeBlockIcon size={ICON} color={iconColor} />,
        checked: state.line === "code",
        onPress: line("code"),
      },
      {
        key: "code",
        label: t("note.format.inline_code"),
        icon: <InlineCodeIcon size={ICON} color={iconColor} />,
        checked: state.code,
        onPress: format("code"),
      },
      {
        key: "highlight",
        label: t("note.format.highlight"),
        icon: <HighlightIcon size={ICON} color={iconColor} />,
        checked: state.highlight,
        onPress: format("highlight"),
      },
      {
        key: "strike",
        label: t("note.format.strike"),
        icon: <StrikeIcon size={ICON} color={iconColor} />,
        checked: state.strike,
        onPress: format("strikeThrough"),
      },
      {
        key: "left",
        label: t("note.format.align_left"),
        icon: <AlignLeftIcon size={ICON} color={iconColor} />,
        checked: !state.center,
        onPress: format("justifyLeft"),
      },
      {
        key: "center",
        label: t("note.format.center"),
        icon: <AlignCenterIcon size={ICON} color={iconColor} />,
        checked: state.center,
        onPress: format("justifyCenter"),
      },
      {
        key: "sub",
        label: t("note.format.sub"),
        icon: <SubscriptIcon size={ICON} color={iconColor} />,
        checked: state.sub,
        onPress: format("subscript"),
      },
      {
        key: "sup",
        label: t("note.format.sup"),
        icon: <SuperscriptIcon size={ICON} color={iconColor} />,
        checked: state.sup,
        onPress: format("superscript"),
      },
    ];
  };

  const lit = (on: boolean) => (on ? COLOR.accentSoft : COLOR.softWhite);
  const styleOn = BLOCK_LINES.includes(state.line);
  const listsOn = LIST_LINES.includes(state.line);

  const opener = (name: MenuName, label: string, on: boolean, content: ReactNode) => (
    <Pressable
      key={name}
      onLayout={measureOpener(name)}
      onPress={() => toggleMenu(name)}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={menu === name}
      style={({ pressed }) => [styles.control, (on || menu === name) && styles.controlOn, pressed && styles.controlPressed]}
    >
      <View style={styles.openerContent}>
        {content}
        {name !== "more" && <ChevronDownIcon size={9} strokeWidth={2.4} color={lit(on)} />}
      </View>
    </Pressable>
  );
  const button = (key: string, label: string, onPress: () => void, content: ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
    >
      {content}
    </Pressable>
  );
  const toggle = (key: string, label: string, on: boolean, command: FormatCommand, letter: ReactNode) => (
    <Pressable
      key={key}
      onPress={() => {
        closeMenu();
        onFormat(command);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={on}
      style={({ pressed }) => [styles.control, on && styles.controlOn, pressed && styles.controlPressed]}
    >
      {letter}
    </Pressable>
  );

  const overlay =
    above ??
    (menu && (
      <View
        style={[docked ? styles.menuDocked : styles.menu, docked ? { left: open?.left ?? 0 } : { marginLeft: open?.left ?? 0 }]}
        accessibilityRole="menu"
      >
        {entries(menu).map((entry) => (
          <Pressable
            key={entry.key}
            onPress={entry.onPress}
            accessibilityRole="menuitem"
            accessibilityLabel={entry.label}
            aria-checked={entry.checked}
            style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}
          >
            <View style={styles.entryIcon}>{entry.icon}</View>
            <Text style={[styles.entryLabel, entry.checked && styles.entryLabelOn]} numberOfLines={1}>
              {entry.label}
            </Text>
            {entry.checked && <TickIcon size={16} color={COLOR.accentSoft} />}
          </Pressable>
        ))}
      </View>
    ));

  return (
    <View style={docked && styles.rootDocked}>
      {!docked && overlay ? (
        <Pressable onPress={closeMenu} accessible={false} style={styles.band}>
          {overlay}
        </Pressable>
      ) : null}
      <View
        style={[styles.bar, docked && styles.barDocked]}
        onLayout={(e) => (barWidthRef.current = e.nativeEvent.layout.width)}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          onScroll={onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={[styles.row, docked && styles.rowDocked, roomy && styles.rowRoomy]}
        >
          {button("undo", t("note.format.undo"), () => onFormat("undo"), <UndoIcon size={ICON} color={COLOR.softWhite} />)}
          {button("redo", t("note.format.redo"), () => onFormat("redo"), <RedoIcon size={ICON} color={COLOR.softWhite} />)}
          <View style={styles.separator} />
          {opener("style", t("note.format.style"), styleOn, <Text style={[styles.letter, { color: lit(styleOn) }]}>Aa</Text>)}
          {toggle(
            "bold",
            t("note.format.bold"),
            state.bold,
            "bold",
            <Text style={[styles.letter, styles.bold, { color: lit(state.bold) }]}>B</Text>
          )}
          {toggle(
            "italic",
            t("note.format.italic"),
            state.italic,
            "italic",
            <Text style={[styles.letter, styles.italic, { color: lit(state.italic) }]}>I</Text>
          )}
          {toggle(
            "underline",
            t("note.format.underline"),
            state.underline,
            "underline",
            <Text style={[styles.letter, styles.underline, { color: lit(state.underline) }]}>U</Text>
          )}
          <View style={styles.separator} />
          {opener("lists", t("note.format.lists"), listsOn, <BulletListIcon size={18} color={lit(listsOn)} />)}
          {opener("insert", t("note.format.insert"), false, <PlusIcon size={18} strokeWidth={2} color={COLOR.softWhite} />)}
          {opener(
            "more",
            t("note.format.more"),
            state.line === "code",
            <MoreIcon size={ICON} strokeWidth={2} color={COLOR.softWhite} />
          )}
        </ScrollView>
      </View>
      {/* After the controls: Tab reaches a menu's entries from them. */}
      {docked && overlay ? <View style={styles.above}>{overlay}</View> : null}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  rootDocked: {
    position: "relative",
    marginHorizontal: PADDING_MARGIN.lg,
  },
  bar: {
    width: "100%",
    // The 44 high controls centred in the padding (the height counts the top border too).
    height: TEXT_FORMAT_BAR_HEIGHT,
    paddingVertical: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surface,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
  },
  barDocked: {
    height: TEXT_FORMAT_BAR_HEIGHT + 1,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: BORDER.normal,
  },
  // The phone: the room above the bar while a menu is open, the menu in it; a touch in it closes the menu.
  band: {
    paddingBottom: PADDING_MARGIN.sm,
  },
  row: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  rowDocked: {
    justifyContent: "center",
  },
  rowRoomy: {
    gap: PADDING_MARGIN.xs + 3,
  },
  control: {
    minWidth: 40,
    height: 44,
    paddingHorizontal: 2,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
  },
  controlOn: {
    backgroundColor: GLASS.fillStrong,
  },
  controlPressed: {
    backgroundColor: GLASS.fill,
  },
  openerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  letter: {
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
    color: COLOR.softWhite,
  },
  bold: {
    fontFamily: FONT.bold,
  },
  italic: {
    fontStyle: "italic",
  },
  underline: {
    textDecorationLine: "underline",
  },
  separator: {
    width: 1,
    height: 22,
    marginHorizontal: 2,
    backgroundColor: GLASS.border,
  },
  // The web: above the bar, over the text.
  above: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    marginBottom: PADDING_MARGIN.sm,
  },
  menu: {
    width: MENU_WIDTH,
    paddingVertical: PADDING_MARGIN.xs,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: GLASS.border,
    ...SHADOW.card,
  },
  menuDocked: {
    position: "absolute",
    bottom: 0,
    width: MENU_WIDTH,
    paddingVertical: PADDING_MARGIN.xs,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: GLASS.border,
    ...SHADOW.card,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    minHeight: 44,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  entryPressed: {
    backgroundColor: GLASS.fill,
  },
  entryIcon: {
    width: 24,
    alignItems: "center",
  },
  entryGlyph: {
    fontFamily: FONT.bold,
    fontSize: FONTSIZE.medium,
    color: COLOR.softWhite,
  },
  entryLabel: {
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
    color: COLOR.textPrimary,
  },
  entryLabelOn: {
    color: COLOR.accentSoft,
  },
});
