import React, { useEffect, useRef, useState } from "react";
import { configs } from "@/configs";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  InteractionManager,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ComputerDesktopIcon, TrashIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";

import { getAllConnectedDevices, getDeviceUuid, removeDeviceFromCloud, removeDeviceFromDevicesToSync } from "@/libs/firebase";
import { useTimeoutTask } from "@/hooks/useTimeoutTask";
import BackButton from "@/components/buttons/BackButton";
import DeviceAndroidIcon from "@/components/icons/DeviceAndroidIcon";
import DeviceAppleIcon from "@/components/icons/DeviceAppleIcon";
import NoCloudIcon from "@/components/icons/NoCloudIcon";
import LoadingSpinner from "@/components/LoadingSpinner";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function SyncedDevicesScreen() {
  const { t } = useTranslation();

  const [connectedDevices, setConnectedDevices] = useState([]);
  const numberOfDevices = connectedDevices.length;
  const [currentDeviceUuid, setCurrentDeviceUuid] = useState("");
  const { timeoutStates, setTimeoutTask } = useTimeoutTask();

  const netInfo = useNetInfo();

  // blink animation

  const blinkAnim = useRef(new Animated.Value(0)).current;

  const blinkInterpolation = blinkAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  const blinkLoop = Animated.loop(
    Animated.timing(blinkAnim, {
      toValue: 1,
      duration: 2500,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  );

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      blinkLoop.start(() => blinkAnim.setValue(0));
    });

    return () => blinkLoop.reset();
  }, []);

  // retrieve devices

  const deleteDeviceFromCloud = async (uuid) => {
    const res_removeDeviceCloud = await removeDeviceFromCloud(uuid);
    const res_removeDeviceSync = await removeDeviceFromDevicesToSync(uuid);

    if (!res_removeDeviceCloud || !res_removeDeviceSync) {
      return;
    }

    setConnectedDevices((prevConnectedDevices) =>
      prevConnectedDevices.filter((prevConnectedDevice) => prevConnectedDevice.uuid != uuid)
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
  }, [netInfo]);

  return (
    <>
      <LoadingSpinner visible={timeoutStates.loading.get()} color={COLOR.lightBlue} text={t("loading")} />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />

          <View style={{ flexGrow: 1 }}>
            <Text style={styles.headerTitle}>{t("synceddevices.title")}</Text>
            <Text
              style={[
                styles.headerSubtitle,
                {
                  color: numberOfDevices != configs.cloud.deviceLimit ? COLOR.yellow : COLOR.important,
                },
              ]}
            >
              ({numberOfDevices}/{configs.cloud.deviceLimit}) dispositivi
            </Text>
          </View>

          <View style={{ padding: PADDING_MARGIN.md }}></View>
        </View>

        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDevices} />}>
          {timeoutStates.error.get() ? (
            <View
              style={{
                flexDirection: "row",
                height: 200,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <NoCloudIcon size={32} color={COLOR.softWhite} />

              <Text style={styles.error_text}>{t("synceddevices.error_fetching")}</Text>
            </View>
          ) : (
            connectedDevices?.map((connectedDevice) => (
              <View
                key={connectedDevice.uuid}
                style={{
                  backgroundColor: COLOR.blue,
                  borderRadius: BORDER.normal,
                  padding: PADDING_MARGIN.md,
                  marginBottom: PADDING_MARGIN.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  {connectedDevice.brand != "web" && connectedDevice.brand != "Windows" ? (
                    connectedDevice.brand != "Apple" ? (
                      <DeviceAndroidIcon size={32} color={COLOR.softWhite} />
                    ) : (
                      <DeviceAppleIcon size={32} color={COLOR.softWhite} />
                    )
                  ) : (
                    <ComputerDesktopIcon size={32} color={COLOR.softWhite} />
                  )}

                  <View style={{ marginLeft: PADDING_MARGIN.md, width: "80%" }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: FONTSIZE.subtitle,
                        fontWeight: FONTWEIGHT.semiBold,
                        color: COLOR.softWhite,
                      }}
                    >
                      {connectedDevice.modelName}
                    </Text>

                    <Text style={{ color: COLOR.softWhite }}>
                      {t("synceddevices.lastSync")}

                      <Text style={{ color: COLOR.gray }}>{new Date(parseInt(connectedDevice.lastSync)).toLocaleString()}</Text>
                    </Text>
                  </View>
                </View>

                <View>
                  {currentDeviceUuid == connectedDevice.uuid ? (
                    <Animated.View
                      style={{
                        backgroundColor: COLOR.yellow,
                        width: 24,
                        height: 24,
                        borderRadius: BORDER.rounded,
                        marginRight: PADDING_MARGIN.md,
                        opacity: blinkInterpolation,
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={{ marginRight: PADDING_MARGIN.sm }}
                      onPress={() => deleteDeviceFromCloud(connectedDevice.uuid)}
                    >
                      <TrashIcon size={28} color={COLOR.softWhite} />
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
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    textAlign: "center",
    color: COLOR.softWhite,
  },
  headerSubtitle: {
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
    textAlign: "center",
  },
  appWrapper: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: PADDING_MARGIN.xl,
  },
  appIcon: {
    width: 180,
    height: 220,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.big,
  },
  appName: {
    color: COLOR.softWhite,
    marginTop: PADDING_MARGIN.md,
  },
  sectionWrapper: {
    marginTop: PADDING_MARGIN.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.xs,
  },
  sectionHeaderTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.xs,
    fontWeight: FONTWEIGHT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  sectionItemList: {
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1,
    borderColor: COLOR.darkBlue,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemList_button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionItemList_title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.medium,
    maxWidth: 200,
  },
  textInputContainer: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
    backgroundColor: COLOR.boldBlue,
    borderRadius: BORDER.normal,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    color: COLOR.softWhite,
    paddingHorizontal: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
  },
  textInput_disabled: {
    opacity: 0.5,
  },
  saveSettingsText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.md,
    marginRight: PADDING_MARGIN.lg,
    fontWeight: FONTWEIGHT.semiBold,
  },
  saveButton: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  saveButton_disabled: {
    opacity: 0.5,
  },
  loadingSpinner: {
    position: "absolute",
    zIndex: 2,
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#0008",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  error_text: {
    marginLeft: PADDING_MARGIN.md,
    color: COLOR.softWhite,
    fontSize: FONTSIZE.subtitle,
    fontWeight: FONTWEIGHT.regular,
    textAlign: "center",
  },
});
