import { useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { MicrophoneIcon } from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

import { getLocales } from "@/libs/localization";
import { selectorVoiceRecognition } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";

import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

const { width: WIDTH_SCREEN } = Dimensions.get("window");

export default function VoiceRecognitionButton({ setTranscript, style = {} }) {
  const [recognizing, setRecognizing] = useState(false);
  const recognitionRef = useRef(null);
  const [barHeights, setBarHeights] = useState(Array(20).fill(6));

  const selectors = useSelector(selectorVoiceRecognition);

  const isSpeechAvailable =
    typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    if (!isSpeechAvailable) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = selectors.continuous || false;
    recognitionRef.current.interimResults = selectors.interimResults || true;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      setTranscript(transcript, isFinal);
    };

    recognitionRef.current.onend = () => {
      setRecognizing(false);
    };

    recognitionRef.current.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      setRecognizing(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [selectors.continuous, selectors.interimResults]);

  useEffect(() => {
    let interval;

    if (recognizing) {
      interval = setInterval(() => {
        setBarHeights(
          Array(20)
            .fill(0)
            .map(() => 6 + Math.random() * 25)
        );
      }, 150);
    } else {
      setBarHeights(Array(20).fill(6));
    }

    return () => clearInterval(interval);
  }, [recognizing]);

  const handleStart = () => {
    if (!isSpeechAvailable) {
      toast("Speech recognition not available in this browser");
      return;
    }

    try {
      const locales = getLocales();
      const lang = selectors.language !== "system" ? selectors.language : locales[0]?.languageTag || "en-US";

      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
      setRecognizing(true);
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setRecognizing(false);
    }
  };

  const handleStop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setRecognizing(false);
  };

  if (!selectors.enabled) return null;

  return (
    <View style={[styles.container, style, { width: recognizing ? WIDTH_SCREEN * 0.9 - 32 : 52 }]}>
      {recognizing && (
        <View style={styles.waveContainer}>
          {barHeights.map((height, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { height, transitionProperty: "height", transitionDuration: "0.15s", transitionTimingFunction: "ease-in-out" },
              ]}
            />
          ))}
        </View>
      )}

      <TouchableOpacity activeOpacity={0.7} style={styles.registerButton} onPress={recognizing ? handleStop : handleStart}>
        <MicrophoneIcon size={28} color={COLOR.darkBlue} />
      </TouchableOpacity>
    </View>
  );
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
    transitionProperty: "width",
    transitionDuration: "0.3s",
    transitionTimingFunction: "ease-out",
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
