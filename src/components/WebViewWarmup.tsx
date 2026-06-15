import { runWhenIdle } from "@/utils/idle";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

/**
 * Warms the WebView engine so the note editors load a little faster. The first
 * WebView created in an Android app pays a large one-time cost to load the System
 * WebView (Chromium) into the process; paying it upfront on a tiny hidden WebView
 * — a moment after launch, while the user is on home — shaves time off the first
 * editor open.
 *
 * This only shortens how long the editor takes to become interactive; the visible
 * "empty blue area" on first open is handled deterministically by the editors
 * themselves (they keep a content placeholder up until their WebView reports it
 * has painted). No-op on web, where the editor is a plain <iframe>.
 */
export default function WebViewWarmup() {
  const [mount, setMount] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const task = runWhenIdle(() => setMount(true), 1200);
    return () => task.cancel();
  }, []);

  if (Platform.OS === "web" || !mount) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <WebView source={{ html: WARMUP_HTML }} style={styles.web} javaScriptEnabled scrollEnabled={false} />
    </View>
  );
}

const WARMUP_HTML =
  "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body></body></html>";

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    width: 1,
    height: 1,
    left: -1000,
    top: -1000,
    opacity: 0,
  },
  web: {
    width: 1,
    height: 1,
    opacity: 0,
    backgroundColor: "transparent",
  },
});
