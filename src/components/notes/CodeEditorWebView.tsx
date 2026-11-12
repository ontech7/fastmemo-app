import { buildCodeEditorHtml } from "@/libs/codeEditorPage";
import { reportPageError } from "@/libs/diagnostics";
import { PAGE_ERROR_MESSAGE } from "@/libs/pageErrors";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, StyleSheet, TextInput, type TextInputInstance } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

const isWeb = Platform.OS === "web";

const EDITOR_BG = "#282c34";

interface SetCodeOptions {
  undoable?: boolean;
  remote?: boolean;
  /** What the new document is (a tab's id): a change made in it is reported with it, even after it was replaced. */
  tag?: string;
}

export interface CodeEditorWebViewRef {
  /**
   * Replaces the document. By default as a new document with its own undo history (e.g. a tab
   * switch); `undoable` makes it an edit of the current one instead (e.g. AI-commented code);
   * `remote` is another device's edit of it: the cursor stays, and undo doesn't revert it.
   */
  setCode: (code: string, options?: SetCodeOptions) => void;
  setLanguage: (language: string) => void;
  setReadOnly: (readOnly: boolean) => void;
  focus: () => void;
  /**
   * Asks the page for its text now instead of when typing pauses (the app is going to the background, the tab closes).
   * On the web the text is handed to `onChange` before this returns.
   */
  flush: () => void;
}

interface Props {
  initialCode: string;
  language: string;
  readOnly: boolean;
  /**
   * The text of the document on screen (no `tag`), or the last text of one a tab switch just replaced, sent at the
   * switch: `tag` is the one it was set with (`initialTag` for the first).
   */
  onChange: (code: string, tag?: string) => void;
  /** The `tag` of the document the editor opens with. */
  initialTag?: string;
  /** Fires once the editor's WebView has built and painted its content. */
  onReady?: () => void;
}

