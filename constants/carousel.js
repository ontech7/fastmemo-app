import i18n from "i18next";
import { Dimensions } from "react-native";

import step1 from "../assets/intro/step1.png";
import step2 from "../assets/intro/step2.png";
import step3 from "../assets/intro/step3.png";
import step4 from "../assets/intro/step4.png";
import step5 from "../assets/intro/step5.png";
import step6 from "../assets/intro/step6.png";

export const WINDOW_WIDTH = Dimensions.get("window").width;
export const WINDOW_HEIGHT = Dimensions.get("window").height;
export const DIMENSION_RATIO = WINDOW_HEIGHT / WINDOW_WIDTH;

export const LIMITER = DIMENSION_RATIO > 1.1 ? 1.1 : DIMENSION_RATIO < 0.8 ? 0.35 : DIMENSION_RATIO;

export const ITEM_WIDTH = Math.round((Dimensions.get("window").width / 2) * LIMITER);
export const ITEM_HEIGHT = ITEM_WIDTH * 1.8736;

export const CAROUSEL_DATA = [
  {
    image: step1,
    description: i18n.t("intro.step1"),
  },
  {
    image: step2,
    description: i18n.t("intro.step2"),
  },
  {
    image: step3,
    description: i18n.t("intro.step3"),
  },
  {
    image: step4,
    description: i18n.t("intro.step4"),
  },
  {
    image: step5,
    description: i18n.t("intro.step5"),
  },
  {
    image: step6,
    description: i18n.t("intro.step6"),
  },
];
