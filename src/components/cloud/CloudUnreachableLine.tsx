import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import ExclamationTriangleIcon from "react-native-heroicons/outline/ExclamationTriangleIcon";
import { useSelector } from "react-redux";

import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { providerOf } from "@/libs/cloud/scope";
import { reconnectNow } from "@/libs/cloud/sync";
import { getCloudSettings } from "@/slicers/settingsSlice";
import type { RootState } from "@/types";
import { formatDateTime } from "@/utils/date";

/** The notes waiting to go to the cloud: uploads, deletions, notes made offline. */
const selectorPendingNotes = (state: RootState): number => {
  const outbox = state.notes.cloud.items;
  return Object.keys(outbox.add).length + Object.keys(outbox.delete).length + Object.keys(outbox.detach ?? {}).length;
};

interface Props {
  /** The cloud's last answer (null: none since the app started). */
  lastContact: number | null;
}

/**
 * The home's line when the cloud can't be reached (ADR-029): quiet, in place of the category, gone once it answers. A tap
 * says what happens to the changes, and offers to try again.
 */
export default function CloudUnreachableLine({ lastContact }: Props) {
  const { t } = useTranslation();
  const server = providerOf(useSelector(getCloudSettings)) === "server";
  const pending = useSelector(selectorPendingNotes);
  const [open, setOpen] = useState(false);

  const label = t(server ? "cloudsync.unreachable_server" : "cloudsync.unreachable_firebase");
  const line = pending > 0 ? `${label} · ${t("cloudsync.unreachable_pending", { count: pending })}` : label;
  const details = [
    t("cloudsync.unreachable_body"),
    pending > 0 ? t("cloudsync.unreachable_pending_notes", { count: pending }) : null,
    lastContact !== null ? t("cloudsync.unreachable_last", { time: formatDateTime(lastContact) }) : null,
    server ? t("cloudsync.unreachable_vpn") : null,
  ].filter(Boolean);

  return (
    <>
      <TouchableOpacity
        style={styles.line}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={line}
      >
        <ExclamationTriangleIcon size={14} color={COLOR.yellow} />
        <Text style={styles.text} numberOfLines={1}>
          {line}
        </Text>
      </TouchableOpacity>

      <ConfirmOrCancelDialog
        open={open}
        title={label}
        description={details.join("\n\n")}
        cancelLabel={t("a11y.close")}
        onCancel={() => setOpen(false)}
        confirmLabel={t("retry")}
        onConfirm={() => {
          setOpen(false);
          void reconnectNow();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: PADDING_MARGIN.xs,
    marginTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fill,
    maxWidth: "100%",
  },
  text: {
    flexShrink: 1,
    color: COLOR.yellow,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
});
