import React from "react";
import { Platform } from "react-native";

import SectionItem_ExportImportData from "./items/advanced/SectionItem_ExportImportData";
import SectionItem_ShowHidden from "./items/advanced/SectionItem_ShowHidden";
import SectionItem_VoiceRecognition from "./items/advanced/SectionItem_VoiceRecognition";
import SectionItem_Webhooks from "./items/advanced/SectionItem_Webhooks";
import SectionItem_AIAssistant from "./items/advanced/SectionItem_AIAssistant";
import SectionItem_WipeData from "./items/advanced/SectionItem_WipeData";
import SectionItem_AppLanguage from "./items/basic/SectionItem_AppLanguage";
import SectionItem_ChangeSecretCode from "./items/basic/SectionItem_ChangeSecretCode";
import SectionItem_CloudSync from "./items/basic/SectionItem_CloudSync";
import SectionItem_EnableFingerprint from "./items/basic/SectionItem_EnableFingerprint";
import SectionItem_TemporaryTrash from "./items/basic/SectionItem_TemporaryTrash";
import SectionItem_Help from "./items/feedback/SectionItem_Help";
import SectionItem_Report from "./items/feedback/SectionItem_Report";
import SectionItem_Suggest from "./items/feedback/SectionItem_Suggest";
import SectionItem_AppInfo from "./items/info/SectionItem_AppInfo";
import SectionItem_Changelog from "./items/info/SectionItem_Changelog";
import SectionItem_CheckUpdates from "./items/info/SectionItem_CheckUpdates";
import SectionItem_DeveloperInfo from "./items/info/SectionItem_DeveloperInfo";
import SectionItem_DeveloperOptions from "./items/info/SectionItem_DeveloperOptions";

export type SectionItemComponent = React.ComponentType<{ isLast: boolean }>;

const isWeb = Platform.OS === "web";

export const SECTION_BASIC: SectionItemComponent[] = [
  SectionItem_CloudSync,
  SectionItem_TemporaryTrash,
  SectionItem_ChangeSecretCode,
  !isWeb && SectionItem_EnableFingerprint,
  SectionItem_AppLanguage,
].filter(Boolean) as SectionItemComponent[];

export const SECTION_ADVANCED: SectionItemComponent[] = [
  SectionItem_ShowHidden,
  SectionItem_ExportImportData,
  SectionItem_Webhooks,
  !isWeb && SectionItem_VoiceRecognition,
  !isWeb && SectionItem_AIAssistant,
  SectionItem_WipeData,
].filter(Boolean) as SectionItemComponent[];

export const SECTION_INFO: SectionItemComponent[] = [
  SectionItem_AppInfo,
  SectionItem_DeveloperInfo,
  SectionItem_Changelog,
  SectionItem_CheckUpdates,
  SectionItem_DeveloperOptions,
];

export const SECTION_FEEDBACK: SectionItemComponent[] = [SectionItem_Help, SectionItem_Suggest, SectionItem_Report];
