// AI editor features are not available on web/desktop.
// llama.rn requires native platform (Android/iOS).

import type { NoteType } from "@/types/note";
import type { ViewStyle } from "react-native";

interface Props {
  noteType: NoteType;
  getContent: () => string;
  noteTitle: string;
  onTitleGenerated: (title: string) => void;
  onSummaryGenerated?: (summary: string) => void;
  onContinueGenerated?: (continuation: string) => void;
  onItemsSuggested?: (items: string[]) => void;
  onTextFormatted?: (formattedHtml: string) => void;
  onCategorySuggested?: (categoryName: string) => void;
  disabled?: boolean;
  style?: ViewStyle;
  menuBottomOffset?: number;
}

export default function AIEditorActions(_props: Props) {
  return null;
}
