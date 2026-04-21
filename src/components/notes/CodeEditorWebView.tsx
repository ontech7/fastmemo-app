import { CODEMIRROR_HTML } from "@/generated/codemirror-html";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, StyleSheet } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

const isWeb = Platform.OS === "web";

const EDITOR_BG = "#282c34";

export interface CodeEditorWebViewRef {
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setReadOnly: (readOnly: boolean) => void;
}

interface Props {
  initialCode: string;
  language: string;
  readOnly: boolean;
  onChange: (code: string) => void;
}

const CodeEditorWebView = forwardRef<CodeEditorWebViewRef, Props>(({ initialCode, language, readOnly, onChange }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const isReady = useRef(false);
  const pendingMessages = useRef<string[]>([]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
    setCode: (code: string) => sendMessage(JSON.stringify({ type: "setCode", code })),
    setLanguage: (lang: string) => sendMessage(JSON.stringify({ type: "setLanguage", language: lang })),
    setReadOnly: (ro: boolean) => sendMessage(JSON.stringify({ type: "setReadOnly", readOnly: ro })),
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
        } else if (data.type === "change") {
          onChangeRef.current(data.code);
        }
      } catch {}
    },
    [sendToEditor]
  );

  useEffect(() => {
    if (isReady.current) {
      sendMessage(JSON.stringify({ type: "setLanguage", language }));
    }
  }, [language, sendMessage]);

  useEffect(() => {
    if (isReady.current) {
      sendMessage(JSON.stringify({ type: "setReadOnly", readOnly }));
    }
  }, [readOnly, sendMessage]);

  // Compute HTML ONCE on mount — never changes, never causes WebView reload
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => {
    const configScript = `window.__EDITOR_CONFIG__=${JSON.stringify({ code: initialCode, language, readOnly })};`;
    return CODEMIRROR_HTML.replace("window.__EDITOR_CONFIG__=window.__EDITOR_CONFIG__||{};", configScript);
  }, []);

  return (
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
  );
});

CodeEditorWebView.displayName = "CodeEditorWebView";
export default React.memo(CodeEditorWebView);

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: EDITOR_BG,
  },
});
