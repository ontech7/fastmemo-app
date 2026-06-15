import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Image, type ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "react-native-heroicons/outline";

import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { useRouter } from "@/hooks/useRouter";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

import step1 from "~/assets/intro/step1.png";
import step2 from "~/assets/intro/step2.png";
import step3 from "~/assets/intro/step3.png";
import step4 from "~/assets/intro/step4.png";
import step5 from "~/assets/intro/step5.png";
import step6 from "~/assets/intro/step6.png";
import step7 from "~/assets/intro/step7.png";
import step8 from "~/assets/intro/step8.png";

const { width: WINDOW_WIDTH } = Dimensions.get("window");

export default function IntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const isDesktop = WINDOW_WIDTH > 768;
  const ITEM_WIDTH = isDesktop ? Math.min(280, WINDOW_WIDTH * 0.3) : Math.min(WINDOW_WIDTH * 0.7, 300);
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

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <Text style={styles.introTitle}>{t("intro.title")}</Text>

      <View style={styles.carouselWrapper}>
        <View style={styles.carouselContainer}>
          {isDesktop && (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonLeft, !canScrollPrev && styles.navButtonDisabled]}
              onPress={scrollPrev}
              disabled={!canScrollPrev}
            >
              <ChevronLeftIcon size={28} color={canScrollPrev ? COLOR.textPrimary : COLOR.textMuted} />
            </TouchableOpacity>
          )}

          <div
            ref={emblaRef}
            style={{
              overflow: "hidden",
              width: isDesktop ? "70%" : "100%",
              maxWidth: isDesktop ? 600 : "100%",
            }}
          >
            <div style={{ display: "flex" }}>
              {carouselSteps.map((item, index) => (
                <div
                  key={index}
                  style={{
                    flex: "0 0 100%",
                    minWidth: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingLeft: 20,
                    paddingRight: 20,
                  }}
                >
                  <CarouselItem item={item} width={ITEM_WIDTH} height={ITEM_HEIGHT} isDesktop={isDesktop} />
                </div>
              ))}
            </div>
          </div>

          {isDesktop && (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonRight, !canScrollNext && styles.navButtonDisabled]}
              onPress={scrollNext}
              disabled={!canScrollNext}
            >
              <ChevronRightIcon size={28} color={canScrollNext ? COLOR.textPrimary : COLOR.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.paginationContainer}>
          {carouselSteps.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => emblaApi?.scrollTo(index)}
              style={[styles.carouselDot, index !== activeIndex && styles.inactiveCarouselDot]}
            />
          ))}
        </View>
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
  isDesktop: boolean;
}

function CarouselItem({ item, width, height, isDesktop }: CarouselItemProps) {
  return (
    <View style={[styles.carouselItemContainer, isDesktop && styles.carouselItemContainerDesktop]}>
      <Image style={[styles.carouselImage, { width, height }]} source={item.image} resizeMode="contain" />
      <Text style={[styles.carouselDescription, isDesktop && styles.carouselDescriptionDesktop]}>{item.description}</Text>
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
  carouselContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  carouselItemContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  carouselItemContainerDesktop: {
    maxWidth: 400,
  },
  carouselImage: {
    marginBottom: PADDING_MARGIN.lg,
  },
  carouselDescription: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    textAlign: "center",
    paddingHorizontal: PADDING_MARGIN.md,
    maxWidth: 300,
  },
  carouselDescriptionDesktop: {
    fontSize: FONTSIZE.paragraph + 2,
    maxWidth: 350,
    lineHeight: 24,
  },
  carouselWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  navButton: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    marginHorizontal: PADDING_MARGIN.md,
  },
  navButtonLeft: {
    marginRight: PADDING_MARGIN.lg,
  },
  navButtonRight: {
    marginLeft: PADDING_MARGIN.lg,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: PADDING_MARGIN.xl,
    gap: PADDING_MARGIN.sm,
  },
  carouselDot: {
    backgroundColor: COLOR.accentSoft,
    width: 12,
    height: 12,
    borderRadius: BORDER.rounded,
  },
  inactiveCarouselDot: {
    backgroundColor: COLOR.surfaceMuted,
    transform: [{ scale: 0.8 }],
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
