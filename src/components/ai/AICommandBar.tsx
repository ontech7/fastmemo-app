import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import type { AIToolCall } from "@/libs/ai";
import { cancelCommand, executeToolCall, initContext, processCommand } from "@/libs/ai";
import { storeSecretCodeCallback } from "@/libs/registry";
import { selectorAIAssistant, selectorIsFingerprintEnabled, selectorVoiceRecognition } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";
import * as Localization from "expo-localization";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MicrophoneIcon, PaperAirplaneIcon, SparklesIcon, XMarkIcon } from "react-native-heroicons/outline";
import { CheckCircleIcon, ExclamationCircleIcon } from "react-native-heroicons/solid";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSelector } from "react-redux";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ANIM_OPEN = 300;
const ANIM_CLOSE = 200;
const FEEDBACK_DURATION_SUCCESS = 1200;
const FEEDBACK_DURATION_ERROR = 2500;
const FEEDBACK_DURATION_HELP = 6000;

const AI_GLOW_PRIMARY = "#6C63FF";
const AI_GLOW_SECONDARY = "#00D9FF";

type FeedbackState = "idle" | "processing" | "success" | "error";

interface Props {
  onVisibilityChange?: (visible: boolean) => void;
}

export default function AICommandBar({ onVisibilityChange }: Props) {
  const { t } = useTranslation();

  const router = useRouter();
  const isFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const aiSettings = useSelector(selectorAIAssistant);
  const voiceSettings = useSelector(selectorVoiceRecognition);

  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingToolCall = useRef<AIToolCall | null>(null);
  const voiceDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTranscript = useRef("");
  const cancelledRef = useRef(false);

  const isVoiceOnly = aiSettings.voiceOnly === true;
  const [voiceWaiting, setVoiceWaiting] = useState(false);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  const backdropOpacity = useSharedValue(0);
  const barOpacity = useSharedValue(0);
  const barTranslateY = useSharedValue(30);
  const barGlow = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      barGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      barGlow.value = 0;
    }
  }, [isOpen]);

  const VOICE_SILENCE_TIMEOUT = 2000;

  const cancelVoiceDebounce = useCallback(() => {
    if (voiceDebounce.current) {
      clearTimeout(voiceDebounce.current);
      voiceDebounce.current = null;
    }
  }, []);

  const submitVoice = useCallback(() => {
    cancelVoiceDebounce();
    setVoiceWaiting(false);
    const text = accumulatedTranscript.current.trim();
    if (text) {
      ExpoSpeechRecognitionModule.stop();
      setIsRecognizing(false);
      handleSubmit(text);
    }
    accumulatedTranscript.current = "";
  }, [cancelVoiceDebounce]);

  useSpeechRecognitionEvent("result", (event) => {
    if (!isOpen || !voiceSettings.enabled) return;

    const transcript = event.results[0]?.transcript || "";

    if (event.isFinal) {
      // Accumulate final segments (continuous mode sends multiple finals)
      accumulatedTranscript.current = accumulatedTranscript.current
        ? `${accumulatedTranscript.current} ${transcript}`.trim()
        : transcript;
      setInputText(accumulatedTranscript.current);

      // Reset debounce: wait for more speech or submit after silence
      cancelVoiceDebounce();
      setVoiceWaiting(true);
      voiceDebounce.current = setTimeout(() => submitVoice(), VOICE_SILENCE_TIMEOUT);
    } else {
      // Interim: show accumulated + current segment
      const display = accumulatedTranscript.current ? `${accumulatedTranscript.current} ${transcript}`.trim() : transcript;
      setInputText(display);

      // User is still speaking, reset debounce
      cancelVoiceDebounce();
      setVoiceWaiting(false);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (isOpen) {
      // Recognition ended (could be system-initiated in continuous mode)
      // If we have accumulated text and nothing submitted yet, submit it
      const text = accumulatedTranscript.current.trim();
      if (text && feedback === "idle") {
        cancelVoiceDebounce();
        setIsRecognizing(false);
        handleSubmit(text);
        accumulatedTranscript.current = "";
      } else {
        setIsRecognizing(false);
      }
    }
  });

  useSpeechRecognitionEvent("error", () => {
    if (isOpen) {
      cancelVoiceDebounce();
      setIsRecognizing(false);
      accumulatedTranscript.current = "";
    }
  });

  const openAiAssistant = useCallback(() => {
    if (!aiSettings.enabled || !aiSettings.modelDownloaded) {
      router.push("/settings/ai-assistant" as never);
      return;
    }

    initContext(aiSettings.selectedModel);
    setIsVisible(true);
    setIsOpen(true);

    // In voice-only mode, start listening immediately after opening
    if (isVoiceOnly && voiceSettings.enabled) {
      setTimeout(() => handleVoice(), ANIM_OPEN + 100);
    }
  }, [aiSettings, router, isVoiceOnly, voiceSettings.enabled]);

  const onCloseAnimationDone = useCallback(() => {
    "worklet";
    runOnJS(setIsVisible)(false);
  }, []);

  const closeAiAssistant = useCallback(() => {
    if (isRecognizing) {
      ExpoSpeechRecognitionModule.stop();
      setIsRecognizing(false);
    }
    cancelVoiceDebounce();
    accumulatedTranscript.current = "";
    Keyboard.dismiss();

    setInputText("");
    setFeedback("idle");
    setFeedbackMessage("");
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }

    // Trigger close animation (component stays mounted until animation ends)
    setIsOpen(false);
  }, [isRecognizing]);

  const hasBeenOpen = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasBeenOpen.current = true;
      backdropOpacity.value = withTiming(1, { duration: ANIM_OPEN, easing: Easing.out(Easing.cubic) });
      barOpacity.value = withTiming(1, { duration: ANIM_OPEN, easing: Easing.out(Easing.cubic) });
      barTranslateY.value = withTiming(0, { duration: ANIM_OPEN, easing: Easing.out(Easing.cubic) });
      if (!isVoiceOnly) {
        setTimeout(() => inputRef.current?.focus(), ANIM_OPEN);
      }
    } else if (isVisible && hasBeenOpen.current) {
      hasBeenOpen.current = false;
      backdropOpacity.value = withTiming(0, { duration: ANIM_CLOSE, easing: Easing.in(Easing.cubic) });
      barTranslateY.value = withTiming(30, { duration: ANIM_CLOSE, easing: Easing.in(Easing.cubic) });
      barOpacity.value = withTiming(0, { duration: ANIM_CLOSE, easing: Easing.in(Easing.cubic) }, onCloseAnimationDone);
    }
  }, [isOpen, isVisible]);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isVisible) {
        closeAiAssistant();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isVisible, closeAiAssistant]);

  useEffect(() => {
    if (feedback === "success" || feedback === "error") {
      const isHelp = feedbackMessage.includes("\n");
      const duration = isHelp
        ? FEEDBACK_DURATION_HELP
        : feedback === "success"
          ? FEEDBACK_DURATION_SUCCESS
          : FEEDBACK_DURATION_ERROR;
      feedbackTimer.current = setTimeout(() => closeAiAssistant(), duration);
      return () => {
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      };
    }
  }, [feedback, feedbackMessage, closeAiAssistant]);

  const handleToolResult = useCallback(
    (toolCall: AIToolCall, result: ReturnType<typeof executeToolCall>) => {
      if (result.success) {
        setFeedback("success");
        switch (toolCall.action) {
          case "create_note":
            setFeedbackMessage(t("ai.feedback.note_created", { title: result.message }));
            break;
          case "toggle_note_property":
            setFeedbackMessage(t("ai.feedback.property_toggled", { count: Number(result.message) }));
            break;
          case "delete_note":
            setFeedbackMessage(t("ai.feedback.note_deleted", { count: Number(result.message) }));
            break;
          case "change_note_category":
            setFeedbackMessage(t("ai.feedback.category_changed", { count: Number(result.message) }));
            break;
          case "rename_note":
            setFeedbackMessage(t("ai.feedback.note_renamed", { title: result.message }));
            break;
          case "add_todo_items":
            setFeedbackMessage(t("ai.feedback.items_added", { count: Number(result.message) }));
            break;
          case "create_category":
            setFeedbackMessage(t("ai.feedback.category_created", { name: result.message }));
            break;
          case "restore_note":
            setFeedbackMessage(t("ai.feedback.note_restored", { count: Number(result.message) }));
            break;
          case "switch_category":
            setFeedbackMessage(t("ai.feedback.category_switched", { name: result.message }));
            break;
          case "convert_note":
            setFeedbackMessage(t("ai.feedback.note_converted", { title: result.message }));
            break;
          case "merge_notes":
            setFeedbackMessage(t("ai.feedback.notes_merged", { title: result.message }));
            break;
          case "change_setting":
            setFeedbackMessage(t("ai.feedback.setting_changed"));
            break;
          case "show_help":
            setFeedbackMessage(t("ai.feedback.help_message"));
            break;
          default:
            setFeedbackMessage(t("ai.feedback.done"));
        }
      } else if (result.message === "requires_auth") {
        pendingToolCall.current = toolCall;
        closeAiAssistant();

        const executeAfterAuth = () => {
          if (!pendingToolCall.current) return;
          const savedCall = pendingToolCall.current;
          pendingToolCall.current = null;
          const retryResult = executeToolCall(savedCall, { bypassAuth: true });
          if (retryResult.message === "requires_auth") {
            setIsVisible(true);
            setIsOpen(true);
            setFeedback("error");
            setFeedbackMessage(t("ai.feedback.error"));
            return;
          }
          setIsVisible(true);
          setIsOpen(true);
          handleToolResult(savedCall, retryResult);
        };

        const isFingerprint = Platform.OS !== "web" && isFingerprintEnabled;

        if (isFingerprint) {
          const LocalAuthentication = require("expo-local-authentication");
          LocalAuthentication.authenticateAsync().then((authResult: { success: boolean }) => {
            if (authResult?.success) {
              executeAfterAuth();
            } else {
              pendingToolCall.current = null;
            }
          });
        } else {
          storeSecretCodeCallback(() => {
            router.back();
            setTimeout(() => executeAfterAuth(), 500);
          });

          router.push({
            pathname: "/secret-code",
            params: { startPhase: "unlockCode" },
          } as never);
        }
      } else {
        setFeedback("error");
        switch (result.message) {
          case "no_notes_found":
            setFeedbackMessage(t("ai.feedback.no_notes_found"));
            break;
          case "category_not_found":
            setFeedbackMessage(t("ai.feedback.category_not_found"));
            break;
          case "not_todo_note":
            setFeedbackMessage(t("ai.feedback.not_todo_note"));
            break;
          case "category_exists":
            setFeedbackMessage(t("ai.feedback.category_exists"));
            break;
          case "same_type":
            setFeedbackMessage(t("ai.feedback.same_type"));
            break;
          default:
            setFeedbackMessage(t("ai.feedback.error"));
        }
      }
    },
    [t, closeAiAssistant, router, isFingerprintEnabled]
  );

  const handleSubmit = useCallback(
    async (text?: string) => {
      const command = (text || inputText).trim();
      if (!command) return;

      Keyboard.dismiss();
      setFeedback("processing");
      cancelledRef.current = false;

      try {
        const response = await processCommand(command);

        if (cancelledRef.current) return;

        console.log("[AI] Response:", JSON.stringify(response));

        if (response.success && response.toolCall) {
          const result = executeToolCall(response.toolCall);
          handleToolResult(response.toolCall, result);
        } else if (response.success && response.message) {
          setFeedback("error");
          setFeedbackMessage(t("ai.feedback.not_understood"));
        } else {
          setFeedback("error");
          setFeedbackMessage(t("ai.feedback.error"));
        }
      } catch {
        if (cancelledRef.current) return;
        setFeedback("error");
        setFeedbackMessage(t("ai.feedback.error"));
      }
    },
    [inputText, t, handleToolResult]
  );

  const handleVoice = useCallback(async () => {
    if (isRecognizing) {
      ExpoSpeechRecognitionModule.stop();
      setIsRecognizing(false);
      return;
    }

    try {
      const isAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!isAvailable) {
        toast(t("ai.feedback.voice_unavailable"));
        return;
      }

      const permissions = await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync();
      let granted = permissions.granted;
      if (!granted) {
        const result = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
        granted = result.granted;
      }
      if (!granted) return;

      setIsRecognizing(true);
      setInputText("");
      accumulatedTranscript.current = "";
      cancelVoiceDebounce();

      ExpoSpeechRecognitionModule.start({
        lang:
          voiceSettings.language !== "system" ? voiceSettings.language : Localization.getLocales()[0].languageTag || "en-US",
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
      });
    } catch (error) {
      console.error("[AI] Voice recognition error:", error);
      setIsRecognizing(false);
    }
  }, [isRecognizing, voiceSettings, t]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const barStyle = useAnimatedStyle(() => ({
    opacity: barOpacity.value,
    transform: [{ translateY: barTranslateY.value }],
  }));

  const barGlowStyle = useAnimatedStyle(() => ({
    borderWidth: 1.5,
    borderColor: feedback === "processing" ? AI_GLOW_SECONDARY : `rgba(108, 99, 255, ${0.3 + barGlow.value * 0.5})`,
    shadowColor: AI_GLOW_PRIMARY,
    shadowOpacity: 0.2 + barGlow.value * 0.3,
    shadowRadius: 8 + barGlow.value * 8,
  }));

  // Hidden when AI is disabled or model not downloaded
  if (!aiSettings.enabled || !aiSettings.modelDownloaded) {
    return null;
  }

  return (
    <>
      {isVisible && (
        <>
          <AnimatedPressable
            style={[styles.backdrop, backdropStyle]}
            onPress={feedback === "idle" ? closeAiAssistant : undefined}
          />

          <Animated.View style={[styles.bar, barStyle, barGlowStyle]}>
            {feedback === "idle" && !isVoiceOnly && (
              <View style={styles.inputContainer}>
                <TouchableOpacity onPress={closeAiAssistant} style={styles.iconButton}>
                  <XMarkIcon size={18} color={COLOR.lightBlue} />
                </TouchableOpacity>

                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={t("ai.placeholder")}
                  placeholderTextColor={COLOR.placeholder}
                  cursorColor={AI_GLOW_SECONDARY}
                  onSubmitEditing={() => handleSubmit()}
                  returnKeyType="send"
                  editable={!isRecognizing}
                  selectionColor={`${AI_GLOW_PRIMARY}40`}
                />

                {voiceSettings.enabled && (
                  <TouchableOpacity onPress={handleVoice} style={[styles.iconButton, isRecognizing && styles.iconButtonActive]}>
                    <MicrophoneIcon size={18} color={isRecognizing ? COLOR.darkBlue : COLOR.lightBlue} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => handleSubmit()} style={styles.iconButton} disabled={!inputText.trim()}>
                  <PaperAirplaneIcon size={18} color={inputText.trim() ? AI_GLOW_SECONDARY : COLOR.placeholder} />
                </TouchableOpacity>
              </View>
            )}

            {feedback === "idle" && isVoiceOnly && (
              <View style={styles.voiceOnlyContainer}>
                <TouchableOpacity onPress={closeAiAssistant} style={styles.iconButton}>
                  <XMarkIcon size={18} color={COLOR.lightBlue} />
                </TouchableOpacity>

                <Text style={styles.voiceOnlyText} numberOfLines={2}>
                  {isRecognizing ? inputText || t("ai.listening") : t("ai.tap_to_speak")}
                </Text>
                {voiceWaiting && <Text style={styles.voiceWaitingHint}>{t("ai.sending_soon")}</Text>}

                {isRecognizing && inputText.trim() ? (
                  <TouchableOpacity onPress={submitVoice} style={styles.voiceFab}>
                    <PaperAirplaneIcon size={22} color={AI_GLOW_SECONDARY} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleVoice} style={[styles.voiceFab, isRecognizing && styles.voiceFabActive]}>
                    <MicrophoneIcon size={22} color={isRecognizing ? COLOR.darkBlue : COLOR.softWhite} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {feedback === "processing" && (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={AI_GLOW_SECONDARY} />
                <Text style={styles.statusText}>{t("ai.processing")}</Text>
                <TouchableOpacity
                  onPress={() => {
                    cancelledRef.current = true;
                    cancelCommand();
                    setFeedback("idle");
                    setInputText("");
                  }}
                  style={styles.cancelButton}
                >
                  <XMarkIcon size={20} color={COLOR.softWhite} />
                </TouchableOpacity>
              </View>
            )}

            {(feedback === "success" || feedback === "error") && (
              <View style={styles.statusContainer}>
                {feedback === "success" ? (
                  <CheckCircleIcon size={20} color="#4CAF50" />
                ) : (
                  <ExclamationCircleIcon size={20} color={COLOR.important} />
                )}
                <Text style={styles.statusText} numberOfLines={6}>
                  {feedbackMessage}
                </Text>
              </View>
            )}
          </Animated.View>
        </>
      )}

      {!isVisible && (
        <TouchableOpacity style={styles.sparkleButton} activeOpacity={0.7} onPress={openAiAssistant}>
          {isVoiceOnly ? (
            <MicrophoneIcon size={24} color={COLOR.softWhite} />
          ) : (
            <SparklesIcon size={24} color={COLOR.softWhite} />
          )}
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    zIndex: 5,
  },
  bar: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    minHeight: 48,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.blue,
    overflow: "hidden",
    elevation: 8,
    zIndex: 10,
  },
  sparkleButton: {
    position: "absolute",
    bottom: 130,
    right: 42,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: AI_GLOW_PRIMARY,
    shadowColor: AI_GLOW_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
  },
  iconButton: {
    padding: PADDING_MARGIN.sm,
  },
  iconButtonActive: {
    backgroundColor: AI_GLOW_SECONDARY,
    borderRadius: BORDER.small,
  },
  input: {
    flex: 1,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.sm,
    gap: PADDING_MARGIN.sm,
  },
  statusText: {
    flex: 1,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.small,
    fontWeight: FONTWEIGHT.regular,
  },
  voiceOnlyContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
    gap: PADDING_MARGIN.sm,
  },
  voiceOnlyText: {
    flex: 1,
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.medium,
    fontStyle: "italic",
  },
  voiceFab: {
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.small,
    backgroundColor: COLOR.blue,
  },
  voiceFabActive: {
    backgroundColor: AI_GLOW_SECONDARY,
  },
  cancelButton: {
    padding: PADDING_MARGIN.sm,
  },
  voiceWaitingHint: {
    color: AI_GLOW_SECONDARY,
    fontSize: FONTSIZE.small,
    fontStyle: "italic",
    position: "absolute",
    right: PADDING_MARGIN.sm + 40,
    opacity: 0.7,
  },
});
