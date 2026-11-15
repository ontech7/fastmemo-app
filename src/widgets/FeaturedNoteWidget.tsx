"use no memo";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";

import { icon, typeColor, typeIcon, W } from "@/widgets/theme";

import type { WidgetColumn, WidgetLine, WidgetSnapshot, WidgetState } from "@/libs/widget/snapshot";

interface Props {
  state: WidgetState;
  /** The widget's size on the launcher, dp: it draws what fits and counts or ends with "…" the rest. */
  width?: number;
  height?: number;
}

const BOX = 15;
const PADDING = 14;
const HEADER = 24 + 9;
/** "+N" under the lines. */
const FOOTER = 20;
const FONT_SIZE = 13;
/** A list's line: the text's height and the gap under it (measured on the launcher). */
const LINE = 23.5;
/** A wrapped text row at FONT_SIZE, and a character's mean width in Geist at that size (dp). */
const ROW = 17;
const CHAR = 6.4;
/** A code line in the mono font, and the code panel's padding. */
const CODE_SIZE = 11.5;
const CODE_ROW = 16.5;
const CODE_PAD = 10;
/** A board's narrowest column, the gap between columns, a card of one line and of two (with its gap). */
const COLUMN_MIN = 96;
const COLUMN_GAP = 8;
const COLUMN_HEAD = 18 + 6;
const CARD_1 = 28;
const CARD_2 = 43;

/** A line's box: empty, or filled with a tick. Drawn only, nothing in a widget can be ticked. */
const Box = ({ done }: { done: boolean }) => (
  <FlexWidget
    style={{
      width: BOX,
      height: BOX,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: done ? W.buttonBorder : W.muted,
      backgroundColor: done ? W.button : W.field,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    {done ? <SvgWidget svg={icon("check", W.icon, 3)} style={{ width: 10, height: 10 }} /> : <FlexWidget />}
  </FlexWidget>
);

/**
 * A list's item, one line. A done item is dimmed, its box filled: the library has no strike-through, a line laid over the
 * text didn't draw, and a combining stroke after each character lands out of place with Geist.
 */
const Line = ({ line }: { line: WidgetLine }) => {
  const done = line.box === "done";
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8, marginBottom: 5 }}>
      {line.box ? <Box done={done} /> : null}
      <TextWidget
        text={line.text}
        maxLines={1}
        truncate="END"
        style={{ fontSize: FONT_SIZE, fontFamily: W.font.regular, color: done ? W.muted : W.text }}
      />
    </FlexWidget>
  );
};

/** Code lines on a darker panel, in the mono font, one line each (code isn't wrapped). */
const CodePanel = ({ lines, grow }: { lines: WidgetLine[]; grow: boolean }) => (
  <FlexWidget
    style={{
      width: "match_parent",
      ...(grow ? { flex: 1 } : {}),
      flexDirection: "column",
      backgroundColor: W.code,
      borderRadius: 12,
      padding: CODE_PAD,
      marginBottom: 4,
    }}
  >
    {lines.map((line, i) => (
      <TextWidget
        key={i}
        text={line.text}
        maxLines={1}
        truncate="END"
        style={{ fontSize: CODE_SIZE, fontFamily: W.font.mono, color: W.secondary }}
      />
    ))}
  </FlexWidget>
);

type Block = { kind: "text"; lines: WidgetLine[] } | { kind: "box"; line: WidgetLine } | { kind: "code"; lines: WidgetLine[] };

/** A text note's lines as blocks: paragraphs in a row become one wrapped text, a code block one panel. */
function blocksOf(lines: WidgetLine[]): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    const last = blocks[blocks.length - 1];
    if (line.box) blocks.push({ kind: "box", line });
    else if (line.mono) {
      if (last?.kind === "code") last.lines.push(line);
      else blocks.push({ kind: "code", lines: [line] });
    } else if (last?.kind === "text") last.lines.push(line);
    else blocks.push({ kind: "text", lines: [line] });
  }
  return blocks;
}

/** How many wrapped rows a paragraph takes at this width (an estimate: Geist's mean character width). */
const rowsOf = (text: string, width: number) => Math.max(1, Math.ceil((Array.from(text).length * CHAR) / width));

