import lottie from "lottie-web";
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";

import type { ViewStyle } from "react-native";

interface Props {
  source: Record<string, unknown>;
  loop?: boolean;
  autoPlay?: boolean;
  speed?: number;
  style?: ViewStyle;
  onAnimationFinish?: () => void;
  resizeMode?: "contain" | "cover" | "center";
}

/**
 * Web implementation of LottieView that matches the lottie-react-native API
 */
const LottieView = forwardRef(function LottieView(
  { source, loop = false, autoPlay = false, speed = 1, style, onAnimationFinish, resizeMode = "contain" }: Props,
  ref
) {
  const containerRef = useRef(null);
  const animationRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      animationRef.current?.play();
    },
    pause: () => {
      animationRef.current?.pause();
    },
    reset: () => {
      animationRef.current?.goToAndStop(0, true);
    },
  }));

  useEffect(() => {
    if (containerRef.current && !animationRef.current) {
      animationRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay: autoPlay,
        animationData: source,
      });

      animationRef.current.setSpeed(speed);

      if (onAnimationFinish) {
        animationRef.current.addEventListener("complete", () => {
          onAnimationFinish();
        });
      }
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.setSpeed(speed);
    }
  }, [speed]);

  const containerStyle = {
    width: (style?.width as number) || 100,
    height: (style?.height as number) || 100,
  };

  return (
    <View style={style}>
      <div
        ref={containerRef}
        style={{
          width: containerStyle.width,
          height: containerStyle.height,
        }}
      />
    </View>
  );
});

export default LottieView;
