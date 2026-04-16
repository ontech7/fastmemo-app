import { Platform } from "react-native";

const Haptics = Platform.OS === "web" ? require("./haptics.web").default : require("./haptics.native").default;

export default Haptics;
