import { BORDER, COLOR, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from "react-native";
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from "react-native-heroicons/outline";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

/**
 * Inject JS into the pell-rich-editor WebView.
 * On native: uses injectJavascript (WebView.injectJavaScript).
 * On web: uses command() which goes through postMessage -> iframe eval.
 */
function runInEditor(editorRef: React.RefObject<any>, script: string) {
  if (!editorRef.current) return;
  if (Platform.OS !== "web") {
    editorRef.current.injectJavascript?.(script);
  } else {
    editorRef.current.command?.(script);
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  editorRef: React.RefObject<any>;
  plainText: string;
  style?: ViewStyle;
}

export default function FindReplaceBar({ visible, onClose, editorRef, plainText, style }: Props) {
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [showReplace, setShowReplace] = useState(false);

  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => searchInputRef.current?.focus(), 200);
    } else {
      setSearchText("");
      setReplaceText("");
      setMatchCount(0);
      setCurrentMatch(0);
      runInEditor(editorRef, `window.getSelection && window.getSelection().removeAllRanges(); true;`);
    }
  }, [visible]);

  const countMatches = useCallback(
    (text: string): number => {
      if (!text) return 0;
      const sLower = text.toLowerCase();
      const tLower = plainText.toLowerCase();
      let count = 0;
      let idx = 0;
      while ((idx = tLower.indexOf(sLower, idx)) !== -1) {
        count++;
        idx += sLower.length;
      }
      return count;
    },
    [plainText]
  );

  const findInEditor = useCallback(
    (text: string, backwards = false) => {
      if (!editorRef.current || !text) return;
      const escaped = text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const script = `
        (function(){
          var found = window.find('${escaped}', false, ${backwards}, true, false, false, false);
          if (!found) {
            var editor = document.querySelector('[contenteditable]');
            if (editor) {
              var sel = window.getSelection();
              var range = document.createRange();
              range.selectNodeContents(editor);
              range.collapse(${backwards});
              sel.removeAllRanges();
              sel.addRange(range);
              window.find('${escaped}', false, ${backwards}, true, false, false, false);
            }
          }
        })();
        true;
      `;
      runInEditor(editorRef, script);
    },
    [editorRef]
  );

  const performSearch = useCallback(
    (text: string) => {
      const count = countMatches(text);
      setMatchCount(count);
      if (!text || count === 0) {
        setCurrentMatch(0);
        runInEditor(editorRef, `window.getSelection && window.getSelection().removeAllRanges(); true;`);
        return;
      }
      setCurrentMatch(1);
      const escaped = text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const script = `
        (function(){
          var editor = document.querySelector('[contenteditable]');
          if (editor) {
            var sel = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            window.find('${escaped}', false, false, true, false, false, false);
          }
        })();
        true;
      `;
      runInEditor(editorRef, script);
    },
    [editorRef, countMatches]
  );

  const navigateMatch = useCallback(
    (direction: "next" | "prev") => {
      if (matchCount === 0) return;
      let n = direction === "next" ? currentMatch + 1 : currentMatch - 1;
      if (n > matchCount) n = 1;
      if (n < 1) n = matchCount;
      setCurrentMatch(n);
      findInEditor(searchText, direction === "prev");
    },
    [matchCount, currentMatch, searchText, findInEditor]
  );

  const replaceCurrentMatch = useCallback(() => {
    if (matchCount === 0 || !editorRef.current || !searchText) return;
    const escaped = replaceText.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const script = `
      (function(){
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.toString().length > 0) {
          document.execCommand('insertText', false, '${escaped}');
        }
      })();
      true;
    `;
    runInEditor(editorRef, script);
    setTimeout(() => {
      setMatchCount((prev) => Math.max(0, prev - 1));
      setCurrentMatch((prev) => Math.min(prev, Math.max(0, matchCount - 1)));
      if (matchCount - 1 > 0) findInEditor(searchText, false);
    }, 150);
  }, [editorRef, matchCount, replaceText, searchText, findInEditor]);

  const replaceAll = useCallback(() => {
    if (matchCount === 0 || !editorRef.current || !searchText) return;
    const escapedS = searchText.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const escapedR = replaceText.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const script = `
      (function(){
        var editor = document.querySelector('[contenteditable]');
        if (!editor) return;
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        var n = 0;
        while (window.find('${escapedS}', false, false, false, false, false, false)) {
          document.execCommand('insertText', false, '${escapedR}');
          n++;
          if (n > 1000) break;
        }
      })();
      true;
    `;
    runInEditor(editorRef, script);
    setMatchCount(0);
    setCurrentMatch(0);
  }, [editorRef, matchCount, searchText, replaceText]);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText, performSearch]);

  useEffect(() => {
    if (searchText) {
      const count = countMatches(searchText);
      setMatchCount(count);
      if (count === 0) setCurrentMatch(0);
      else if (currentMatch > count) setCurrentMatch(count);
    }
  }, [plainText]);

  if (!visible) return null;

  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(200)} style={[styles.container, style]}>
      <View style={styles.row}>
        <TextInput
          ref={searchInputRef}
          style={styles.input}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t("note.find_replace.search_placeholder")}
          placeholderTextColor={COLOR.placeholder}
          cursorColor={COLOR.softWhite}
          returnKeyType="search"
          onSubmitEditing={() => navigateMatch("next")}
        />
        <Text style={styles.matchCount}>{matchCount > 0 ? `${currentMatch}/${matchCount}` : "0/0"}</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigateMatch("prev")} disabled={matchCount === 0}>
          <ChevronUpIcon size={18} color={matchCount > 0 ? COLOR.softWhite : COLOR.placeholder} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigateMatch("next")} disabled={matchCount === 0}>
          <ChevronDownIcon size={18} color={matchCount > 0 ? COLOR.softWhite : COLOR.placeholder} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => setShowReplace(!showReplace)}>
          <Text style={[styles.toggleText, showReplace && { color: COLOR.oceanBreeze }]}>
            {t("note.find_replace.replace_short")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onClose}>
          <XMarkIcon size={18} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>
      {showReplace && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={replaceText}
            onChangeText={setReplaceText}
            placeholder={t("note.find_replace.replace_placeholder")}
            placeholderTextColor={COLOR.placeholder}
            cursorColor={COLOR.softWhite}
          />
          <TouchableOpacity style={styles.actionButton} onPress={replaceCurrentMatch} disabled={matchCount === 0}>
            <Text style={[styles.actionButtonText, matchCount === 0 && { color: COLOR.placeholder }]}>
              {t("note.find_replace.replace_one")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={replaceAll} disabled={matchCount === 0}>
            <Text style={[styles.actionButtonText, matchCount === 0 && { color: COLOR.placeholder }]}>
              {t("note.find_replace.replace_all")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    marginHorizontal: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 2 },
  input: {
    flex: 1,
    height: 34,
    backgroundColor: COLOR.darkBlue,
    borderRadius: BORDER.small,
    paddingHorizontal: PADDING_MARGIN.sm,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
  },
  matchCount: { color: COLOR.lightBlue, fontSize: FONTSIZE.small, minWidth: 36, textAlign: "center" },
  iconButton: { padding: 6 },
  toggleText: { color: COLOR.lightBlue, fontSize: FONTSIZE.small, fontWeight: "600" },
  actionButton: {
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 6,
    backgroundColor: COLOR.boldBlue,
    borderRadius: BORDER.small,
  },
  actionButtonText: { color: COLOR.softWhite, fontSize: FONTSIZE.small },
});
