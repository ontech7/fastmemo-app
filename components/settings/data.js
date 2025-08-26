import SectionItem_ExportImportData from "./items/advanced/SectionItem_ExportImportData";
import SectionItem_ShowHidden from "./items/advanced/SectionItem_ShowHidden";
import SectionItem_VoiceRecognition from "./items/advanced/SectionItem_VoiceRecognition";
import SectionItem_Webhooks from "./items/advanced/SectionItem_Webhooks";
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

export const SECTION_BASIC = [
  SectionItem_CloudSync,
  SectionItem_TemporaryTrash,
  SectionItem_ChangeSecretCode,
  SectionItem_EnableFingerprint,
  SectionItem_AppLanguage,
];

export const SECTION_ADVANCED = [
  SectionItem_ShowHidden,
  SectionItem_ExportImportData,
  SectionItem_Webhooks,
  SectionItem_VoiceRecognition,
  SectionItem_WipeData,
];

export const SECTION_INFO = [SectionItem_AppInfo, SectionItem_DeveloperInfo, SectionItem_Changelog, SectionItem_CheckUpdates];

export const SECTION_FEEDBACK = [SectionItem_Help, SectionItem_Suggest, SectionItem_Report];
