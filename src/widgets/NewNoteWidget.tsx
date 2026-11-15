"use no memo";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";

import { icon, W } from "@/widgets/theme";

import type { WidgetState } from "@/libs/widget/snapshot";

interface Props {
  state: WidgetState;
}

const BUTTON = 44;

/** "New note" (spec D.6): a bar, the room taken by "New note…", then a new list and a dictation; each opens the app on it. */
export default function NewNoteWidget({ state }: Props) {
  const { labels, links } = state;
  const button = (name: "list" | "mic", uri: string, label: string) => (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={label}
      style={{
        width: BUTTON,
        height: BUTTON,
        borderRadius: BUTTON / 2,
        backgroundColor: W.button,
        borderWidth: 1,
        borderColor: W.buttonBorder,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <SvgWidget svg={icon(name, W.icon)} style={{ width: 20, height: 20 }} />
    </FlexWidget>
  );
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        flexGap: 8,
        paddingHorizontal: 8,
        backgroundColor: W.surface,
        borderRadius: W.radius,
        borderWidth: 1,
        borderColor: W.border,
      }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: links.newText }}
        accessibilityLabel={labels.newNote}
        style={{
          flex: 1,
          height: BUTTON,
          flexDirection: "row",
          alignItems: "center",
          flexGap: 8,
          paddingHorizontal: 14,
          borderRadius: BUTTON / 2,
          backgroundColor: W.field,
          borderWidth: 1,
          borderColor: W.border,
        }}
      >
        <SvgWidget svg={icon("pencil", W.secondary)} style={{ width: 16, height: 16 }} />
        <TextWidget
          text={labels.newNote}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, fontFamily: W.font.regular, color: W.secondary }}
        />
      </FlexWidget>
      {button("list", links.newList, labels.newList)}
      {button("mic", links.dictate, labels.dictate)}
    </FlexWidget>
  );
}
