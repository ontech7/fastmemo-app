import { StyleSheet, View } from "react-native";
import ServerStackIcon from "react-native-heroicons/solid/ServerStackIcon";
import Svg, { Defs, G, Path, RadialGradient, Rect } from "react-native-svg";

import { glowStops } from "@/components/ui/AppBackground";
import { BORDER, COLOR, GLASS } from "@/constants/styles";

import type { CloudProvider } from "@/types";

interface Props {
  provider: CloudProvider;
}

const SIZE = 40;

/** Firebase's mark as drawn in assets/lottie/Logo_x_Firebase.json, back to front. */
const FIREBASE = {
  width: 128.08,
  height: 175.93,
  paths: [
    {
      fill: "#FFA000",
      d: "M0.08 141.94L21.74 3.33C21.87 2.5 22.26 1.73 22.84 1.13C23.43 0.54 24.2 0.14 25.02 0C25.85 -0.14 26.7 -0.02 27.45 0.35C28.21 0.72 28.82 1.32 29.22 2.06L51.62 43.84L60.55 26.84C60.89 26.19 61.4 25.65 62.02 25.28C62.65 24.9 63.36 24.7 64.09 24.7C64.82 24.7 65.53 24.9 66.16 25.28C66.78 25.65 67.29 26.19 67.63 26.84L128.08 141.94L0.08 141.94L0.08 141.94Z",
    },
    { fill: "#F57C00", d: "M74.91 87.95L51.61 43.83L0.08 141.94L74.91 87.95L74.91 87.95Z" },
    {
      fill: "#FFCA28",
      d: "M128.08 141.94L111.49 39.28C111.37 38.55 111.05 37.88 110.57 37.33C110.09 36.77 109.46 36.36 108.76 36.14C108.06 35.91 107.32 35.89 106.6 36.06C105.89 36.23 105.24 36.6 104.72 37.12L0.08 141.94L57.98 174.41C59.77 175.41 61.78 175.93 63.83 175.93C65.88 175.93 67.89 175.41 69.68 174.41L128.08 141.94L128.08 141.94Z",
    },
    {
      fill: "#FFFFFF",
      opacity: 0.2,
      d: "M111.49 39.28C111.37 38.55 111.05 37.88 110.57 37.33C110.09 36.77 109.46 36.36 108.76 36.14C108.06 35.91 107.32 35.89 106.6 36.06C105.89 36.23 105.24 36.6 104.72 37.12L83.96 57.94L67.62 26.83C67.28 26.18 66.77 25.64 66.15 25.27C65.52 24.89 64.81 24.69 64.08 24.69C63.35 24.69 62.64 24.89 62.01 25.27C61.39 25.64 60.88 26.18 60.54 26.83L51.61 43.83L29.21 2.06C28.81 1.32 28.2 0.72 27.44 0.35C26.69 -0.02 25.84 -0.14 25.01 0C24.18 0.14 23.42 0.54 22.83 1.14C22.24 1.74 21.86 2.51 21.73 3.34L0.08 141.94L0 141.94L0.07 142.02L0.64 142.3L83.91 58.94L104.69 38.14C105.21 37.62 105.86 37.25 106.58 37.07C107.29 36.9 108.04 36.93 108.74 37.15C109.44 37.37 110.07 37.78 110.55 38.34C111.03 38.89 111.35 39.57 111.47 40.3L127.92 142.04L128.08 141.94L111.49 39.28L111.49 39.28ZM0.27 141.75L21.74 4.33C21.87 3.5 22.25 2.73 22.84 2.13C23.43 1.53 24.19 1.13 25.02 0.99C25.85 0.85 26.7 0.97 27.45 1.34C28.21 1.71 28.82 2.31 29.22 3.05L51.62 44.83L60.55 27.83C60.89 27.18 61.4 26.64 62.02 26.27C62.65 25.89 63.36 25.69 64.09 25.69C64.82 25.69 65.53 25.89 66.16 26.27C66.78 26.64 67.29 27.18 67.63 27.83L83.63 58.26L0.27 141.75L0.27 141.75Z",
    },
    {
      fill: "#A52714",
      opacity: 0.2,
      d: "M69.68 173.43C67.89 174.43 65.88 174.95 63.83 174.95C61.78 174.95 59.77 174.43 57.98 173.43L0.22 141.03L0.08 141.94L57.98 174.4C59.77 175.4 61.78 175.92 63.83 175.92C65.88 175.92 67.89 175.4 69.68 174.4L128.08 141.94L127.93 141.02L69.68 173.43L69.68 173.43Z",
    },
  ],
};

/** FastMemo's "F" with its speed lines (the website's logo/gray.svg). */
const FASTMEMO = {
  top: 2,
  width: 47.75,
  height: 29.5,
  paths: [
    "M23.75 2L22.25 4.5H5L6.25 2H23.75Z",
    "M21.25 6.25L19.75 8.75H2.5L3.75 6.25H21.25Z",
    "M18.75 10.5L17.25 13H0L1.25 10.5H18.75Z",
    "M18.75 31.5H9L25.75 2H47.75L44 8.5H32L28.5 14.5H40.5L36.75 21H24.75L18.75 31.5Z",
  ],
};

/** Centers a logo of `width` x `height` units, scaled to `span` px along its longer side. */
function fit(width: number, height: number, span: number, top = 0) {
  const scale = span / Math.max(width, height);
  return `translate(${(SIZE - width * scale) / 2} ${(SIZE - height * scale) / 2 - top * scale}) scale(${scale})`;
}

/** The cloud's logo on a tile like the app icon's; the self-hosted server's carries a server badge. */
export default function CloudProviderIcon({ provider }: Props) {
  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <RadialGradient id="cloudProviderGlow" cx="85%" cy="5%" rx="80%" ry="80%">
            {glowStops(COLOR.accent, 0.35)}
          </RadialGradient>
        </Defs>
        <Rect
          x={0.5}
          y={0.5}
          width={SIZE - 1}
          height={SIZE - 1}
          rx={BORDER.normal - 0.5}
          fill={COLOR.bg}
          stroke={GLASS.border}
        />
        <Rect x={0.5} y={0.5} width={SIZE - 1} height={SIZE - 1} rx={BORDER.normal - 0.5} fill="url(#cloudProviderGlow)" />

        {provider === "firebase" ? (
          <G transform={fit(FIREBASE.width, FIREBASE.height, 24)}>
            {FIREBASE.paths.map((path) => (
              <Path key={path.d} d={path.d} fill={path.fill} fillOpacity={path.opacity} />
            ))}
          </G>
        ) : (
          <G transform={fit(FASTMEMO.width, FASTMEMO.height, 26, FASTMEMO.top)}>
            {FASTMEMO.paths.map((d) => (
              <Path key={d} d={d} fill={COLOR.lightBlue} />
            ))}
          </G>
        )}
      </Svg>

      {provider === "server" && (
        <View style={styles.badge}>
          <ServerStackIcon size={10} color={COLOR.softWhite} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
  },
  badge: {
    position: "absolute",
    right: -5,
    bottom: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLOR.bg,
    backgroundColor: COLOR.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
