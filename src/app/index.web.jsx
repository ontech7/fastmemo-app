import * as Sentry from "@sentry/react-native";
import i18n from "i18next";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import LottieView from "@/components/lottie/LottieAnimation";
import { useRouter } from "@/hooks/useRouter";
import { initFirebase } from "@/libs/firebase";
import { getLocales } from "@/libs/localization";
import { AsyncStorage } from "@/libs/storage";
import { isObjectEmpty } from "@/utils/string";

import { COLOR } from "@/constants/styles";

import lottieJson from "../assets/lottie/Logo_with_Text.json";

export default function LoadingScreen() {
  const logoAnimRef = useRef(null);
  const router = useRouter();
  const [initialRoute, setInitialRoute] = useState(null);
  const [opacity, setOpacity] = useState(0);
  const [animationFinished, setAnimationFinished] = useState(false);

  const handleLottieFinish = () => {
    setAnimationFinished(true);
  };

  useEffect(() => {
    if (animationFinished && initialRoute) {
      setOpacity(0);
      setTimeout(() => {
        router.replace(initialRoute);
      }, 150);
    }
  }, [animationFinished, initialRoute, router]);

  useEffect(() => {
    setTimeout(() => {
      setOpacity(1);
      setTimeout(() => {
        logoAnimRef.current?.play();
      }, 150);
    }, 10);
  }, []);

  useEffect(() => {
    const runInitialActions = async () => {
      try {
        // set app language
        const language = await AsyncStorage.getItem("@appLanguage");
        const locales = getLocales();
        i18n.changeLanguage(language && language !== "system" ? language : locales[0]?.languageCode || "en");

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
  }, []);

  return (
    <View
      style={[
        styles.splashContainer,
        { opacity, transitionProperty: "opacity", transitionDuration: "0.12s", transitionTimingFunction: "ease-in-out" },
      ]}
    >
      <LottieView
        ref={logoAnimRef}
        style={styles.lottieLogo}
        source={lottieJson}
        loop={false}
        onAnimationFinish={handleLottieFinish}
        speed={1.32}
      />
    </View>
  );
}

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
