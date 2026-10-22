import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Cog8ToothIcon from "react-native-heroicons/outline/Cog8ToothIcon";

import { useRouter } from "@/hooks/useRouter";

import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { COLOR, PADDING_MARGIN } from "@/constants/styles";

export default function GeneralSettingsButton() {
  const { t } = useTranslation();

  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("generalsettings.title")}
        activeOpacity={0.7}
        style={styles.button}
        testID={SHORTCUT_TARGET.settings}
        onPress={() => {
          router.push("/settings/general");
        }}
      >
        <Cog8ToothIcon size={24} color={COLOR.softWhite} />
      </TouchableOpacity>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: { paddingHorizontal: PADDING_MARGIN.sm },
  button: { padding: PADDING_MARGIN.sm },
});
