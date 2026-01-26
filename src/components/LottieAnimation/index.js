import { Platform } from "react-native";

const LottieView =
  Platform.OS === "web" ? require("./LottieAnimation.web.jsx").default : require("./LottieAnimation.native.jsx").default;

export default LottieView;
