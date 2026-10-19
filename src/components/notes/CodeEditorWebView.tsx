import { CODEMIRROR_HTML } from "@/generated/codemirror-html";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, StyleSheet, TextInput, type TextInputInstance } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

const isWeb = Platform.OS === "web";

const EDITOR_BG = "#282c34";

export interface CodeEditorWebViewRef {
  /**
   * Replaces the document. By default as a new document with its own undo history (e.g. a tab
   * switch); `undoable` makes it an edit of the current one instead (e.g. AI-commented code).
   */
  setCode: (code: string, options?: { undoable?: boolean }) => void;
  setLanguage: (language: string) => void;
  setReadOnly: (readOnly: boolean) => void;
  focus: () => void;
}

interface Props {
  initialCode: string;
  language: string;
  readOnly: boolean;
  onChange: (code: string) => void;
  /** Fires once the editor's WebView has built and painted its content. */
  onReady?: () => void;
}

const CodeEditorWebView = forwardRef<CodeEditorWebViewRef, Props>(
  ({ initialCode, language, readOnly, onChange, onReady }, ref) => {
    // `WebView<object>`, not bare `WebView`: v14 defaults the props generic to
    // `undefined`, which collapses the props type to `undefined` under strict: false.
    const webViewRef = useRef<WebView<object>>(null);
    const hiddenInputRef = useRef<TextInputInstance>(null);
    const isReady = useRef(false);
    const pendingMessages = useRef<string[]>([]);

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
      setCode: (code: string, options?: { undoable?: boolean }) =>
        sendMessage(JSON.stringify({ type: "setCode", code, undoable: !!options?.undoable })),
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
          } else if (data.type === "change") {
            onChangeRef.current(data.code);
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

    const html = useMemo(() => {
      const configScript = `window.__EDITOR_CONFIG__=${JSON.stringify({ code: initialCode, language, readOnly })};`;
      return CODEMIRROR_HTML.replace("window.__EDITOR_CONFIG__=window.__EDITOR_CONFIG__||{};", configScript);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