/**
 * A text note: its paragraphs wrap and fill the room; "…" only where the room ends (Android's own end truncation on the
 * last text drawn). Boxes and code blocks keep their place in the order. A list of elements, not a component: the library
 * can't draw a fragment (nor a component that returns several).
 */
function textBody(snapshot: WidgetSnapshot, width: number, height: number): React.JSX.Element[] {
  let rows = Math.max(1, Math.floor(height / ROW));
  const out: React.JSX.Element[] = [];
  const blocks = blocksOf(snapshot.lines);
  for (let i = 0; i < blocks.length && rows > 0; i++) {
    const block = blocks[i];
    const last = i === blocks.length - 1;
    if (block.kind === "box") {
      const need = Math.min(2, rowsOf(block.line.text, width - BOX - 8));
      const done = block.line.box === "done";
      out.push(
        <FlexWidget key={i} style={{ width: "match_parent", flexDirection: "row", flexGap: 8, marginBottom: 3 }}>
          <FlexWidget style={{ paddingTop: 1 }}>
            <Box done={done} />
          </FlexWidget>
          <TextWidget
            text={block.line.text}
            maxLines={Math.min(need, rows)}
            truncate="END"
            style={{ fontSize: FONT_SIZE, fontFamily: W.font.regular, color: done ? W.muted : W.text }}
          />
        </FlexWidget>
      );
      rows -= need;
    } else if (block.kind === "code") {
      const fit = Math.max(1, Math.floor((rows * ROW - 2 * CODE_PAD) / CODE_ROW));
      const shown = block.lines.slice(0, fit);
      out.push(<CodePanel key={i} lines={shown} grow={false} />);
      rows -= Math.ceil((shown.length * CODE_ROW + 2 * CODE_PAD + 4) / ROW);
    } else {
      const text = block.lines.map((line) => line.text).join("\n");
      const need = block.lines.reduce((sum, line) => sum + rowsOf(line.text, width), 0);
      // The last text drawn takes all the room left: Android ends it with "…" where it doesn't fit. One row more than the
      // estimate for the others: a shorter text takes only its own rows anyway.
      const maxLines = last ? rows : Math.min(rows, need + 1);
      out.push(
        <TextWidget
          key={i}
          text={last && snapshot.more > 0 ? text + "\n…" : text}
          maxLines={maxLines}
          truncate="END"
          style={{ fontSize: FONT_SIZE, fontFamily: W.font.regular, color: W.text }}
        />
      );
      rows -= last ? maxLines : need;
    }
  }
  return out;
}

/** A board's column: its colour, name and count, then its first cards. */
const Column = ({ column, cards, twoLines }: { column: WidgetColumn; cards: number; twoLines: boolean }) => {
  const shown = column.cards.slice(0, cards);
  const rest = column.count - shown.length;
  return (
    <FlexWidget
      style={{
        flex: 1,
        height: "match_parent",
        flexDirection: "column",
        backgroundColor: W.field,
        borderRadius: 12,
        padding: 8,
        flexGap: 6,
      }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 6 }}>
        <FlexWidget
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (column.color || W.muted) as typeof W.muted }}
        />
        <TextWidget
          text={column.name || "—"}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 12, fontFamily: W.font.semiBold, color: W.text }}
        />
        <TextWidget text={String(column.count)} style={{ fontSize: 11, fontFamily: W.font.medium, color: W.muted }} />
      </FlexWidget>
      {shown.map((card, i) => (
        <FlexWidget
          key={i}
          style={{ width: "match_parent", backgroundColor: W.chip, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 }}
        >
          <TextWidget
            text={card}
            maxLines={twoLines ? 2 : 1}
            truncate="END"
            style={{ fontSize: 11.5, fontFamily: W.font.regular, color: W.secondary }}
          />
        </FlexWidget>
      ))}
      {rest > 0 && shown.length > 0 ? (
        <TextWidget text={`+${rest}`} style={{ fontSize: 11, fontFamily: W.font.medium, color: W.muted }} />
      ) : null}
    </FlexWidget>
  );
};

