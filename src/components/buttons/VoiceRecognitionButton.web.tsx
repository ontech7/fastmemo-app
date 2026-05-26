import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { MicrophoneIcon } from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

import DictationSheet from "@/components/voice/DictationSheet";
import { getLocales } from "@/libs/localization";
import { supportedLanguages } from "@/libs/i18n";
import { selectorVoiceRecognition } from "@/slicers/settingsSlice";
import { formatVoiceTranscript } from "@/utils/voiceTranscript";
import { toast } from "@/utils/toast";

import { BORDER, COLOR, PADDING_MARGIN, SHADOW } from "@/constants/styles";

import type { ViewStyle } from "react-native";

interface Props {
  /** Called once with the final, formatted dictation text when the user confirms. */
  onInsert: (text: string) => void;
  /** Accepted for API parity with native; AI cleanup is not available on web. */
  aiCleanup?: boolean;
  style?: ViewStyle;
}

export default function VoiceRecognitionButton({ onInsert, style = {} }: Props) {
  const selectors = useSelector(selectorVoiceRecognition);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [activeLang, setActiveLang] = useState("en-US");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const committedRef = useRef("");

  const isSpeechAvailable =
    typeof window !== "undefined" &&
    (typeof SpeechRecognition !== "undefined" || typeof webkitSpeechRecognition !== "undefined");

  useEffect(() => {
    if (!isSpeechAvailable) return;

    const SpeechRecognitionCtor = typeof SpeechRecognition !== "undefined" ? SpeechRecognition : webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = selectors.continuous ?? true;
    recognition.interimResults = selectors.interimResults ?? true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let sessionFinal = "";
      let sessionInterim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) sessionFinal += result[0].transcript + " ";
        else sessionInterim += result[0].transcript;
      }
      setFinalText(`${committedRef.current} ${sessionFinal}`.trim());
      setInterim(sessionInterim.trim());
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => recognition.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectors.continuous, selectors.interimResults]);

  const resolveLang = useCallback(
    () => (selectors.language !== "system" ? selectors.language : getLocales()[0]?.languageTag || "en-US"),
    [selectors.language]
  );

  const startEngine = useCallback((lang: string) => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.lang = lang;
      recognition.start();
      setListening(true);
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setListening(false);
    }
  }, []);

  const openDictation = useCallback(() => {
    if (!isSpeechAvailable) {
      toast("Speech recognition not available in this browser");
      return;
    }
    const lang = resolveLang();
    setActiveLang(lang);
    committedRef.current = "";
    setFinalText("");
    setInterim("");
    setSheetOpen(true);
    startEngine(lang);
  }, [isSpeechAvailable, resolveLang, startEngine]);

  const pauseEngine = useCallback(() => {
    // finalText already holds committed + current session text — bank it so the
    // next session appends instead of overwriting
    committedRef.current = finalText;
    recognitionRef.current?.stop();
    setListening(false);
  }, [finalText]);

  const toggleListening = useCallback(() => {
    if (listening) {
      pauseEngine();
    } else {
      startEngine(activeLang);
    }
  }, [listening, pauseEngine, startEngine, activeLang]);

  const closeAndReset = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setSheetOpen(false);
    committedRef.current = "";
    setFinalText("");
    setInterim("");
  }, []);

  const handleConfirm = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    const text = formatVoiceTranscript(`${finalText} ${interim}`.trim(), activeLang, { capitalize: true });
    setSheetOpen(false);
    committedRef.current = "";
    setFinalText("");
    setInterim("");
    if (text) onInsert(text);
  }, [finalText, interim, activeLang, onInsert]);

  const preview = useMemo(
    () => formatVoiceTranscript(`${finalText} ${interim}`.trim(), activeLang, { capitalize: true }),
    [finalText, interim, activeLang]
  );

  const languageLabel = useMemo(() => {
    const prefix = activeLang.split("-")[0];
    return supportedLanguages[prefix]?.name ?? activeLang;
  }, [activeLang]);

  if (!selectors.enabled) return null;

  return (
    <>
      <View style={[styles.wrapper, style]}>
        <TouchableOpacity activeOpacity={0.7} style={styles.button} onPress={openDictation}>
          <MicrophoneIcon size={24} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>

      <DictationSheet
        visible={sheetOpen}
        listening={listening}
        transcript={preview}
        languageLabel={languageLabel}
        onToggleListening={toggleListening}
        onCancel={closeAndReset}
        onConfirm={handleConfirm}
      />
    </>
  );
}

const BUTTON_SIZE = 52;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 100,
    right: 40,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    padding: PADDING_MARGIN.md,
    ...SHADOW.fab,
  },
});
