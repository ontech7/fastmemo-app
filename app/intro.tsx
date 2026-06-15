import step1 from "~/assets/intro/step1.png";
import step2 from "~/assets/intro/step2.png";
import step3 from "~/assets/intro/step3.png";
import step4 from "~/assets/intro/step4.png";
import step5 from "~/assets/intro/step5.png";
import step6 from "~/assets/intro/step6.png";
import step7 from "~/assets/intro/step7.png";
import step8 from "~/assets/intro/step8.png";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import Carousel, { Pagination } from "@ontech7/react-native-snap-carousel";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Image, type ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowRightIcon } from "react-native-heroicons/outline";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");

export default function IntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const carouselRef = useRef<any>(null);

  const [activeItemIndex, setActiveItemIndex] = useState(0);

  const DIMENSION_RATIO = WINDOW_HEIGHT / WINDOW_WIDTH;

  const LIMITER = DIMENSION_RATIO > 1.1 ? 1.1 : DIMENSION_RATIO < 0.8 ? 0.35 : DIMENSION_RATIO;

  const ITEM_WIDTH = Math.round((WINDOW_WIDTH / 2) * LIMITER);
  const ITEM_HEIGHT = Math.round(ITEM_WIDTH * 1.8736);

  const carouselSteps = useMemo(
    () => [
      {
        image: step1,
        description: t("intro.step1"),
      },
      {
        image: step2,
        description: t("intro.step2"),
      },
      {
        image: step3,
        description: t("intro.step3"),
      },
      {
        image: step4,
        description: t("intro.step4"),
      },
      {
        image: step5,
        description: t("intro.step5"),
      },
      {
        image: step6,
        description: t("intro.step6"),
      },
      {
        image: step7,
        description: t("intro.step7"),
      },
      {
        image: step8,
        description: t("intro.step8"),
      },
    ],
    [t]
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <Text style={styles.introTitle}>{t("intro.title")}</Text>

      <View style={styles.carouselWrapper}>
        <Carousel
          disableIntervalMomentum={true}
          ref={carouselRef}
          data={carouselSteps}
          renderItem={({ item }: { item: { image: ImageSourcePropType; description: string } }) => (
            <CarouselItem item={item} width={ITEM_WIDTH} height={ITEM_HEIGHT} />
          )}
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
        <ArrowRightIcon size={20} color={COLOR.softWhite} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

interface CarouselItemProps {
  item: { image: ImageSourcePropType; description: string };
  width: number;
  height: number;
}

function CarouselItem({ item, width, height }: CarouselItemProps) {
  return (
    <View style={styles.carouselItemContainer}>
      <Image style={[styles.carouselImage, { width, height }]} source={item.image} resizeMode="contain" />
      <Text style={styles.carouselDescription}>{item.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.md,
  },
  introTitle: {
    width: "100%",
    color: COLOR.textPrimary,
    fontSize: FONTSIZE.intro,
    fontFamily: FONT.semiBold,
    letterSpacing: -0.3,
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
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
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
    backgroundColor: COLOR.accentSoft,
    width: 12,
    height: 12,
    borderRadius: BORDER.rounded,
  },
  inactiveCarouselDot: {
    backgroundColor: COLOR.surfaceMuted,
  },
  continueButton: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    backgroundColor: COLOR.accentMuted,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    borderRadius: BORDER.rounded,
    marginBottom: PADDING_MARGIN.xl,
    marginRight: PADDING_MARGIN.md,
    ...SHADOW.fab,
  },
  continueButton_text: {
    color: COLOR.softWhite,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.paragraph,
  },
});