/** A board: its first columns side by side, as many as the width holds; the others counted in the header. */
function BoardBody({ snapshot, width, height }: { snapshot: WidgetSnapshot; width: number; height: number }) {
  const columns = snapshot.columns ?? [];
  const n = Math.max(1, Math.min(columns.length, Math.floor((width + COLUMN_GAP) / (COLUMN_MIN + COLUMN_GAP))));
  const inner = height - 16 - COLUMN_HEAD - 14;
  const most = Math.max(0, ...columns.slice(0, n).map((column) => column.cards.length));
  const twoLines = most * CARD_2 <= inner;
  const cards = Math.max(0, Math.floor(inner / (twoLines ? CARD_2 : CARD_1)));
  return (
    <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "row", flexGap: COLUMN_GAP }}>
      {columns.slice(0, n).map((column, i) => (
        <Column key={i} column={column} cards={cards} twoLines={twoLines} />
      ))}
    </FlexWidget>
  );
}

/**
 * "Featured note" (spec D.6): the note chosen in the app, as a small copy: its type's icon, its title, then by type a text
 * note's wrapped paragraphs, a list's items with their boxes, a board's columns with their first cards, code in the mono
 * font. A tap opens it; with no note, a tap opens the app.
 */
export default function FeaturedNoteWidget({ state, width, height }: Props) {
  const { featured, labels, links } = state;
  const frame = {
    width: "match_parent",
    height: "match_parent",
    flexDirection: "column",
    padding: PADDING,
    backgroundColor: W.surface,
    borderRadius: W.radius,
    borderWidth: 1,
    borderColor: W.border,
  } as const;

  if (!featured) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: links.app }}
        accessibilityLabel={`${labels.emptyTitle}. ${labels.emptyText}`}
        style={{ ...frame, justifyContent: "center" }}
      >
        <TextWidget
          text={labels.emptyTitle}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 15, fontFamily: W.font.semiBold, color: W.text }}
        />
        <TextWidget
          text={labels.emptyText}
          maxLines={3}
          truncate="END"
          style={{ fontSize: 13, fontFamily: W.font.regular, color: W.secondary, marginTop: 4 }}
        />
      </FlexWidget>
    );
  }

  const title = featured.title.trim() ? featured.title : labels.noTitle;
  const innerWidth = (width ?? 180) - 2 * PADDING;
  const innerHeight = (height ?? 110) - 2 * PADDING - HEADER;
  const isBoard = featured.type === "kanban";
  const isText = featured.type === "text";
  const isCode = featured.type === "code";

  // Lists and code: the lines that fit whole, all of them with no "+N" when they all fit, else room is left for it.
  const unit = isCode ? CODE_ROW : LINE;
  const pad = isCode ? 2 * CODE_PAD + 4 : 0;
  const room = (footer: number) => Math.max(1, Math.floor((innerHeight - pad - footer) / unit));
  const all = featured.more === 0 && featured.lines.length <= room(0);
  const lines = isText || isBoard ? featured.lines : all ? featured.lines : featured.lines.slice(0, room(FOOTER));
  const more = isText ? 0 : featured.more + featured.lines.length - lines.length;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: links.note ?? links.app }}
      accessibilityLabel={title}
      style={frame}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8, marginBottom: 9 }}>
        <FlexWidget
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            backgroundColor: W.chip,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SvgWidget svg={icon(typeIcon[featured.type], typeColor(featured.type), 2)} style={{ width: 15, height: 15 }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={title}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 15, fontFamily: W.font.semiBold, color: W.text, letterSpacing: -0.2 }}
          />
        </FlexWidget>
        {isBoard && more > 0 ? (
          <TextWidget text={`+${more}`} style={{ fontSize: 12, fontFamily: W.font.medium, color: W.muted }} />
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", overflow: "hidden" }}>
        {isText ? (
          textBody(featured, innerWidth, innerHeight)
        ) : isBoard ? (
          <BoardBody snapshot={featured} width={innerWidth} height={innerHeight} />
        ) : isCode ? (
          <CodePanel lines={lines} grow />
        ) : (
          lines.map((line, i) => <Line key={i} line={line} />)
        )}
      </FlexWidget>
      {more > 0 && !isBoard ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "flex-end" }}>
          <TextWidget text={`+${more}`} style={{ fontSize: 12, fontFamily: W.font.medium, color: W.muted }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
