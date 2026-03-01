import LottieView from "@/components/lottie/LottieAnimation";
import { COLOR } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { initFirebase } from "@/libs/firebase";
import { getLocales } from "@/libs/localization";
import { isObjectEmpty } from "@/utils/string";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import i18n from "i18next";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import lottieJson from "../assets/lottie/Logo_with_Text.json";

export default function LoadingScreen() {
  const logoAnimRef = useRef(null);
  const router = useRouter();

  const [showLottie, setShowLottie] = useState(null);

  const handleLottieFinish = () => {
    setTimeout(() => {
      router.replace("/intro");
    }, 150);
  };

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

        const firstScreen = await AsyncStorage.getItem("@firstScreen");

        if (!firstScreen) {
          // first launch
          setShowLottie(true);
        } else {
          // already configured
          router.replace("/home");
        }
      } catch (error) {
        router.replace("/home");
        Sentry.captureException(error);
      }
    };

    runInitialActions();
  }, []);

  useEffect(() => {
    if (showLottie) {
      setTimeout(() => {
        logoAnimRef.current?.play();
      }, 150);
    }
  }, [showLottie]);

  return (
    <View style={styles.splashContainer}>
      {showLottie && (
        <LottieView
          ref={logoAnimRef}
          style={styles.lottieLogo}
          source={lottieJson}
          loop={false}
          autoPlay={false}
          onAnimationFinish={handleLottieFinish}
          speed={1.32}
        />
      )}
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
