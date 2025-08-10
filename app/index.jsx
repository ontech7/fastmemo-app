import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { Animated, Easing, StyleSheet, Text, TextInput } from "react-native";

import { initFirebase } from "@/libs/firebase";
import { isObjectEmpty } from "@/utils/string";

import { COLOR } from "@/constants/styles";

import lottieJson from "../assets/lottie/Logo_with_Text.json";

export default function LoadingScreen() {
  // lottie splash animation
  const logoAnimRef = useRef(null);

  const [animFinished, setAnimFinished] = useState(false);
  const splashAnim = useRef(new Animated.Value(0)).current;

  const opacityInterpolation = splashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  useEffect(() => {
    Animated.timing(splashAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      // Play lottie after fade in
      setTimeout(() => {
        logoAnimRef.current?.play();
      }, 200);
    });
  }, []);

  const opacityEvent = () => {
    Animated.timing(splashAnim, {
      toValue: 0,
      duration: 150,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && initialRoute) setAnimFinished(true);
    });
  };

  // set initial route
  const router = useRouter();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const runInitialActions = async () => {
      try {
        // block font scaling globally
        disableFontScaling();

        // enable firebase if cloudSync config is available
        const cloudSyncRaw = await AsyncStorage.getItem("@cloudSync");
        const cloudSyncConfig = JSON.parse(cloudSyncRaw ?? "{}");
        if (!isObjectEmpty(cloudSyncConfig)) {
          initFirebase(cloudSyncConfig);
        }

        // if the app is just downloaded, show intro screen
        const firstScreen = await AsyncStorage.getItem("@firstScreen");
        setInitialRoute(!firstScreen ? "/intro" : "/home");
      } catch (error) {
        Sentry.captureException(error);
      }
    };

    runInitialActions();
  }, [router]);

  useEffect(() => {
    if (initialRoute && animFinished) {
      router.replace(initialRoute);
    }
  }, [initialRoute, animFinished]);

  return (
    <Animated.View
      style={[styles.splashContainer, { opacity: opacityInterpolation }]}
      pointerEvents={!animFinished ? "auto" : "none"}
    >
      <LottieView
        ref={logoAnimRef}
        style={styles.lottieLogo}
        source={lottieJson}
        loop={false}
        resizeMode="contain"
        onAnimationFinish={opacityEvent}
      />
    </Animated.View>
  );
}

function disableFontScaling() {
  // @ts-ignore
  Text.defaultProps = Text.defaultProps || {};
  // @ts-ignore
  TextInput.defaultProps = TextInput.defaultProps || {};
  // @ts-ignore
  Text.defaultProps.allowFontScaling = false;
  // @ts-ignore
  TextInput.defaultProps.allowFontScaling = false;
}

/* STYLES */

const styles = StyleSheet.create({
  splashContainer: {
    zIndex: 2,
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    width: "100%",
    backgroundColor: COLOR.darkBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  lottieLogo: {
    width: 150,
    height: 150,
  },
});
