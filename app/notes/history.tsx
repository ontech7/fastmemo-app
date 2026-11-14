import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ArrowsRightLeftIcon from "react-native-heroicons/outline/ArrowsRightLeftIcon";
import ArrowUturnLeftIcon from "react-native-heroicons/outline/ArrowUturnLeftIcon";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";
import ChevronRightIcon from "react-native-heroicons/outline/ChevronRightIcon";
import CloudIcon from "react-native-heroicons/outline/CloudIcon";
import CpuChipIcon from "react-native-heroicons/outline/CpuChipIcon";
import PencilIcon from "react-native-heroicons/outline/PencilIcon";
import SparklesIcon from "react-native-heroicons/outline/SparklesIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import { useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import EmptyState from "@/components/ui/EmptyState";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { listVersions, type VersionMeta, type VersionReason } from "@/libs/history";
import { versionDay } from "@/libs/history/labels";
import { consumeUnlockedNote, storeUnlockedNote } from "@/libs/registry";
import { getNote } from "@/slicers/notesSlice";
import { formatTime } from "@/utils/date";
import { toast } from "@/utils/toast";

const REASON_ICON: Record<VersionReason, typeof SparklesIcon> = {
  ai: SparklesIcon,
  agent: CpuChipIcon,
  sync: CloudIcon,
  edit: PencilIcon,
  replace: ArrowsRightLeftIcon,
  cleanup: TrashIcon,
  restore: ArrowUturnLeftIcon,
};

type Row = { kind: "day"; key: string; label: string } | { kind: "version"; key: string; version: VersionMeta };

/*
 * A note's kept versions (spec B.9), newest first and grouped by day, under a first row for the note as it is now. A
 * version opens in the note's editor, read only (`/notes/<id>?version=<versionId>`). A protected note's history is
 * reached only from inside the note, which leaves a pass for it (`storeUnlockedNote`); reached any other way, home.
 */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const note = useSelector(getNote(noteId));

  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per note, as the note's own screen does (LL-085)
  const passed = useMemo(() => !note?.locked || consumeUnlockedNote(noteId), [noteId]);
  const gone = !note;

  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });

  useEffect(() => {
    if (!passed) routerRef.current.replace("/home");
  }, [passed]);

  useEffect(() => {
    if (!gone) return;
    toast(t("note.not_found"));
    routerRef.current.back();
  }, [gone, t]);

  // Read again each time the screen comes back into view: a restore adds a version.
  const [versions, setVersions] = useState<VersionMeta[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      listVersions(noteId).then((list) => {
        if (live) setVersions(list);
      });
      return () => {
        live = false;
      };
    }, [noteId])
  );

  const rows = useMemo(() => {
    const out: Row[] = [];
    let day = "";
    for (const version of versions ?? []) {
      const label = versionDay(version.at, t);
      if (label !== day) {
        day = label;
        out.push({ kind: "day", key: `day-${version.id}`, label });
      }
      out.push({ kind: "version", key: version.id, version });
    }
    return out;
  }, [versions, t]);

  const locked = !!note?.locked;
  const openVersion = useCallback(
    (versionId: string) => {
      // the version's screen asks for the code of a protected note unless it has a pass (LL-085)
      if (locked) storeUnlockedNote(noteId);
      routerRef.current.push({ pathname: "/notes/[noteId]", params: { noteId, version: versionId } });
    },
    [locked, noteId]
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) =>
      item.kind === "day" ? (
        <Text style={styles.day} accessibilityRole="header">
          {item.label}
        </Text>
      ) : (
        <VersionRow version={item.version} onOpen={openVersion} />
      ),
    [openVersion]
  );

  if (!note || !passed || versions === null) {
    return (
      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />
      </SafeAreaView>
    );
  }

  const current = (
    <TouchableOpacity
      style={[styles.row, styles.currentRow]}
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={t("history.current")}
    >
      <View style={styles.icon}>
        <CheckIcon size={16} color={COLOR.accentSoft} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{t("history.current")}</Text>
        <Text style={styles.rowSubtitle}>
          {versionDay(note.updatedAt, t)}, {formatTime(note.updatedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip shortcut />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("note.settings.history")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.kind}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={current}
        ListEmptyComponent={<EmptyState variant="history" />}
        ListFooterComponent={
          rows.length ? <Text style={styles.footer}>{t("history.footer", { count: versions.length })}</Text> : null
        }
        contentContainerStyle={rows.length ? undefined : styles.listContentEmpty}
      />
    </SafeAreaView>
  );
}

interface VersionRowProps {
  version: VersionMeta;
  onOpen: (versionId: string) => void;
}

const VersionRow = memo(function VersionRow({ version, onOpen }: VersionRowProps) {
  const { t } = useTranslation();
  const Icon = REASON_ICON[version.reason] ?? PencilIcon;
  const time = formatTime(version.at);
  const reason = t(`history.reason.${version.reason}`);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpen(version.id)}
      accessibilityRole="button"
      accessibilityLabel={`${time}, ${reason}`}
    >
      <View style={styles.icon}>
        <Icon size={16} color={COLOR.textSecondary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{time}</Text>
        <Text style={styles.rowSubtitle}>{reason}</Text>
      </View>
      <ChevronRightIcon size={16} color={COLOR.textMuted} />
    </TouchableOpacity>
  );
});

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  // An empty list's content fills the list, so its empty state sits in the middle.
  listContentEmpty: {
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.normal + 2,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.fill,
  },
  currentRow: {
    borderColor: COLOR.accentMutedBorder,
    backgroundColor: COLOR.accentFaint,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER.small + 2,
    backgroundColor: GLASS.fillStrong,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
  rowSubtitle: {
    marginTop: 2,
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  day: {
    marginTop: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.sm,
    marginLeft: PADDING_MARGIN.xs,
    color: COLOR.textMuted,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  footer: {
    marginTop: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.xl,
    paddingHorizontal: PADDING_MARGIN.md,
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    textAlign: "center",
  },
});
