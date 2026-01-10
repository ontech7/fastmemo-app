import { useEffect, useRef, useState } from "react";
import * as Localization from "expo-localization";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { MicrophoneIcon } from "react-native-heroicons/outline";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSelector } from "react-redux";

import { toast } from "@/utils/toast";
import { selectorVoiceRecognition } from "@/slicers/settingsSlice";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

const { width: WIDTH_SCREEN } = Dimensions.get("window");

export default function VoiceRecognitionButton({ setTranscript, style = {} }) {
  const [recognizing, setRecognizing] = useState(false);

  const selectors = useSelector(selectorVoiceRecognition);

  const barsRef = useRef(Array.from({ length: 20 }, () => useSharedValue(6)));

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

  const panelWidth = useSharedValue(52);

  useEffect(() => {
    let interval;

    if (recognizing) {
      interval = setInterval(() => {
        barsRef.current.forEach((bar) => {
          const newHeight = 6 + Math.random() * 25;

          bar.value = withTiming(newHeight, {
            duration: 150,
            easing: Easing.inOut(Easing.ease),
          });
        });
      }, 150);
    }

    return () => clearInterval(interval);
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

  const handleStop = async () => {
    setRecognizing(false);

    ExpoSpeechRecognitionModule.stop();
  };

  useEffect(() => {
    if (!recognizing) {
      panelWidth.value = withSpring(52, { damping: 15 });
    } else {
      panelWidth.value = withSpring(WIDTH_SCREEN * 0.9 - 32, { damping: 15 });
    }
  }, [recognizing]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    width: panelWidth.value,
  }));

  return selectors.enabled ? (
    <Animated.View style={[styles.container, style, containerAnimatedStyle]}>
      {recognizing && (
        <View style={styles.waveContainer}>
          {barsRef.current.map((bar, i) => (
            <AnimatedBar key={i} sharedValue={bar} />
          ))}
        </View>
      )}

      <TouchableOpacity activeOpacity={0.7} style={styles.registerButton} onPress={recognizing ? handleStop : handleStart}>
        <MicrophoneIcon size={28} color={COLOR.darkBlue} />
      </TouchableOpacity>
    </Animated.View>
  ) : null;
}

function AnimatedBar({ sharedValue }) {
  const animatedStyle = useAnimatedStyle(() => ({
    height: sharedValue.value,
  }));

  return <Animated.View style={[styles.bar, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    position: "absolute",
    bottom: 100,
    right: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
    overflow: "hidden",
  },
  waveContainer: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: COLOR.darkBlue,
    marginHorizontal: 1,
  },
  registerButton: {
    padding: PADDING_MARGIN.md,
  },
});
