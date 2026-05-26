import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Localization from "expo-localization";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useCallback, useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, TouchableOpacity, View } from "react-native";
import { MicrophoneIcon } from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

import DictationSheet from "@/components/voice/DictationSheet";
import { generateEditorContent, initContext } from "@/libs/ai";
import { supportedLanguages } from "@/libs/i18n";
import { selectorAIAssistant, selectorVoiceRecognition } from "@/slicers/settingsSlice";
import { formatVoiceTranscript } from "@/utils/voiceTranscript";
import { toast } from "@/utils/toast";

import { BORDER, COLOR, SHADOW } from "@/constants/styles";

import type { AIModelId } from "@/libs/ai";
import type { ViewStyle } from "react-native";

const KEEP_AWAKE_TAG = "voice-recognition";

interface Props {
  /** Called once with the final, formatted dictation text when the user confirms. */
  onInsert: (text: string) => void;
  /** Offer a one-tap "clean up with AI" action in the dictation sheet (text notes). */
  aiCleanup?: boolean;
  style?: ViewStyle;
}

export default function VoiceRecognitionButton({ onInsert, aiCleanup = false, style = {} }: Props) {
  const selectors = useSelector(selectorVoiceRecognition);
  const aiSettings = useSelector(selectorAIAssistant);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  // AI-cleaned text overrides the raw transcript in the preview until the user
  // dictates again or inserts it.
  const [cleanedText, setCleanedText] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en-US");

  const aiAvailable = aiCleanup && aiSettings.enabled && aiSettings.modelDownloaded;

  const activeLangRef = useRef(activeLang);
  activeLangRef.current = activeLang;

  const resolveLang = useCallback(
    () => (selectors.language !== "system" ? selectors.language : Localization.getLocales()[0]?.languageTag || "en-US"),
    [selectors.language]
  );

  useSpeechRecognitionEvent("result", (event) => {
    // new speech discards any AI-cleaned override (back to raw dictation)
    setCleanedText(null);
    const transcript = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      setFinalText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setInterim("");
    } else {
      setInterim(transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    deactivateKeepAwake(KEEP_AWAKE_TAG);
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.warn("Speech recognition error:", event.error, event.message);
    setListening(false);
  });

  const startEngine = useCallback(
    async (reset: boolean) => {
      const currentPermissions = await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync();
      let granted = currentPermissions.granted;
      if (!granted) {
        granted = (await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()).granted;
      }
      if (!granted) {
        setListening(false);
        return;
      }

      if (reset) {
        setFinalText("");
        setInterim("");
      }

      try {
        ExpoSpeechRecognitionModule.start({
          lang: activeLangRef.current,
          interimResults: selectors.interimResults,
          continuous: selectors.continuous,
          maxAlternatives: 1,
        });
        setListening(true);
        activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setListening(false);
      }
    },
    [selectors.interimResults, selectors.continuous]
  );

  const openDictation = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      toast("Not available");
      return;
    }

    const lang = resolveLang();
    setActiveLang(lang);
    activeLangRef.current = lang;

    setCleanedText(null);
    Keyboard.dismiss();
    setSheetOpen(true);
    await startEngine(true);
  }, [resolveLang, startEngine]);

  const stopEngine = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // already stopped
    }
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    setListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopEngine();
    } else {
      startEngine(false);
    }
  }, [listening, stopEngine, startEngine]);

  const closeAndReset = useCallback(() => {
    stopEngine();
    setSheetOpen(false);
    setFinalText("");
    setInterim("");
    setCleanedText(null);
  }, [stopEngine]);

  const preview = useMemo(
    () => formatVoiceTranscript(`${finalText} ${interim}`.trim(), activeLang, { capitalize: true }),
    [finalText, interim, activeLang]
  );

  // what the sheet shows and what Insert commits: the AI-cleaned text if present,
  // otherwise the raw formatted transcript
  const displayTranscript = cleanedText ?? preview;

  const handleConfirm = useCallback(() => {
    stopEngine();
    setSheetOpen(false);
    setFinalText("");
    setInterim("");
    setCleanedText(null);
    if (displayTranscript) onInsert(displayTranscript);
  }, [stopEngine, displayTranscript, onInsert]);

  const handleConfirmWithAI = useCallback(async () => {
    stopEngine();
    if (!displayTranscript) return;

    setProcessing(true);
    try {
      await initContext(aiSettings.selectedModel as AIModelId);
      const result = await generateEditorContent("clean_transcript", displayTranscript);
      // show the cleaned result in the sheet; the user reviews it and taps Insert
      if (result.success && result.text) setCleanedText(result.text);
    } catch (error) {
      console.warn("AI cleanup failed:", error);
    }
    setProcessing(false);
  }, [stopEngine, displayTranscript, aiSettings.selectedModel]);

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
        processing={processing}
        transcript={displayTranscript}
        languageLabel={languageLabel}
        aiAvailable={aiAvailable}
        onToggleListening={toggleListening}
        onCancel={closeAndReset}
        onConfirm={handleConfirm}
        onConfirmWithAI={aiAvailable ? handleConfirmWithAI : undefined}
      />
    </>
  );
}

const BUTTON_SIZE = 40;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 100,
    right: 46,
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
    ...SHADOW.fab,
  },
});
