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
import { triggerSyncNow } from "@/libs/registry";
import { toast } from "@/utils/toast";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowPathIcon, ComputerDesktopIcon, TrashIcon } from "react-native-heroicons/outline";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export default function SyncedDevicesScreen() {
  const { t, i18n } = useTranslation();

  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const numberOfDevices = connectedDevices.length;
  const [currentDeviceUuid, setCurrentDeviceUuid] = useState("");

  // Newest device by lastSync — the "most up to date" reference.
  const freshestTs = connectedDevices.reduce((max, d) => Math.max(max, parseInt(d.lastSync) || 0), 0);

  // A device is "behind" when it still appears in another device's devicesToSync;
  // sum the ops queued for it to know how far. All derived from already-fetched docs.
  const pendingFor = (uuid: string) =>
    connectedDevices.reduce(
      (acc, d) => (d.devicesToSync?.includes(uuid) ? acc + d.pendingNotes + d.pendingCategories : acc),
      0
    );

  // Localized "2 hours ago" via Intl; falls back to "" if the runtime lacks it.
  const relativeSync = (lastSync: string) => {
    const ts = parseInt(lastSync);
    if (!ts) return "";
    const diff = ts - Date.now();
    const abs = Math.abs(diff);
    const MIN = 60_000;
    const HR = 3_600_000;
    const DAY = 86_400_000;
    try {
      const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
      if (abs < HR) return rtf.format(Math.round(diff / MIN), "minute");
      if (abs < DAY) return rtf.format(Math.round(diff / HR), "hour");
      return rtf.format(Math.round(diff / DAY), "day");
    } catch {
      return "";
    }
  };
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

  // Manually run this device's sync (pull pending + push pending) for the rare
  // case automatic sync didn't fire, then refresh the list so the counts update.
  const [syncing, setSyncing] = useState(false);

  const syncCurrentDevice = async () => {
    if (!netInfo?.isConnected) {
      toast(t("noInternetConnection"));
      return;
    }
    setSyncing(true);
    try {
      await triggerSyncNow();
      await getDevices();
    } catch (e) {
      console.log("manual sync error:", e);
    } finally {
      setSyncing(false);
    }
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
      <LoadingSpinner visible={timeoutStates.loading.get() || syncing} color={COLOR.accentSoft} text={t("loading")} />

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
            connectedDevices?.map((connectedDevice) => {
              const behind = pendingFor(connectedDevice.uuid);
              const isMostRecent = freshestTs > 0 && parseInt(connectedDevice.lastSync) === freshestTs;
              const relative = relativeSync(connectedDevice.lastSync);

              return (
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
                    <View style={styles.deviceNameRow}>
                      <Text numberOfLines={1} style={styles.deviceName}>
                        {connectedDevice.modelName}
                      </Text>
                      {isMostRecent && (
                        <View style={styles.recentTag}>
                          <Text style={styles.recentTagText}>{t("synceddevices.mostRecent")}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.deviceSyncLabel}>
                      {t("synceddevices.lastSync")}
                      <Text style={styles.deviceSyncDate}>{new Date(parseInt(connectedDevice.lastSync)).toLocaleString()}</Text>
                    </Text>

                    <View style={styles.statusRow}>
                      {!!relative && <Text style={styles.relativeText}>{relative}</Text>}
                      <View style={[styles.statusPill, behind === 0 ? styles.statusPillOk : styles.statusPillBehind]}>
                        <Text style={[styles.statusPillText, behind === 0 ? styles.statusTextOk : styles.statusTextBehind]}>
                          {behind === 0 ? t("synceddevices.upToDate") : t("synceddevices.pending", { count: behind })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View>
                    {currentDeviceUuid == connectedDevice.uuid ? (
                      <View style={styles.currentDeviceActions}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={syncing || !netInfo?.isConnected}
                          onPress={syncCurrentDevice}
                        >
                          <View style={[styles.syncChip, (syncing || !netInfo?.isConnected) && styles.syncChipDisabled]}>
                            <ArrowPathIcon size={16} color={COLOR.accentSoft} />
                          </View>
                        </TouchableOpacity>
                        <Animated.View style={[styles.currentDeviceDot, blinkStyle]} />
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.7} onPress={() => deleteDeviceFromCloud(connectedDevice.uuid)}>
                        <View style={styles.deleteChip}>
                          <TrashIcon size={16} color={COLOR.textMuted} />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
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
    fontSize: FONTSIZE.subtitle,
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
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  deviceName: {
    flexShrink: 1,
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  recentTag: {
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 1,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fillStrong,
  },
  recentTagText: {
    fontSize: FONTSIZE.small - 1,
    fontFamily: FONT.semiBold,
    color: COLOR.accentSoft,
  },
  deviceSyncLabel: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
  },
  deviceSyncDate: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.xs,
  },
  relativeText: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  statusPill: {
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 1,
    borderRadius: BORDER.rounded,
  },
  statusPillOk: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  statusPillBehind: {
    backgroundColor: "rgba(255, 167, 38, 0.18)",
  },
  statusPillText: {
    fontSize: FONTSIZE.small - 1,
    fontFamily: FONT.semiBold,
  },
  statusTextOk: {
    color: COLOR.codeMint,
  },
  statusTextBehind: {
    color: "#FFA726",
  },
  currentDeviceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  syncChip: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER.normal,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.accent,
  },
  syncChipDisabled: {
    opacity: 0.5,
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
