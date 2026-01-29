import SafeAreaView from "@/components/SafeAreaView";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import Carousel, { Pagination } from "@ontech7/react-native-snap-carousel";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowRightIcon } from "react-native-heroicons/outline";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");

export default function IntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const carouselRef = useRef(null);

  const [activeItemIndex, setActiveItemIndex] = useState(0);

  const DIMENSION_RATIO = WINDOW_HEIGHT / WINDOW_WIDTH;

  const LIMITER = DIMENSION_RATIO > 1.1 ? 1.1 : DIMENSION_RATIO < 0.8 ? 0.35 : DIMENSION_RATIO;

  const ITEM_WIDTH = Math.round((WINDOW_WIDTH / 2) * LIMITER);
  const ITEM_HEIGHT = Math.round(ITEM_WIDTH * 1.8736);

  const carouselSteps = useMemo(
    () => [
      {
        image: require("../assets/intro/step1.png"),
        description: t("intro.step1"),
      },
      {
        image: require("../assets/intro/step2.png"),
        description: t("intro.step2"),
      },
      {
        image: require("../assets/intro/step3.png"),
        description: t("intro.step3"),
      },
      {
        image: require("../assets/intro/step4.png"),
        description: t("intro.step4"),
      },
      {
        image: require("../assets/intro/step5.png"),
        description: t("intro.step5"),
      },
      {
        image: require("../assets/intro/step6.png"),
        description: t("intro.step6"),
      },
    ],
    [t]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.introTitle}>{t("intro.title")}</Text>

      <View style={styles.carouselWrapper}>
        <Carousel
          disableIntervalMomentum={true}
          ref={carouselRef}
          data={carouselSteps}
          renderItem={({ item }) => <CarouselItem item={item} width={ITEM_WIDTH} height={ITEM_HEIGHT} />}
          sliderWidth={WINDOW_WIDTH}
          itemWidth={ITEM_WIDTH}
          useScrollView={true}
          onSnapToItem={setActiveItemIndex}
        />

        <Pagination
          dotsLength={carouselSteps.length}
          activeDotIndex={activeItemIndex}
          carouselRef={carouselRef}
          dotStyle={styles.carouselDot}
          tappableDots={false}
          inactiveDotStyle={styles.inactiveCarouselDot}
          inactiveDotOpacity={1}
          inactiveDotScale={0.8}
        />
      </View>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => router.replace("/settings/setup-secret-code")}
        activeOpacity={0.7}
      >
        <Text style={styles.continueButton_text}>{t("intro.continue")}</Text>
        <ArrowRightIcon size={22} color={COLOR.softWhite} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function CarouselItem({ item, width, height }) {
  return (
    <View style={styles.carouselItemContainer}>
      <Image style={[styles.carouselImage, { width, height }]} source={item.image} resizeMode="contain" />
      <Text style={styles.carouselDescription}>{item.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: COLOR.darkBlue,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  introTitle: {
    width: "100%",
    color: COLOR.softWhite,
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    marginTop: PADDING_MARGIN.md,
    textAlign: "center",
  },
  carouselItemContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  carouselImage: {
    marginBottom: PADDING_MARGIN.lg,
  },
  carouselDescription: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    textAlign: "center",
  },
  carouselWrapper: {
    marginTop: 20,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  carouselDot: {
    backgroundColor: COLOR.softWhite,
    width: 12,
    height: 12,
    borderRadius: BORDER.rounded,
  },
  inactiveCarouselDot: {
    backgroundColor: COLOR.boldBlue,
  },
  continueButton: {
    paddingBottom: PADDING_MARGIN.xl,
    paddingHorizontal: PADDING_MARGIN.lg + PADDING_MARGIN.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  continueButton_text: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    marginRight: PADDING_MARGIN.sm,
  },
});
