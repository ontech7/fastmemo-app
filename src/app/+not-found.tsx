import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";
import AppBackground from "@/components/ui/AppBackground";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <Text style={styles.title}>This screen does not exist.</Text>
      <Link href="/home" style={styles.link}>
        <Text style={styles.linkText}>Go to home screen!</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
    textAlign: "center",
  },
  link: {
    marginTop: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.lg,
  },
  linkText: {
    color: COLOR.accentSoft,
    fontFamily: FONT.medium,
  },
});
