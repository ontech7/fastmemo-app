import LottieView from "@/components/lottie/LottieAnimation";
import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { initFirebase } from "@/libs/firebase";
import { isObjectEmpty } from "@/utils/string";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import * as Localization from "expo-localization";
import * as SplashScreen from "expo-splash-screen";
import i18n from "i18next";
import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import lottieJson from "../assets/lottie/Logo_with_Text.json";

export default function LoadingScreen() {
  const router = useRouter();
  const logoAnimRef = useRef(null);

  const [showLottie, setShowLottie] = useState(null);

  const progress = useSharedValue(1);

  const splashAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const handleLottieFinish = () => {
    progress.value = withTiming(0, { duration: 120, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(router.replace)("/intro");
    });
  };

  useEffect(() => {
    const runInitialActions = async () => {
      try {
        // set app language
        const language = await AsyncStorage.getItem("@appLanguage");
        i18n.changeLanguage(language && language !== "system" ? language : Localization.getLocales()[0].languageCode || "en");

        // enable firebase if cloudSync config is available
        const cloudSyncRaw = await AsyncStorage.getItem("@cloudSync");
        const cloudSyncConfig = JSON.parse(cloudSyncRaw ?? "{}");
        if (!isObjectEmpty(cloudSyncConfig)) {
          initFirebase(cloudSyncConfig);
        }

        const firstScreen = await AsyncStorage.getItem("@firstScreen");
        SplashScreen.hideAsync().catch(() => {});

        if (!firstScreen) {
          // first launch
          setShowLottie(true);
        } else {
          // already configured
          router.replace("/home");
        }
      } catch (error) {
        SplashScreen.hideAsync().catch(() => {});
        router.replace("/home");
        Sentry.captureException(error);
      }
    };

    runInitialActions();
  }, []);

  useEffect(() => {
    if (showLottie) {
      logoAnimRef.current?.play();
    }
  }, [showLottie]);

  return (
    <Animated.View style={[styles.splashContainer, splashAnimStyle]}>
      {showLottie && (
        <LottieView
          ref={logoAnimRef}
          style={styles.lottieLogo}
          source={lottieJson}
          loop={false}
          autoPlay={false}
          resizeMode="contain"
          onAnimationFinish={handleLottieFinish}
          speed={1.32}
        />
      )}
    </Animated.View>
  );
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
    width: 145,
    height: 145,
  },
});
