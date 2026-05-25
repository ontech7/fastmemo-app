import BackButton from "@/components/buttons/BackButton";
import DeviceAndroidIcon from "@/components/icons/DeviceAndroidIcon";
import DeviceAppleIcon from "@/components/icons/DeviceAppleIcon";
import NoCloudIcon from "@/components/icons/NoCloudIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import useNetInfo from "@/hooks/useNetInfo";
import { useTimeoutTask } from "@/hooks/useTimeoutTask";
import {
  getAllConnectedDevices,
  getDeviceUuid,
  removeDeviceFromCloud,
  removeDeviceFromDevicesToSync,
  type ConnectedDevice,
} from "@/libs/firebase";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ComputerDesktopIcon, TrashIcon } from "react-native-heroicons/outline";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export default function SyncedDevicesScreen() {
  const { t } = useTranslation();

  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const numberOfDevices = connectedDevices.length;
  const [currentDeviceUuid, setCurrentDeviceUuid] = useState("");
  const { timeoutStates, setTimeoutTask } = useTimeoutTask();

  const netInfo = useNetInfo();

  const blinkOpacity = useSharedValue(0);

  const blinkStyle = useAnimatedStyle(() => ({
    opacity: blinkOpacity.value,
  }));

  useEffect(() => {
    blinkOpacity.value = withRepeat(
      withTiming(1, {
        duration: 1250,
        easing: Easing.linear,
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(blinkOpacity);
      blinkOpacity.value = 0;
    };
  }, [blinkOpacity]);

  // retrieve devices

  const deleteDeviceFromCloud = async (uuid: string) => {
    const res_removeDeviceCloud = await removeDeviceFromCloud(uuid);
    const res_removeDeviceSync = await removeDeviceFromDevicesToSync(uuid);

    if (!res_removeDeviceCloud || !res_removeDeviceSync) {
      return;
    }

    setConnectedDevices((prevConnectedDevices: ConnectedDevice[]) =>
      prevConnectedDevices.filter((prevConnectedDevice: ConnectedDevice) => prevConnectedDevice.uuid != uuid)
    );
  };

  const getDevices = async () => {
    await setTimeoutTask(async () => {
      const currDeviceUuid = await getDeviceUuid();
      setCurrentDeviceUuid(currDeviceUuid);

      const cloudDevices = await getAllConnectedDevices();
      setConnectedDevices(cloudDevices);
    }, 5000);
  };

  const [refreshing, setRefreshing] = React.useState(false);

  const refreshDevices = async () => {
    await getDevices();
    setRefreshing(false);
  };

  useEffect(() => {
    if (netInfo?.isConnected) {
      getDevices();
    } else {
      timeoutStates.error.set(true); // if connection is lost
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netInfo]);

  return (
    <>
      <LoadingSpinner visible={timeoutStates.loading.get()} color={COLOR.accentSoft} text={t("loading")} />

      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <BackButton chip />

          <View style={{ flexGrow: 1 }}>
            <Text style={styles.headerTitle}>{t("synceddevices.title")}</Text>
            <Text
              style={[
                styles.headerSubtitle,
                {
                  color: numberOfDevices != configs.cloud.deviceLimit ? COLOR.accentSoft : COLOR.important,
                },
              ]}
            >
              ({numberOfDevices}/{configs.cloud.deviceLimit}) dispositivi
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDevices} tintColor={COLOR.accentSoft} />}
        >
          {timeoutStates.error.get() ? (
            <View style={styles.errorWrapper}>
              <NoCloudIcon size={32} color={COLOR.textSecondary} />

              <Text style={styles.error_text}>{t("synceddevices.error_fetching")}</Text>
            </View>
          ) : (
            connectedDevices?.map((connectedDevice) => (
              <View key={connectedDevice.uuid} style={styles.deviceCard}>
                {connectedDevice.brand !== "web" ? (
                  connectedDevice.brand !== "Apple" ? (
                    <DeviceAndroidIcon size={32} color={COLOR.textPrimary} />
                  ) : (
                    <DeviceAppleIcon size={32} color={COLOR.textPrimary} />
                  )
                ) : (
                  <ComputerDesktopIcon size={32} color={COLOR.textPrimary} />
                )}

                <View style={styles.deviceInfo}>
                  <Text numberOfLines={1} style={styles.deviceName}>
                    {connectedDevice.modelName}
                  </Text>

                  <Text style={styles.deviceSyncLabel}>
                    {t("synceddevices.lastSync")}

                    <Text style={styles.deviceSyncDate}>{new Date(parseInt(connectedDevice.lastSync)).toLocaleString()}</Text>
                  </Text>
                </View>

                <View>
                  {currentDeviceUuid == connectedDevice.uuid ? (
                    <Animated.View style={[styles.currentDeviceDot, blinkStyle]} />
                  ) : (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => deleteDeviceFromCloud(connectedDevice.uuid)}>
                      <View style={styles.deleteChip}>
                        <TrashIcon size={16} color={COLOR.textMuted} />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
  },
  scroll: {
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    fontSize: FONTSIZE.intro,
    fontFamily: FONT.semiBold,
    textAlign: "center",
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
    textAlign: "center",
  },
  headerSpacer: {
    width: 42,
  },
  errorWrapper: {
    flexDirection: "row",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  error_text: {
    marginLeft: PADDING_MARGIN.md,
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.subtitle,
    textAlign: "center",
  },
  deviceCard: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    padding: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deviceInfo: {
    marginLeft: PADDING_MARGIN.md,
    flex: 1,
  },
  deviceName: {
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  deviceSyncLabel: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
  },
  deviceSyncDate: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
  },
  currentDeviceDot: {
    backgroundColor: COLOR.accentSoft,
    width: 18,
    height: 18,
    borderRadius: BORDER.rounded,
    marginRight: PADDING_MARGIN.sm,
  },
  deleteChip: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER.normal,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
});
