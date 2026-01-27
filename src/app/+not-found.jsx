import { COLOR, FONTSIZE } from "@/constants/styles";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This screen does not exist.</Text>
      <Link href="/home" style={styles.link}>
        <Text>Go to home screen!</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.subtitle,
    textAlign: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    color: COLOR.softWhite,
    marginTop: 15,
    paddingVertical: 15,
  },
});
