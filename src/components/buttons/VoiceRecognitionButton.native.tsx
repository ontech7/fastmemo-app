import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Localization from "expo-localization";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useState } from "react";
import { Keyboard, StyleSheet, TouchableOpacity, View } from "react-native";
import { MicrophoneIcon } from "react-native-heroicons/outline";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSelector } from "react-redux";

import { selectorVoiceRecognition } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";

import { BORDER, COLOR } from "@/constants/styles";

import type { ViewStyle } from "react-native";

const KEEP_AWAKE_TAG = "voice-recognition";

interface Props {
  setTranscript: (transcript: string, isFinal: boolean) => void;
  style?: ViewStyle;
}

export default function VoiceRecognitionButton({ setTranscript, style = {} }: Props) {
  const [recognizing, setRecognizing] = useState(false);

  const selectors = useSelector(selectorVoiceRecognition);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useSpeechRecognitionEvent("start", () => {
    if (selectors.enabled && !selectors.continuous) {
      setRecognizing(true);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (selectors.enabled && !selectors.continuous) {
      setRecognizing(false);
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (selectors.enabled) {
      setTranscript(event.results[0]?.transcript || "", event.isFinal);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.warn("Speech recognition error:", event.error, event.message);
    setRecognizing(false);
  });

  // Pulse animation + keep-awake
  useEffect(() => {
    if (recognizing) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0, { duration: 200 });
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    }

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [recognizing]);

  const handleStart = async () => {
    try {
      const isAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();

      if (!isAvailable) {
        toast("Not available");
        console.warn("Speech recognition not available");
        return;
      }

      const currentPermissions = await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync();

      let permissionGranted = currentPermissions.granted;

      if (!permissionGranted) {
        const result = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
        permissionGranted = result.granted;
      }

      if (!permissionGranted) {
        console.warn("Permissions not granted");
        setRecognizing(false);
        return;
      }

      Keyboard.dismiss();
      setRecognizing(true);

      ExpoSpeechRecognitionModule.start({
        lang: selectors.language !== "system" ? selectors.language : Localization.getLocales()[0].languageTag || "en-US",
        interimResults: selectors.interimResults,
        continuous: selectors.continuous,
        maxAlternatives: 1,
      });
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setRecognizing(false);
    }
  };

  const handleStop = () => {
    setRecognizing(false);
    ExpoSpeechRecognitionModule.stop();
  };

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  if (!selectors.enabled) return null;

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.View style={[styles.pulseRing, pulseRingStyle]} />

      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.button, recognizing && styles.buttonActive]}
        onPress={recognizing ? handleStop : handleStart}
      >
        {recognizing ? <View style={styles.stopIcon} /> : <MicrophoneIcon size={24} color={COLOR.darkBlue} />}
      </TouchableOpacity>
    </View>
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
  pulseRing: {
    position: "absolute",
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.important,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  buttonActive: {
    backgroundColor: COLOR.important,
  },
  stopIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: COLOR.softWhite,
  },
});
