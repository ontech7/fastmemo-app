import BackButton from "@/components/buttons/BackButton";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import DeviceAndroidIcon from "@/components/icons/DeviceAndroidIcon";
import DeviceAppleIcon from "@/components/icons/DeviceAppleIcon";
import NoCloudIcon from "@/components/icons/NoCloudIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import useNetInfo from "@/hooks/useNetInfo";
import { cloud, getDeviceUuid, type CloudDevice, type CloudFailure } from "@/libs/cloud";
import { providerOf } from "@/libs/cloud/scope";
import { onSyncEvent, reconnectNow, syncNow } from "@/libs/cloud/sync";
import { isVaultUnlocked } from "@/libs/vaultSession";
import { getCloudSettings } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ArrowPathIcon from "react-native-heroicons/outline/ArrowPathIcon";
import ComputerDesktopIcon from "react-native-heroicons/outline/ComputerDesktopIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSelector } from "react-redux";

/** How long the list may take before the screen says the cloud doesn't answer (it keeps waiting: a late list replaces it). */
const NO_ANSWER_MS = 5000;

export default function SyncedDevicesScreen() {
  const { t, i18n } = useTranslation();

  const [connectedDevices, setConnectedDevices] = useState<CloudDevice[]>([]);
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
  const netInfo = useNetInfo();
  const server = providerOf(useSelector(getCloudSettings)) === "server";

  const [loading, setLoading] = useState(true);
  // Why the list isn't there: the cloud doesn't answer, or it answered an error. Offline says so before either.
  const [failure, setFailure] = useState<CloudFailure | null>(null);
  const shownFailure = netInfo.isConnected ? failure : "offline";
  // Only the latest request's outcome is shown.
  const requestRef = useRef(0);

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
    // Removed first, so the others stop making it a recipient; then nobody waits for its acks anymore (their queues
    // would only clear at their next push otherwise).
    if (!(await cloud.unregisterDevice(uuid))) return;
    await cloud.dropRecipient(uuid);

    setConnectedDevices((prevConnectedDevices) =>
      prevConnectedDevices.filter((prevConnectedDevice) => prevConnectedDevice.uuid != uuid)
    );
  };

  // The device the user asked to remove. It's kept while the dialog fades out, so its name doesn't vanish from the text.
  const [removing, setRemoving] = useState<CloudDevice | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const askRemove = (device: CloudDevice) => {
    setRemoving(device);
    setConfirmOpen(true);
  };

  const confirmRemove = () => {
    // The dialog stays tappable while it fades out: one removal per confirmation.
    if (!confirmOpen || !removing) return;
    setConfirmOpen(false);
    deleteDeviceFromCloud(removing.uuid);
  };

  /** Asks the cloud for the devices. A list that comes after the "no answer" still replaces it. */
  const getDevices = () => {
    const request = ++requestRef.current;
    const latest = () => request === requestRef.current;
    const noAnswer = setTimeout(() => {
      if (!latest()) return;
      setLoading(false);
      setFailure("unreachable");
    }, NO_ANSWER_MS);

    getDeviceUuid().then((uuid) => setCurrentDeviceUuid(uuid ?? ""));
    return cloud.listDevices().then((cloudDevices) => {
      clearTimeout(noAnswer);
      if (!latest()) return;
      setLoading(false);
      if (!Array.isArray(cloudDevices)) {
        setFailure(cloudDevices);
        return;
      }
      setFailure(null);
      setConnectedDevices(cloudDevices);
    });
  };

  const retry = () => {
    setLoading(true);
    getDevices();
    // the sync engine asks too: the home and the status dot learn it answers again
    void reconnectNow();
  };

  // The list follows the sync engine's live view of the devices (sync status, last sync).
  useEffect(
    () =>
      onSyncEvent((event) => {
        if (event.type !== "devices") return;
        // A fresh list: the request under way (its "no answer", a late failure) no longer counts.
        requestRef.current++;
        setLoading(false);
        setConnectedDevices(event.devices);
        setFailure(null);
      }),
    []
  );

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
    if (!isVaultUnlocked()) {
      toast(t("cloudsync.vault.locked_prompt"));
      return;
    }
    setSyncing(true);
    try {
      if (!(await syncNow())) toast(t("cloudsync.vault.error_generic"));
      await getDevices();
    } catch (e) {
      console.log("manual sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (netInfo.isConnected) getDevices();
    // a request under way when the connection went is dropped: the one made when it comes back answers
    else requestRef.current++;
  }, [netInfo]);

  return (
    <>
      <LoadingSpinner visible={(loading && netInfo.isConnected) || syncing} color={COLOR.accentSoft} text={t("loading")} />

      <ConfirmOrCancelDialog
        open={confirmOpen}
        title={t("synceddevices.remove_title")}
        description={t("synceddevices.remove_description", { name: removing?.modelName ?? "" })}
        confirmLabel={t("synceddevices.remove_confirm")}
        onConfirm={confirmRemove}
        onCancel={() => setConfirmOpen(false)}
      />

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
                  color: numberOfDevices < cloud.deviceLimit ? COLOR.accentSoft : COLOR.important,
                },
              ]}
            >
              {t("synceddevices.count", { count: numberOfDevices, limit: cloud.deviceLimit })}
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDevices} tintColor={COLOR.accentSoft} />}
        >
          {shownFailure ? (
            <View style={styles.failure}>
              <NoCloudIcon size={40} color={COLOR.textMuted} />

              <Text style={styles.failureTitle}>
                {shownFailure === "offline"
                  ? t("noInternetConnection")
                  : shownFailure === "unreachable"
                    ? t(server ? "cloudsync.unreachable_server" : "cloudsync.unreachable_firebase")
                    : t("synceddevices.error_fetching")}
              </Text>

              <Text style={styles.failureText}>
                {shownFailure === "offline"
                  ? t("synceddevices.offline_body")
                  : shownFailure === "unreachable"
                    ? server
                      ? `${t("cloudsync.unreachable_check_server")}\n${t("cloudsync.unreachable_vpn")}`
                      : t("cloudsync.unreachable_check_firebase")
                    : t("synceddevices.error_body")}
              </Text>

              {/* Offline, the list comes back by itself with the connection. */}
              {shownFailure !== "offline" && (
                <TouchableOpacity activeOpacity={0.7} disabled={loading} onPress={retry} accessibilityRole="button">
                  <View style={styles.retryButton}>
                    <ArrowPathIcon size={16} color={COLOR.accentSoft} />
                    <Text style={styles.retryText}>{t("retry")}</Text>
                  </View>
                </TouchableOpacity>
              )}
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
                          accessibilityRole="button"
                          accessibilityLabel={t("a11y.sync_device")}
                        >
                          <View style={[styles.syncChip, (syncing || !netInfo?.isConnected) && styles.syncChipDisabled]}>
                            <ArrowPathIcon size={16} color={COLOR.accentSoft} />
                          </View>
                        </TouchableOpacity>
                        <Animated.View style={[styles.currentDeviceDot, blinkStyle]} />
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => askRemove(connectedDevice)}
                        accessibilityRole="button"
                        accessibilityLabel={t("a11y.remove_device")}
                      >
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
  failure: {
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.xxl,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  failureTitle: {
    marginTop: PADDING_MARGIN.sm,
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.inputTitle,
    textAlign: "center",
  },
  failureText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.sm,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  retryText: {
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
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
