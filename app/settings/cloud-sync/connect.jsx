import { configs } from "@/configs";
import { useNetInfo } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  ArrowPathIcon,
  CheckIcon,
  DevicePhoneMobileIcon,
  InformationCircleIcon,
  PencilIcon,
} from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

import { toggleWithSecret } from "@/utils/crypt";
import { toast } from "@/utils/toast";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useRouter } from "@/hooks/useRouter";
import BackButton from "@/components/buttons/BackButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeAreaView from "@/components/SafeAreaView";
import { selectorIsFingerprintEnabled } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function CloudSyncScreen() {
  const { t } = useTranslation();

  const router = useRouter();

  const { methods, state, cloudSettings } = useCloudSync();

  const netInfo = useNetInfo();

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const isCloudSettingsComplete = cloudSettings.apiKey != "" && cloudSettings.projectId != "" && cloudSettings.appId != "";

  const toggleCloudSync = () => {
    if (!netInfo?.isConnected) {
      toast(t("noInternetConnection"));
      return;
    }
    methods.toggleCloudSync();
  };

  return (
    <>
      <LoadingSpinner visible={state.isLoading} color={COLOR.lightBlue} text={t("cloudsync.syncing_1")} />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />

          <Text style={styles.headerTitle}>{t("cloudsync.title")}</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL(`${configs.app.websiteUrl}/${t("languageCode")}/guides/google-firebase`)}
          >
            <InformationCircleIcon size={28} color={COLOR.softWhite} />
          </TouchableOpacity>
        </View>

        <ScrollView>
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionList}>
              <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
                <View style={styles.sectionItemList_button}>
                  <Text style={styles.sectionItemList_title}>{t("cloudsync.enable")}</Text>

                  <Switch
                    trackColor={{
                      false: COLOR.lightGray,
                      true: COLOR.darkYellow + "60",
                    }}
                    thumbColor={state.isCloudSyncEnabled ? COLOR.yellow : COLOR.softWhite}
                    onValueChange={() =>
                      toggleWithSecret({
                        router,
                        isFingerprintEnabled: selectorFingerprintEnabled,
                        callback: toggleCloudSync,
                      })
                    }
                    value={state.isCloudSyncEnabled}
                    style={{ height: 25 }}
                  />
                </View>
              </View>
            </View>

            {state.isCloudSyncEnabled && (
              <>
                <View style={styles.sectionWrapper}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTitle}>API Key</Text>
                  </View>

                  <View style={styles.sectionList}>
                    <View style={styles.textInputContainer}>
                      <TextInput
                        editable={state.isEditable}
                        style={[styles.textInput, !state.isEditable && styles.textInput_disabled]}
                        cursorColor={COLOR.softWhite}
                        placeholderTextColor={COLOR.placeholder}
                        placeholder="e.g.: AIzaF0Ba0wDdkde893DR9rkfAE03"
                        onChangeText={(text) => methods.setCloudSetting("apiKey", text)}
                        value={!state.isConnected ? cloudSettings.apiKey : "***********"}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.sectionWrapper}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTitle}>Project Id</Text>
                  </View>

                  <View style={styles.sectionList}>
                    <View style={styles.textInputContainer}>
                      <TextInput
                        editable={state.isEditable}
                        style={[styles.textInput, !state.isEditable && styles.textInput_disabled]}
                        cursorColor={COLOR.softWhite}
                        placeholderTextColor={COLOR.placeholder}
                        placeholder="e.g.: fastmemo-xyzw"
                        onChangeText={(text) => methods.setCloudSetting("projectId", text)}
                        value={!state.isConnected ? cloudSettings.projectId : "***********"}
                      />
                    </View>
                  </View>
                </View>

                <View style={[styles.sectionWrapper, { marginBottom: PADDING_MARGIN.lg }]}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTitle}>App Id</Text>
                  </View>

                  <View style={styles.sectionList}>
                    <View style={styles.textInputContainer}>
                      <TextInput
                        editable={state.isEditable}
                        style={[styles.textInput, !state.isEditable && styles.textInput_disabled]}
                        cursorColor={COLOR.softWhite}
                        placeholderTextColor={COLOR.placeholder}
                        placeholder="e.g.: 1:2137892387:web:9g7a6s6f8gf8df878787s6"
                        onChangeText={(text) => methods.setCloudSetting("appId", text)}
                        value={!state.isConnected ? cloudSettings.appId : "***********"}
                      />
                    </View>
                  </View>
                </View>

                {state.isEditable && (
                  <View style={styles.sectionWrapper}>
                    <View style={styles.sectionList}>
                      <View style={styles.saveSettingsWrapper}>
                        <Text style={styles.saveSettingsText}>{t("cloudsync.save")}</Text>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected}
                          style={[
                            styles.saveButton,
                            (state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected) &&
                              styles.saveButton_disabled,
                          ]}
                          onPress={() =>
                            toggleWithSecret({
                              router,
                              isFingerprintEnabled: selectorFingerprintEnabled,
                              callback: methods.saveCloudSettings,
                            })
                          }
                        >
                          <CheckIcon size={28} color={COLOR.blue} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {state.isConnected && (
                  <>
                    <View style={styles.sectionWrapper}>
                      <View style={styles.sectionList}>
                        <View style={styles.saveSettingsWrapper}>
                          <Text style={styles.saveSettingsText}>{t("cloudsync.edit")}</Text>

                          <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected}
                            style={[
                              styles.saveButton,
                              (state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected) &&
                                styles.saveButton_disabled,
                            ]}
                            onPress={() =>
                              toggleWithSecret({
                                router,
                                isFingerprintEnabled: selectorFingerprintEnabled,
                                callback: methods.editCloudSettings,
                              })
                            }
                          >
                            <PencilIcon size={28} color={COLOR.blue} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View style={styles.sectionWrapper}>
                      <View style={styles.sectionList}>
                        <View style={styles.saveSettingsWrapper}>
                          <Text style={styles.saveSettingsText}>{t("cloudsync.resync")}</Text>

                          <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected}
                            style={[
                              styles.saveButton,
                              (state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected) &&
                                styles.saveButton_disabled,
                            ]}
                            onPress={() => methods.syncCloudData(false)}
                          >
                            <ArrowPathIcon size={28} color={COLOR.blue} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View style={styles.sectionWrapper}>
                      <View style={styles.sectionList}>
                        <View style={styles.saveSettingsWrapper}>
                          <Text style={styles.saveSettingsText}>{t("cloudsync.deleteDevices")}</Text>

                          <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected}
                            style={[
                              styles.saveButton,
                              (state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected) &&
                                styles.saveButton_disabled,
                            ]}
                            onPress={() =>
                              toggleWithSecret({
                                router,
                                isFingerprintEnabled: selectorFingerprintEnabled,
                                callback: () => {
                                  router.push("/settings/cloud-sync/devices");
                                },
                              })
                            }
                          >
                            <DevicePhoneMobileIcon size={28} color={COLOR.blue} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
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
    flexGrow: 1,
    textAlign: "center",
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
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
  saveSettingsWrapper: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  saveSettingsText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
    marginRight: PADDING_MARGIN.lg,
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
});
