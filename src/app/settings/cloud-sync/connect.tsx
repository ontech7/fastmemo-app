import BackButton from "@/components/buttons/BackButton";
import ComplexDialog from "@/components/dialogs/ComplexDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { useCloudSync } from "@/hooks/useCloudSync";
import useNetInfo from "@/hooks/useNetInfo";
import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { useVaultProgress } from "@/hooks/useVaultProgress";
import { useVaultUnlocked } from "@/hooks/useVaultUnlocked";
import { probeVault } from "@/libs/vaultManager";
import { openUrl } from "@/utils/openUrl";
import { toast } from "@/utils/toast";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  ArrowPathIcon,
  CheckIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  KeyIcon,
  LockOpenIcon,
  PencilIcon,
  ShieldCheckIcon,
} from "react-native-heroicons/outline";

export default function CloudSyncScreen() {
  const { t } = useTranslation();

  const { unlockWithSecret } = useSecret();
  const netInfo = useNetInfo();
  const router = useRouter();
  const vaultUnlocked = useVaultUnlocked();
  const progress = useVaultProgress();

  const { methods, state, cloudSettings } = useCloudSync();

  // When connected but no key is loaded yet, find out whether encryption has
  // ever been set up, so the action reads "Unlock" (vault exists) vs "Turn on
  // encryption" (legacy data / first time). null = still checking.
  const [vaultExists, setVaultExists] = useState<boolean | null>(null);
  useEffect(() => {
    if (!state.isConnected || vaultUnlocked || !netInfo?.isConnected) return;
    let active = true;
    probeVault().then((probe) => {
      if (!active) return;
      // Only commit to a definitive answer; on "error" leave it null so neither
      // the unlock nor the (potentially destructive) setup CTA is shown.
      if (probe.presence === "present") setVaultExists(true);
      else if (probe.presence === "absent") setVaultExists(false);
    });
    return () => {
      active = false;
    };
  }, [state.isConnected, vaultUnlocked, netInfo?.isConnected]);

  const isCloudSettingsComplete = cloudSettings.apiKey != "" && cloudSettings.projectId != "" && cloudSettings.appId != "";

  const toggleCloudSync = () => {
    if (!netInfo?.isConnected) {
      toast(t("noInternetConnection"));
      return;
    }
    methods.toggleCloudSync();
  };

  const [showResyncDialog, setShowResyncDialog] = useState(false);

  return (
    <>
      <LoadingSpinner
        visible={state.isLoading}
        color={COLOR.accentSoft}
        text={t(progress ? "cloudsync.vault.uploading" : "cloudsync.syncing_1")}
        progress={progress}
      />

      <ComplexDialog
        open={showResyncDialog}
        adornmentStart={<ArrowPathIcon size={22} color={COLOR.softWhite} style={{ marginBottom: -3 }} />}
        title={t("cloudsync.resync_confirm_title")}
        description={t("cloudsync.resync_confirm_desc")}
        confirm={{
          label: t("confirm"),
          handler: () => {
            setShowResyncDialog(false);
            methods.syncCloudData(false);
          },
        }}
        cancel={{
          label: t("cancel"),
          handler: () => setShowResyncDialog(false),
        }}
      />

      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <BackButton chip />

          <Text style={styles.headerTitle}>{t("cloudsync.title")}</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openUrl(`${configs.app.websiteUrl}/${t("languageCode")}/guides/google-firebase`)}
          >
            <IconChip>
              <InformationCircleIcon size={20} color={COLOR.softWhite} />
            </IconChip>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionList}>
              <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
                <View style={styles.sectionItemList_button}>
                  <Text style={styles.sectionItemList_title}>{t("cloudsync.enable")}</Text>

                  <Switch
                    trackColor={{
                      false: COLOR.surfaceMuted,
                      true: COLOR.accentMuted,
                    }}
                    thumbColor={COLOR.softWhite}
                    onValueChange={() => unlockWithSecret(toggleCloudSync)}
                    value={state.isCloudSyncEnabled}
                    style={{ height: 25 }}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.encryptionHint}>{t("cloudsync.vault.enable_hint")}</Text>

            {state.isCloudSyncEnabled && (
              <>
                <View style={styles.sectionWrapper}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTitle}>API Key</Text>
                  </View>

                  <View style={styles.textInputContainer}>
                    <TextInput
                      editable={state.isEditable}
                      style={[styles.textInput, !state.isEditable && styles.textInput_disabled]}
                      cursorColor={COLOR.textPrimary}
                      placeholderTextColor={COLOR.textMuted}
                      placeholder="e.g.: AIzaF0Ba0wDdkde893DR9rkfAE03"
                      onChangeText={(text: string) => methods.setCloudSetting("apiKey", text)}
                      value={!state.isConnected ? cloudSettings.apiKey : "***********"}
                    />
                  </View>
                </View>

                <View style={styles.sectionWrapper}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTitle}>Project Id</Text>
                  </View>

                  <View style={styles.textInputContainer}>
                    <TextInput
                      editable={state.isEditable}
                      style={[styles.textInput, !state.isEditable && styles.textInput_disabled]}
                      cursorColor={COLOR.textPrimary}
                      placeholderTextColor={COLOR.textMuted}
                      placeholder="e.g.: fastmemo-xyzw"
                      onChangeText={(text: string) => methods.setCloudSetting("projectId", text)}
                      value={!state.isConnected ? cloudSettings.projectId : "***********"}
                    />
                  </View>
                </View>

                <View style={[styles.sectionWrapper, { marginBottom: PADDING_MARGIN.lg }]}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTitle}>App Id</Text>
                  </View>

                  <View style={styles.textInputContainer}>
                    <TextInput
                      editable={state.isEditable}
                      style={[styles.textInput, !state.isEditable && styles.textInput_disabled]}
                      cursorColor={COLOR.textPrimary}
                      placeholderTextColor={COLOR.textMuted}
                      placeholder="e.g.: 1:2137892387:web:9g7a6s6f8gf8df878787s6"
                      onChangeText={(text: string) => methods.setCloudSetting("appId", text)}
                      value={!state.isConnected ? cloudSettings.appId : "***********"}
                    />
                  </View>
                </View>

                {state.isEditable && (
                  <View style={styles.sectionWrapper}>
                    <View style={styles.saveSettingsWrapper}>
                      <Text style={styles.saveSettingsText}>{t("cloudsync.save")}</Text>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected}
                        style={[
                          styles.saveButton,
                          (state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected) && styles.saveButton_disabled,
                        ]}
                        onPress={() => unlockWithSecret(methods.saveCloudSettings)}
                      >
                        <CheckIcon size={24} color={COLOR.softWhite} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {state.isConnected && (
                  <>
                    {!vaultUnlocked && vaultExists === false && (
                      <View style={styles.ctaCard}>
                        <Text style={styles.ctaText}>{t("cloudsync.vault.setup_cta_hint")}</Text>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          disabled={state.isLoading || !netInfo?.isConnected}
                          style={[styles.ctaButton, (state.isLoading || !netInfo?.isConnected) && styles.saveButton_disabled]}
                          onPress={() => methods.requestVaultAccess()}
                        >
                          <ShieldCheckIcon size={20} color={COLOR.softWhite} />
                          <Text style={styles.ctaButtonText}>{t("cloudsync.vault.setup_action")}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!vaultUnlocked && vaultExists === true && (
                      <View style={styles.warningCard}>
                        <View style={styles.warningHeader}>
                          <ExclamationTriangleIcon size={20} color={COLOR.yellow} />
                          <Text style={styles.warningTitle}>{t("cloudsync.vault.locked_cta_title")}</Text>
                        </View>

                        <Text style={styles.warningText}>{t("cloudsync.vault.locked_cta_hint")}</Text>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          disabled={state.isLoading || !netInfo?.isConnected}
                          style={[
                            styles.warningButton,
                            (state.isLoading || !netInfo?.isConnected) && styles.saveButton_disabled,
                          ]}
                          onPress={() => methods.requestVaultAccess()}
                        >
                          <LockOpenIcon size={20} color={COLOR.darkBlue} />
                          <Text style={styles.warningButtonText}>{t("cloudsync.vault.unlock_action")}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.sectionWrapper}>
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
                          onPress={() => unlockWithSecret(methods.editCloudSettings)}
                        >
                          <PencilIcon size={24} color={COLOR.softWhite} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.sectionWrapper}>
                      <View style={styles.saveSettingsWrapper}>
                        <Text style={styles.saveSettingsText}>{t("cloudsync.resync")}</Text>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected || !vaultUnlocked}
                          style={[
                            styles.saveButton,
                            (state.isLoading || !isCloudSettingsComplete || !netInfo?.isConnected || !vaultUnlocked) &&
                              styles.saveButton_disabled,
                          ]}
                          onPress={() => setShowResyncDialog(true)}
                        >
                          <ArrowPathIcon size={24} color={COLOR.softWhite} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {vaultUnlocked && (
                      <View style={styles.sectionWrapper}>
                        <View style={styles.saveSettingsWrapper}>
                          <Text style={styles.saveSettingsText}>{t("cloudsync.vault.changePassphrase")}</Text>

                          <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={state.isLoading || !netInfo?.isConnected}
                            style={[
                              styles.saveButton,
                              (state.isLoading || !netInfo?.isConnected) && styles.saveButton_disabled,
                            ]}
                            onPress={() =>
                              unlockWithSecret((router, isFingerprint: boolean) => {
                                if (isFingerprint) {
                                  router.push("/settings/cloud-sync/vault-change");
                                } else {
                                  router.replace("/settings/cloud-sync/vault-change");
                                }
                              }, "none")
                            }
                          >
                            <KeyIcon size={24} color={COLOR.softWhite} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <View style={styles.sectionWrapper}>
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
                            unlockWithSecret((router, isFingerprint: boolean) => {
                              if (isFingerprint) {
                                router.push("/settings/cloud-sync/devices");
                              } else {
                                router.replace("/settings/cloud-sync/devices");
                              }
                            }, "none")
                          }
                        >
                          <DevicePhoneMobileIcon size={24} color={COLOR.softWhite} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {vaultUnlocked && (
                      <View style={styles.sectionWrapper}>
                        <View style={styles.saveSettingsWrapper}>
                          <Text style={styles.saveSettingsText}>{t("cloudsync.vault.resetVault")}</Text>

                          <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={state.isLoading || !netInfo?.isConnected}
                            style={[
                              styles.saveButton,
                              styles.resetButton,
                              (state.isLoading || !netInfo?.isConnected) && styles.saveButton_disabled,
                            ]}
                            onPress={() =>
                              unlockWithSecret((_, isFingerprint: boolean) => methods.requestReset(!isFingerprint), "none")
                            }
                          >
                            <ExclamationTriangleIcon size={24} color={COLOR.softWhite} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
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
  },
  scroll: {
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  scrollContent: {
    paddingBottom: PADDING_MARGIN.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    flexGrow: 1,
    textAlign: "center",
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
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
    color: COLOR.textSecondary,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.xs,
    fontFamily: FONT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  sectionItemList: {
    backgroundColor: COLOR.surface,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1,
    borderColor: GLASS.border,
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
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  textInputContainer: {
    flexDirection: "row",
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md,
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
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
    marginRight: PADDING_MARGIN.lg,
  },
  saveButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
  saveButton_disabled: {
    opacity: 0.5,
  },
  resetButton: {
    backgroundColor: COLOR.darkImportant,
  },
  encryptionHint: {
    marginTop: PADDING_MARGIN.md,
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    lineHeight: 18,
  },
  ctaCard: {
    marginTop: PADDING_MARGIN.lg,
    padding: PADDING_MARGIN.lg,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.accent,
  },
  ctaText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
    marginBottom: PADDING_MARGIN.lg,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md + 2,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accent,
    ...SHADOW.fab,
  },
  ctaButtonText: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  warningCard: {
    marginTop: PADDING_MARGIN.lg,
    padding: PADDING_MARGIN.lg,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: COLOR.yellow,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
  },
  warningTitle: {
    color: COLOR.yellow,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  warningText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
    marginBottom: PADDING_MARGIN.lg,
  },
  warningButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md + 2,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.yellow,
    ...SHADOW.fab,
  },
  warningButtonText: {
    color: COLOR.darkBlue,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
});