const CodeEditorWebView = forwardRef<CodeEditorWebViewRef, Props>(
  ({ initialCode, language, readOnly, onChange, onReady, initialTag }, ref) => {
    // `WebView<object>`, not bare `WebView`: v14 defaults the props generic to
    // `undefined`, which collapses the props type to `undefined` under strict: false.
    const webViewRef = useRef<WebView<object>>(null);
    const hiddenInputRef = useRef<TextInputInstance>(null);
    const isReady = useRef(false);
    const pendingMessages = useRef<string[]>([]);
    // Documents sent to the editor: a change it reports carries the one it was made in, and one made in a document
    // replaced since (a keystroke on its way as another device's edit or a tab switch arrives) would undo the new one.
    const docRef = useRef(0);
    // Each document's tag: a replaced document's last text (`final`, sent at a tab switch) goes where it belongs.
    const docTags = useRef(new Map<number, string | undefined>([[0, initialTag]]));

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    // Platform-aware transport: injectJavaScript on native, postMessage on web/Tauri
    const sendToEditor = useCallback((msg: string) => {
      if (isWeb) {
        // react-native-web-webview exposes postMessage(message, origin) on its ref
        (webViewRef.current as any)?.postMessage?.(msg, "*");
      } else {
        webViewRef.current?.injectJavaScript(`window.handleMessage(${JSON.stringify(msg)});true;`);
      }
    }, []);

    const sendMessage = useCallback(
      (msg: string) => {
        if (isReady.current) {
          sendToEditor(msg);
        } else {
          pendingMessages.current.push(msg);
        }
      },
      [sendToEditor]
    );

    useImperativeHandle(ref, () => ({
      setCode: (code: string, options?: SetCodeOptions) => {
        const doc = ++docRef.current;
        docTags.current.set(doc, options?.tag);
        sendMessage(
          JSON.stringify({
            type: "setCode",
            code,
            doc,
            undoable: !!options?.undoable,
            remote: !!options?.remote,
          })
        );
      },
      setLanguage: (lang: string) => sendMessage(JSON.stringify({ type: "setLanguage", language: lang })),
      setReadOnly: (ro: boolean) => sendMessage(JSON.stringify({ type: "setReadOnly", readOnly: ro })),
      focus: () => {
        // Focusing CodeMirror's contentEditable from inside the WebView does NOT
        // raise the soft keyboard on its own. On Android we first focus a hidden
        // native TextInput (that's what actually brings the keyboard up), then hand
        // focus to the WebView; iOS relies on keyboardDisplayRequiresUserAction.
        // This mirrors how react-native-pell-rich-editor opens its keyboard.
        if (!isWeb) {
          if (Platform.OS === "android") {
            hiddenInputRef.current?.focus();
          }
          webViewRef.current?.requestFocus?.();
        }
        sendMessage(JSON.stringify({ type: "focus" }));
      },
      flush: () => {
        if (!isWeb) {
          // The answer arrives while the app is in the background, and is written at once (useNoteEditor).
          sendMessage(JSON.stringify({ type: "flush" }));
          return;
        }
        // On the web the page is a same-origin frame (react-native-web-webview renders an iframe with srcDoc), and a
        // message it posts while the tab closes never arrives: its text not yet sent is taken synchronously.
        const page = (webViewRef.current as any)?.frameRef?.contentWindow;
        const change = page?.takePendingChange?.();
        if (!change) return;
        const data = JSON.parse(change);
        if ((data.doc ?? 0) === docRef.current) onChangeRef.current(data.code);
      },
    }));

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "ready") {
            isReady.current = true;
            for (const msg of pendingMessages.current) {
              sendToEditor(msg);
            }
            pendingMessages.current = [];
            onReadyRef.current?.();
          } else if (data.type === PAGE_ERROR_MESSAGE) {
            reportPageError("codemirror", data.data);
          } else if (data.type === "change" && (data.doc ?? 0) === docRef.current) {
            onChangeRef.current(data.code);
          } else if (data.type === "change" && data.final === true && docTags.current.get(data.doc ?? 0) !== undefined) {
            // The last text of a document a tab switch replaced: stored in its own tab. Any other change of an old
            // document stays refused (it could undo another device's edit merged since).
            onChangeRef.current(data.code, docTags.current.get(data.doc ?? 0));
            docTags.current.delete(data.doc ?? 0);
          }
        } catch {}
      },
      [sendToEditor]
    );

    // Not gated on isReady: sendMessage queues until the editor is up, so a change made while it
    // loads still lands (the editor ignores a language it already has).
    useEffect(() => {
      sendMessage(JSON.stringify({ type: "setLanguage", language }));
    }, [language, sendMessage]);

    useEffect(() => {
      sendMessage(JSON.stringify({ type: "setReadOnly", readOnly }));
    }, [readOnly, sendMessage]);

    // Compute HTML ONCE on mount — never changes, never causes WebView reload

    // The note's code can hold anything ("$'", "</script>"...): the page is built so none of it changes the page (LL-077).
    const html = useMemo(
      () => buildCodeEditorHtml({ code: initialCode, language, readOnly }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    return (
      <>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          onMessage={handleMessage}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardDisplayRequiresUserAction={false}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          overScrollMode="never"
          androidLayerType="hardware"
        />
        {/* Hidden, off-screen native input. Focusing it is what actually raises the
            Android soft keyboard before focus is handed to the WebView (see focus()). */}
        {Platform.OS === "android" && <TextInput ref={hiddenInputRef} style={styles.hiddenInput} />}
      </>
    );
  }
);

CodeEditorWebView.displayName = "CodeEditorWebView";
export default React.memo(CodeEditorWebView);

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: EDITOR_BG,
  },
  // 1x1, pushed far off-screen — never seen or interacted with, it exists only as
  // a native keyboard trigger for Android (see the `focus` handler).
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    bottom: -999,
    left: -999,
    zIndex: -999,
  },
});
