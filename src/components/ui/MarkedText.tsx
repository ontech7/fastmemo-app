import { memo } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

import { COLOR, FONT } from "@/constants/styles";
import type { Range } from "@/libs/search/search";

interface Props {
  text: string;
  /** Sorted, not overlapping: the pieces to mark. */
  ranges: Range[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** A text with some pieces marked (a search's typed words): nested pieces of one `Text`; no ranges, a plain `Text`. */
function MarkedText({ text, ranges, style, numberOfLines }: Props) {
  if (!ranges.length) {
    return (
      <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
        {text}
      </Text>
    );
  }

  const pieces: ReactNode[] = [];
  let at = 0;
  ranges.forEach((range, index) => {
    if (range.start > at) pieces.push(text.slice(at, range.start));
    pieces.push(
      <Text key={index} style={styles.mark}>
        {text.slice(range.start, range.end)}
      </Text>
    );
    at = range.end;
  });
  if (at < text.length) pieces.push(text.slice(at));

  return (
    <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
      {pieces}
    </Text>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  mark: {
    backgroundColor: COLOR.accentMark,
    fontFamily: FONT.semiBold,
  },
});

export default memo(MarkedText);
