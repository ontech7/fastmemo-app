import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AdjustmentsHorizontalIcon,
  CheckIcon,
  ChevronDownIcon,
  CloudIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  FolderPlusIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  RectangleGroupIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import { useSelector } from "react-redux";

import type { TFunction } from "i18next";
import type { ReactNode } from "react";

import BackButton from "@/components/buttons/BackButton";
import SearchInput from "@/components/inputs/SearchInput";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";

import type { HelpCatalogEntry } from "@/libs/ai";
import { selectorAIAssistant } from "@/slicers/settingsSlice";
import { openUrl } from "@/utils/openUrl";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

/** Locales for which a translated online guide exists; anything else uses "en". */
const GUIDE_LOCALES = ["en", "it", "de", "es", "fr", "ja", "zh"];

// Icons embedded inline in help text. Sized close to the body text (instead of the
// 24px heroicons default) and paired with a fixed `lineHeight` on the text, so a line
// containing an icon stays the same height as the text-only lines around it.
const ICON_SIZE = 16;

interface HelpItem {
  /** i18n base; the question title lives at `${base}.title`, body texts under it. */
  base: string;
  body: ReactNode;
}

interface HelpSectionData {
  catKey: string;
  icon: ReactNode;
  items: HelpItem[];
  nativeOnly?: boolean;
}

/** All searchable text of an entry (title + every body string), lowercased. Falls
 * back to just the title if `returnObjects` isn't available. */
const getSearchText = (t: TFunction, base: string): string => {
  const res = t(base, { returnObjects: true }) as unknown;
  if (res && typeof res === "object") {
    return Object.values(res as Record<string, string>)
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();
  }
  return String(t(`${base}.title`)).toLowerCase();
};

