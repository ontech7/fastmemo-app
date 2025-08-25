import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import LottieView from "lottie-react-native";
import { StyleSheet } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { initFirebase } from "@/libs/firebase";
import { isObjectEmpty } from "@/utils/string";
import { useRouter } from "@/hooks/useRouter";

import { COLOR } from "@/constants/styles";

import lottieJson from "../assets/lottie/Logo_with_Text.json";

export default function LoadingScreen() {
  // lottie splash animation
  const logoAnimRef = useRef(null);

  const progress = useSharedValue(0);

  const splashAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  useEffect(() => {
    const playLottie = () => {
      logoAnimRef.current?.play();
    };

    progress.value = withTiming(1, { duration: 120, easing: Easing.linear }, (finished) => {
      if (finished) {
        runOnJS(playLottie)();
      }
    });
  }, []);

  const handleLottieFinish = () => {
    progress.value = withTiming(0, { duration: 120, easing: Easing.linear }, (finished) => {
      if (finished && initialRoute) {
        runOnJS(router.replace)(initialRoute);
      }
    });
  };

  // set initial route
  const router = useRouter();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const runInitialActions = async () => {
      try {
        // enable firebase if cloudSync config is available
        const cloudSyncRaw = await AsyncStorage.getItem("@cloudSync");
        const cloudSyncConfig = JSON.parse(cloudSyncRaw ?? "{}");
        if (!isObjectEmpty(cloudSyncConfig)) {
          initFirebase(cloudSyncConfig);
        }

        // if the app has just been downloaded, show intro screen
        const firstScreen = await AsyncStorage.getItem("@firstScreen");
        setInitialRoute(!firstScreen ? "/intro" : "/home");
      } catch (error) {
        setInitialRoute("/home");
        Sentry.captureException(error);
      }
    };

    runInitialActions();
  }, [router]);

  return (
    <Animated.View style={[styles.splashContainer, splashAnimStyle]}>
      <LottieView
        ref={logoAnimRef}
        style={styles.lottieLogo}
        source={lottieJson}
        loop={false}
        resizeMode="contain"
        onAnimationFinish={handleLottieFinish}
        speed={1.32}
      />
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
