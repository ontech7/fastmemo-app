import { Platform } from "react-native";

const Haptics = Platform.OS === "web" ? require("./haptics.web.js").default : require("./haptics.native.js").default;

export default Haptics;
