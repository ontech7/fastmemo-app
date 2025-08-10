import React, { useRef, useState } from "react";
import Carousel, { Pagination } from "@ontech7/react-native-snap-carousel";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowRightIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";

import { CAROUSEL_DATA, ITEM_HEIGHT, ITEM_WIDTH, WINDOW_WIDTH } from "@/constants/carousel";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function IntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const carouselRef = useRef(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.introTitle}>{t("intro.title")}</Text>

      <View style={styles.carouselWrapper}>
        <Carousel
          disableIntervalMomentum={true}
          ref={carouselRef}
          data={CAROUSEL_DATA}
          renderItem={CarouselItem}
          sliderWidth={WINDOW_WIDTH}
          itemWidth={ITEM_WIDTH}
          useScrollView={true}
          onSnapToItem={setActiveItemIndex}
        />

        <Pagination
          dotsLength={CAROUSEL_DATA.length}
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
        activeOpacity={0.8}
      >
        <Text style={styles.continueButton_text}>{t("intro.continue")}</Text>
        <ArrowRightIcon size={22} color={COLOR.softWhite} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function CarouselItem({ item }) {
  return (
    <View style={styles.container}>
      <Image style={styles.carouselImage} source={item.image} resizeMode="contain" />
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
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselImage: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
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
