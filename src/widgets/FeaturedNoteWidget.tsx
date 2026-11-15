"use no memo";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";

import { icon, typeColor, typeIcon, W } from "@/widgets/theme";

import type { WidgetLine, WidgetState } from "@/libs/widget/snapshot";

interface Props {
  state: WidgetState;
  /** The widget's height on the launcher, dp: only the lines that fit whole are drawn, the others counted. */
  height?: number;
}

const BOX = 15;
const PADDING = 14;
const HEADER = 24 + 9;
/** "+N" under the lines. */
const FOOTER = 20;
const FONT_SIZE = 13;
/** A line: the text's height and the gap under it (measured on the launcher). */
const LINE = 23.5;

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
 * A line. A done item is dimmed, its box filled: the library has no strike-through, a line laid over the text didn't
 * draw, and a combining stroke after each character lands out of place with Geist.
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
        style={{
          fontSize: FONT_SIZE,
          fontFamily: line.mono ? W.font.medium : W.font.regular,
          color: done ? W.muted : line.mono ? W.secondary : W.text,
        }}
      />
    </FlexWidget>
  );
};

/**
 * "Featured note" (spec D.6): the note chosen in the app, as a small copy: its type's icon, its title, its first lines (a
 * list's boxes, a board's columns, code), "+N" for the rest. A tap opens it; with no note, a tap opens the app.
 */
export default function FeaturedNoteWidget({ state, height }: Props) {
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
  // The lines that fit whole: all of them with no "+N" when they all fit, else room is left for it.
  const room = (footer: number) =>
    height ? Math.max(1, Math.floor((height - 2 * PADDING - HEADER - footer) / LINE)) : Infinity;
  const all = featured.more === 0 && featured.lines.length <= room(0);
  const lines = all ? featured.lines : featured.lines.slice(0, room(FOOTER));
  const more = featured.more + featured.lines.length - lines.length;
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
        <TextWidget
          text={title}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 15, fontFamily: W.font.semiBold, color: W.text, letterSpacing: -0.2 }}
        />
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", overflow: "hidden" }}>
        {lines.map((line, i) => (
          <Line key={i} line={line} />
        ))}
      </FlexWidget>
      {more > 0 ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "flex-end" }}>
          <TextWidget text={`+${more}`} style={{ fontSize: 12, fontFamily: W.font.medium, color: W.muted }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
