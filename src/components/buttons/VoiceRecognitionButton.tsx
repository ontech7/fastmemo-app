import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Localization from "expo-localization";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, StyleSheet, TouchableOpacity, View } from "react-native";
import MicrophoneIcon from "react-native-heroicons/outline/MicrophoneIcon";
import { useSelector } from "react-redux";

import DictationSheet from "@/components/voice/DictationSheet";
import { cancelCommand, completedJsonStrings, createTextStream, generateEditorContent, prewarmContext } from "@/libs/ai";
import { supportedLanguages } from "@/libs/i18n";
import { selectorAIAssistant, selectorVoiceRecognition } from "@/slicers/settingsSlice";
import { formatVoiceTranscript } from "@/utils/voiceTranscript";
import { toast } from "@/utils/toast";

import { BORDER, COLOR, SHADOW } from "@/constants/styles";

import type { ViewStyle } from "react-native";

const KEEP_AWAKE_TAG = "voice-recognition";

interface Props {
  /** Called once with the final, formatted dictation text when the user confirms. */
  onInsert: (text: string) => void;
  /** Offer a one-tap "clean up with AI" action in the dictation sheet (text notes). */
  aiCleanup?: boolean;
  /** The AI cleanup splits the dictation into checklist items, one per line (todo notes). */
  asItems?: boolean;
  style?: ViewStyle;
}

/** How a checklist item shows in the sheet (`voiceTextToLines` drops the bullet on insert). */
const itemsToText = (items: string[]) => items.map((item) => `• ${item}`).join("\n");

export default function VoiceRecognitionButton({ onInsert, aiCleanup = false, asItems = false, style = {} }: Props) {
  const { t } = useTranslation();

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
  // Why the last AI cleanup gave nothing (shown in the sheet: a toast would sit under it).
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en-US");

  const aiAvailable = aiCleanup && aiSettings.enabled && aiSettings.modelDownloaded;

  const activeLangRef = useRef(activeLang);
  activeLangRef.current = activeLang;

  // Each AI cleanup gets a number: a cancelled or superseded one never writes into the sheet.
  const aiRunRef = useRef(0);
  // `processing`, readable from the speech events and the unmount without waiting for a render
  const processingRef = useRef(false);
  // What the sheet showed before the cleanup started, put back if it is cancelled or fails.
  const beforeAIRef = useRef<string | null>(null);

  // Leaving the note mid-cleanup stops the model (it would keep the context busy for nothing) and drops its answer.
  useEffect(
    () => () => {
      aiRunRef.current++;
      if (processingRef.current) cancelCommand();
    },
    []
  );

  const resolveLang = useCallback(
    () => (selectors.language !== "system" ? selectors.language : Localization.getLocales()[0]?.languageTag || "en-US"),
    [selectors.language]
  );

  useSpeechRecognitionEvent("result", (event) => {
    // new speech discards any AI-cleaned override (back to raw dictation); not the last words landing after the stop that
    // started a cleanup
    if (!processingRef.current) {
      setCleanedText(null);
      setAiNotice(null);
    }
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
    setAiNotice(null);
    Keyboard.dismiss();
    setSheetOpen(true);
    // The user talks for a while: the model loads meanwhile, so the AI button answers at once.
    if (aiAvailable) prewarmContext(aiSettings.selectedModel);
    await startEngine(true);
  }, [resolveLang, startEngine, aiAvailable, aiSettings.selectedModel]);

  const stopEngine = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // already stopped
    }
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    setListening(false);
  }, []);

  const cancelAI = useCallback(() => {
    aiRunRef.current++;
    cancelCommand();
    processingRef.current = false;
    setProcessing(false);
    setCleanedText(beforeAIRef.current);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopEngine();
    } else {
      if (processingRef.current) cancelAI();
      startEngine(false);
    }
  }, [listening, stopEngine, startEngine, cancelAI]);

  const closeAndReset = useCallback(() => {
    stopEngine();
    setSheetOpen(false);
    setFinalText("");
    setInterim("");
    setCleanedText(null);
  }, [stopEngine]);

  // While the AI works, Cancel (or Back, or the backdrop) stops the AI and keeps the dictation: it never throws away what
  // the user said.
  const handleCancel = useCallback(() => {
    if (processing) cancelAI();
    else closeAndReset();
  }, [processing, cancelAI, closeAndReset]);

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

    const run = ++aiRunRef.current;
    beforeAIRef.current = cleanedText;
    processingRef.current = true;
    setProcessing(true);
    setAiNotice(null);
    // the cleaned text replaces the dictation word by word (item by item) as the model writes it
    const stream = createTextStream((text) => {
      const shown = asItems ? itemsToText(completedJsonStrings(text)) : text;
      if (run === aiRunRef.current && shown) setCleanedText(shown);
    });
    let cleaned: string | null = null;
    let error: string | undefined;
    try {
      const result = await generateEditorContent(
        asItems ? "transcript_to_items" : "clean_transcript",
        displayTranscript,
        stream.push
      );
      if (result.success && asItems && result.items?.length) cleaned = itemsToText(result.items);
      else if (result.success && !asItems && result.text) cleaned = result.text;
      else error = result.error;
    } catch (e) {
      console.warn("AI cleanup failed:", e);
    }
    stream.stop();
    if (run !== aiRunRef.current) return;
    // the user reviews the result in the sheet and taps Insert; a failure puts back what was there
    setCleanedText(cleaned ?? beforeAIRef.current);
    processingRef.current = false;
    setProcessing(false);
    if (!cleaned && error !== "cancelled") {
      setAiNotice(
        error === "implausible_output"
          ? t("ai.editor.no_improvement")
          : error === "too_long"
            ? t("ai.editor.too_long")
            : t("ai.editor.error")
      );
    }
  }, [stopEngine, displayTranscript, cleanedText, asItems, t]);

  const languageLabel = useMemo(() => {
    const prefix = activeLang.split("-")[0];
    return supportedLanguages[prefix]?.name ?? activeLang;
  }, [activeLang]);

  if (!selectors.enabled) return null;

  return (
    <>
      <View style={[styles.wrapper, style]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.button}
          onPress={openDictation}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.dictate")}
        >
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
        notice={aiNotice}
        onToggleListening={toggleListening}
        onCancel={handleCancel}
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