export default function HelpScreen() {
  const { t, i18n } = useTranslation();
  const aiSettings = useSelector(selectorAIAssistant);

  // Online Firebase setup guide, in the active language when available.
  const guideLocale = GUIDE_LOCALES.includes(i18n.language) ? i18n.language : "en";
  const firebaseGuideUrl = `https://fastmemo.vercel.app/${guideLocale}/guides/google-firebase/`;

  // AI intent search is offered only when the on-device model is set up and
  // we're on a native build (the web bundle has no llama.rn).
  const aiAvailable = aiSettings.enabled && aiSettings.modelDownloaded && Platform.OS !== "web";

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // `aiKeys` holds the ordered `base` keys the model picked for the current
  // query (null = plain keyword search, a non-empty array = AI results shown).
  const [aiKeys, setAiKeys] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Pick one inviting placeholder at random per screen entry, so the search
  // field hints that you can describe what you need in your own words.
  const [placeholder] = useState(() => {
    const list = t("help.search_placeholders", { returnObjects: true });
    if (Array.isArray(list) && list.length > 0) {
      return String(list[Math.floor(Math.random() * list.length)]);
    }
    return t("help.search_placeholder");
  });

  const txt = (key: string) => <Text style={styles.sectionItemList_text}>{t(key)}</Text>;

  const sections: HelpSectionData[] = useMemo(() => {
    const line = (key: string) => (
      <Text key={key} style={styles.sectionItemList_text}>
        {t(key)}
      </Text>
    );
    const lines = (base: string, keys: string[]) => keys.map((k) => line(`${base}.${k}`));
    const link = (key: string, url: string) => (
      <Text key={key} style={styles.sectionItemList_link} onPress={() => openUrl(url)}>
        {t(key)}
      </Text>
    );

    return [
      {
        catKey: "help.cat_notes",
        icon: <DocumentTextIcon size={18} color={COLOR.accentSoft} />,
        items: [
          {
            base: "help.how_to_create_note",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_to_create_note.text_1_0")} <PlusIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_to_create_note.text_1_1")}
                </Text>
                {txt("help.how_to_create_note.text_2_0")}
                {txt("help.how_to_create_note.text_3_0")}
              </>
            ),
          },
          {
            base: "help.how_to_create_todo_note",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_to_create_todo_note.text_1_0")} <ListBulletIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_to_create_note.text_1_1")}
                </Text>
                {lines("help.how_to_create_todo_note", [
                  "text_2_0",
                  "text_3_0",
                  "text_4_0",
                  "text_5_0",
                  "text_6_0",
                  "text_7_0",
                  "text_8_0",
                  "text_9_0",
                ])}
              </>
            ),
          },
          {
            base: "help.how_to_create_kanban_note",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_to_create_kanban_note.text_1_0")} <PlusIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_to_create_kanban_note.text_1_1")}
                </Text>
                {lines("help.how_to_create_kanban_note", [
                  "text_2_0",
                  "text_3_0",
                  "text_4_0",
                  "text_5_0",
                  "text_6_0",
                  "text_7_0",
                  "text_8_0",
                  "text_9_0",
                  "text_10_0",
                ])}
              </>
            ),
          },
          {
            base: "help.how_to_create_code_note",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_to_create_code_note.text_1_0")} <PlusIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_to_create_code_note.text_1_1")}
                </Text>
                {lines("help.how_to_create_code_note", ["text_2_0", "text_3_0", "text_4_0", "text_5_0", "text_6_0"])}
              </>
            ),
          },
          { base: "help.how_to_edit_note", body: <>{txt("help.how_to_edit_note.text_1_0")}</> },
          {
            base: "help.how_to_delete_note",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_to_delete_note.text_1_0")} <EllipsisVerticalIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_to_delete_note.text_1_1")}
                </Text>
                {txt("help.how_to_delete_note.text_2_0")}
              </>
            ),
          },
          {
            base: "help.how_to_select_notes",
            body: <>{lines("help.how_to_select_notes", ["text_1_0", "text_2_0"])}</>,
          },
          {
            base: "help.what_are_hidden_notes",
            body: <>{lines("help.what_are_hidden_notes", ["text_1_0", "text_2_0"])}</>,
          },
        ],
      },
      {
        catKey: "help.cat_editor",
        icon: <AdjustmentsHorizontalIcon size={18} color={COLOR.accentSoft} />,
        items: [
          {
            base: "help.what_toolbar_below",
            body: (
              <>
                {lines("help.what_toolbar_below", [
                  "text_1_0",
                  "text_2_0",
                  "text_3_0",
                  "text_4_0",
                  "text_5_0",
                  "text_6_0",
                  "text_7_0",
                  "text_8_0",
                  "text_9_0",
                  "text_10_0",
                  "text_11_0",
                  "text_12_0",
                ])}
              </>
            ),
          },
          {
            base: "help.what_find_replace",
            body: <>{lines("help.what_find_replace", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
          {
            base: "help.what_are_settings_note",
            body: (
              <>
                {lines("help.what_are_settings_note", [
                  "text_1_0",
                  "text_2_0",
                  "text_3_0",
                  "text_4_0",
                  "text_5_0",
                  "text_6_0",
                  "text_7_0",
                  "text_8_0",
                  "text_9_0",
                  "text_10_0",
                ])}
              </>
            ),
          },
        ],
      },
      {
        catKey: "help.cat_categories",
        icon: <RectangleGroupIcon size={18} color={COLOR.accentSoft} />,
        items: [
          {
            base: "help.how_create_category",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_create_category.text_1_0")} <RectangleGroupIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_create_category.text_1_1")}
                </Text>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_create_category.text_2_0")} <FolderPlusIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_create_category.text_2_1")}
                </Text>
                {txt("help.how_create_category.text_3_0")}
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_create_category.text_4_0")} <CheckIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_create_category.text_4_1")}
                </Text>
              </>
            ),
          },
          {
            base: "help.how_edit_category",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_edit_category.text_1_0")} <RectangleGroupIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_edit_category.text_1_1")}
                </Text>
                {txt("help.how_edit_category.text_2_0")}
              </>
            ),
          },
          {
            base: "help.how_organize_categories",
            body: (
              <>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_organize_categories.text_1_0")}{" "}
                  <RectangleGroupIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_organize_categories.text_1_1")}
                </Text>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_organize_categories.text_2_0")} <PencilSquareIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_organize_categories.text_2_1")}
                </Text>
                {txt("help.how_organize_categories.text_3_0")}
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_organize_categories.text_4_0")} <CheckIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_organize_categories.text_4_1")}
                </Text>
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_organize_categories.text_5_0")} <XMarkIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_organize_categories.text_5_1")}
                </Text>
              </>
            ),
          },
          {
            base: "help.how_delete_category",
            body: (
              <>
                {txt("help.how_delete_category.text_1_0")}
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_delete_category.text_2_0")} <XMarkIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_delete_category.text_2_1")}
                </Text>
              </>
            ),
          },
        ],
      },
      {
        catKey: "help.cat_trash",
        icon: <TrashIcon size={18} color={COLOR.accentSoft} />,
        items: [
          {
            base: "help.what_are_trashed_notes",
            body: <>{lines("help.what_are_trashed_notes", ["text_1_0", "text_2_0"])}</>,
          },
          {
            base: "help.how_restore_trashed_notes",
            body: (
              <>
                {txt("help.how_restore_trashed_notes.text_1_0")}
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_restore_trashed_notes.text_2_0")}{" "}
                  <EllipsisVerticalIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_restore_trashed_notes.text_2_1")}
                </Text>
                {txt("help.how_restore_trashed_notes.text_3_0")}
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_restore_trashed_notes.text_4_0")}{" "}
                  <EllipsisVerticalIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_restore_trashed_notes.text_4_1")}
                </Text>
                {txt("help.how_restore_trashed_notes.text_5_0")}
              </>
            ),
          },
          {
            base: "help.how_restore_delete_notes",
            body: (
              <>
                {txt("help.how_restore_delete_notes.text_1_0")}
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_restore_delete_notes.text_2_0")}{" "}
                  <EllipsisVerticalIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_restore_delete_notes.text_2_1")}
                </Text>
                {txt("help.how_restore_delete_notes.text_3_0")}
                <Text style={styles.sectionItemList_text}>
                  {t("help.how_restore_delete_notes.text_4_0")}{" "}
                  <EllipsisVerticalIcon color={COLOR.textSecondary} size={ICON_SIZE} />{" "}
                  {t("help.how_restore_delete_notes.text_4_1")}
                </Text>
                {txt("help.how_restore_delete_notes.text_5_0")}
              </>
            ),
          },
        ],
      },
      {
        catKey: "help.cat_cloud",
        icon: <CloudIcon size={18} color={COLOR.accentSoft} />,
        items: [
          {
            base: "help.what_cloud_sync",
            body: (
              <>
                {lines("help.what_cloud_sync", ["text_1_0", "text_2_0"])}
                {link("help.what_cloud_sync.text_link", firebaseGuideUrl)}
              </>
            ),
          },
          {
            base: "help.what_encryption",
            body: <>{lines("help.what_encryption", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
          { base: "help.how_unlock_device", body: <>{lines("help.how_unlock_device", ["text_1_0", "text_2_0"])}</> },
          {
            base: "help.forgot_password",
            body: <>{lines("help.forgot_password", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
          {
            base: "help.reset_encryption",
            body: <>{lines("help.reset_encryption", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
          { base: "help.quick_backup", body: <>{lines("help.quick_backup", ["text_1_0", "text_2_0"])}</> },
        ],
      },
      {
        catKey: "help.cat_data",
        icon: <ShieldCheckIcon size={18} color={COLOR.accentSoft} />,
        items: [
          { base: "help.what_secret_code", body: <>{lines("help.what_secret_code", ["text_1_0", "text_2_0"])}</> },
          {
            base: "help.what_import_export",
            body: <>{lines("help.what_import_export", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
          {
            base: "help.how_export_note",
            body: (
              <>{lines("help.how_export_note", ["text_1_0", "text_2_0", "text_3_0", "text_4_0", "text_5_0", "text_6_0"])}</>
            ),
          },
          {
            base: "help.what_wipe_data",
            body: <>{lines("help.what_wipe_data", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
        ],
      },
      {
        catKey: "help.cat_settings",
        icon: <Cog6ToothIcon size={18} color={COLOR.accentSoft} />,
        items: [
          {
            base: "help.what_note_creation",
            body: <>{lines("help.what_note_creation", ["text_1_0", "text_2_0", "text_3_0", "text_4_0"])}</>,
          },
          {
            base: "help.what_home_filters",
            body: <>{lines("help.what_home_filters", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
          { base: "help.what_language", body: <>{lines("help.what_language", ["text_1_0", "text_2_0"])}</> },
        ],
      },
      {
        catKey: "help.cat_more",
        icon: <QuestionMarkCircleIcon size={18} color={COLOR.accentSoft} />,
        items: [
          { base: "help.what_version_check", body: <>{lines("help.what_version_check", ["text_1_0", "text_2_0"])}</> },
          {
            base: "help.what_report_problem",
            body: <>{lines("help.what_report_problem", ["text_1_0", "text_2_0", "text_3_0"])}</>,
          },
          { base: "help.what_webhooks", body: <>{lines("help.what_webhooks", ["text_1_0", "text_2_0"])}</> },
          { base: "help.what_platforms", body: <>{lines("help.what_platforms", ["text_1_0", "text_2_0"])}</> },
        ],
      },
      {
        catKey: "help.cat_ai",
        icon: <SparklesIcon size={18} color={COLOR.accentSoft} />,
        nativeOnly: true,
        items: [
          {
            base: "help.what_ai_assistant",
            body: <>{lines("help.what_ai_assistant", ["text_1_0", "text_2_0", "text_3_0", "text_4_0"])}</>,
          },
        ],
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, firebaseGuideUrl]);

  // Flat catalog (base key + localized title) fed to the model for intent search.
  const catalog: HelpCatalogEntry[] = useMemo(
    () =>
      sections.flatMap((s) =>
        s.nativeOnly && Platform.OS === "web"
          ? []
          : s.items.map((it) => ({ base: it.base, title: String(t(`${it.base}.title`)) }))
      ),
    [sections, t]
  );

  // Typing invalidates any previous AI result so stale ranking can't linger.
  const onChangeQuery = useCallback((text: string) => {
    setQuery(text);
    setAiKeys(null);
  }, []);

  const runAiSearch = useCallback(async () => {
    if (!aiAvailable) return;
    const term = query.trim();
    if (!term) return;
    setAiLoading(true);
    Keyboard.dismiss();
    try {
      // Dynamic import: keeps the AI stack (llama.rn et al.) out of this
      // screen's module graph, so opening Help doesn't pay to evaluate it.
      const { searchHelpByIntent } = await import("@/libs/ai");
      const keys = await searchHelpByIntent(term, catalog);
      // Empty result → keep keyword results visible (aiKeys stays falsy-ish);
      // store [] so the "no AI match" hint can react if we ever need it.
      setAiKeys(keys);
    } finally {
      setAiLoading(false);
    }
  }, [aiAvailable, query, catalog]);

  // AI ranking is shown only when the last run returned at least one hit.
  const useAi = aiAvailable && aiKeys !== null && aiKeys.length > 0;
  // Offer the smart-search invite while typing a keyword query that hasn't
  // been handed to the AI yet (and isn't currently running).
  const showAiInvite = aiAvailable && !useAi && !aiLoading && q !== "" && aiKeys === null;
  const aiRank = useMemo(() => new Map((aiKeys ?? []).map((k, i) => [k, i] as const)), [aiKeys]);

  const visibleSections = sections
    .filter((s) => !(s.nativeOnly && Platform.OS === "web"))
    .map((s) => {
      if (useAi) {
        const items = s.items
          .filter((it) => aiRank.has(it.base))
          .sort((a, b) => (aiRank.get(a.base) ?? 0) - (aiRank.get(b.base) ?? 0));
        return { ...s, items };
      }
      return { ...s, items: q ? s.items.filter((it) => getSearchText(t, it.base).includes(q)) : s.items };
    })
    .filter((s) => s.items.length > 0);

  const noResults = !aiLoading && q !== "" && visibleSections.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />
        <Text style={styles.headerTitle}>{t("help.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <SearchInput value={query} onChangeText={onChangeQuery} onClear={() => setAiKeys(null)} placeholder={placeholder} />

        {useAi && (
          <Pressable style={styles.aiResultsBar} onPress={() => setAiKeys(null)}>
            <SparklesIcon size={16} color={COLOR.accentSoft} />
            <Text style={styles.aiResultsBarText}>{t("help.ai_results")}</Text>
            <XMarkIcon size={16} color={COLOR.textMuted} />
          </Pressable>
        )}

        {visibleSections.map((section, idx) => (
          <React.Fragment key={section.catKey}>
            <Section icon={section.icon} title={t(section.catKey)} first={idx === 0} />

            {section.items.map((item) => (
              <Accordion key={`${useAi ? "ai" : "kw"}-${item.base}`} title={t(`${item.base}.title`)} defaultOpen={useAi}>
                {item.body}
              </Accordion>
            ))}
          </React.Fragment>
        ))}

        {noResults && <Text style={styles.noResults}>{t("help.no_results")}</Text>}

        {showAiInvite && (
          <Pressable style={styles.aiInvite} onPress={runAiSearch}>
            <View style={styles.aiInviteIcon}>
              <SparklesIcon size={20} color={COLOR.accentSoft} />
            </View>
            <View style={styles.aiInviteTextWrap}>
              <Text style={styles.aiInviteTitle}>{t("help.ai_invite_title")}</Text>
              <Text style={styles.aiInviteSubtitle}>{t("help.ai_invite_subtitle")}</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {aiLoading && (
        <View style={styles.aiOverlay}>
          <View style={styles.aiOverlayCard}>
            <ActivityIndicator size="large" color={COLOR.accentSoft} />
            <Text style={styles.aiOverlayText}>{t("help.ai_thinking")}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

interface SectionProps {
  icon: ReactNode;
  title: string;
  first?: boolean;
}

const Section = ({ icon, title, first }: SectionProps) => (
  <View style={[styles.sectionGroupRow, first && styles.sectionGroupRow_first]}>
    {icon}
    <Text style={styles.sectionGroupTitle}>{title}</Text>
  </View>
);

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  /** Initial open state (used to auto-expand AI search hits on mount). */
  defaultOpen?: boolean;
}

const Accordion = ({ title, children, defaultOpen = false }: AccordionProps) => {
  const [isOpenAccordion, setIsOpenAccordion] = useState(defaultOpen);
  // Mount the body lazily: it stays unrendered until the accordion is first
  // opened (and stays mounted afterwards). This keeps the screen's initial
  // render cheap — only the headers paint, not every body's text and inline
  // SVG icons — so opening the Help screen is near-instant.
  const [hasOpened, setHasOpened] = useState(defaultOpen);

  const toggleAccordion = () => {
    setHasOpened(true);
    setIsOpenAccordion((prev: boolean) => !prev);
  };

  return (
    <View style={styles.sectionWrapper}>
      <TouchableOpacity activeOpacity={0.7} style={styles.sectionHeader} onPress={toggleAccordion}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>

        <ChevronDownIcon
          style={{
            transform: [
              {
                rotate: isOpenAccordion ? "180deg" : "0deg",
              },
            ],
          }}
          color={COLOR.textSecondary}
        />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.sectionList,
          {
            height: isOpenAccordion ? "auto" : 0,
            paddingVertical: isOpenAccordion ? PADDING_MARGIN.md : 0,
          },
        ]}
      >
        {hasOpened ? children : null}
      </Animated.View>
    </View>
  );
};

/* STYLES */

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
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
  headerSpacer: {
    width: 42,
  },
  scroll: {
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  scrollContent: {
    paddingBottom: PADDING_MARGIN.xl,
  },
  aiInvite: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    marginTop: PADDING_MARGIN.xxl,
    padding: PADDING_MARGIN.lg,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.accentMutedBorder,
    width: "80%",
    marginHorizontal: "auto",
  },
  aiInviteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.border,
  },
  aiInviteTextWrap: {
    flex: 1,
    gap: 2,
  },
  aiInviteTitle: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  aiInviteSubtitle: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
  },
  aiResultsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.accentMutedBorder,
  },
  aiResultsBarText: {
    flex: 1,
    color: COLOR.accentSoft,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
  },
  aiOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5, 9, 26, 0.6)",
  },
  aiOverlayCard: {
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.xl,
    paddingHorizontal: PADDING_MARGIN.xxl,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  aiOverlayText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.paragraph,
  },
  sectionGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.xs,
  },
  sectionGroupRow_first: {
    marginTop: PADDING_MARGIN.xs,
  },
  sectionGroupTitle: {
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionWrapper: {
    marginBottom: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
  },
  sectionHeaderTitle: {
    flex: 1,
    color: COLOR.textPrimary,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
    marginRight: PADDING_MARGIN.sm,
  },
  sectionList: {
    height: 0,
    borderRadius: BORDER.normal,
    overflow: "hidden",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: 0,
  },
  sectionItemList_text: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 22,
    marginBottom: PADDING_MARGIN.sm,
  },
  sectionItemList_link: {
    color: COLOR.accentSoft,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
    lineHeight: 22,
    textDecorationLine: "underline",
    marginBottom: PADDING_MARGIN.sm,
  },
  noResults: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    textAlign: "center",
    marginTop: PADDING_MARGIN.xl,
  },
  bottomSpacer: {
    height: PADDING_MARGIN.xl,
  },
});
