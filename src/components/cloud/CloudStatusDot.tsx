import { useTranslation } from "react-i18next";
import type { StyleProp, ViewStyle } from "react-native";
import { useSelector } from "react-redux";

import BlinkingDot from "@/components/ui/BlinkingDot";
import { CLOUD_STATE_COLOR } from "@/constants/styles";
import { cloudStateKey, useCloudStatus } from "@/hooks/useCloudStatus";
import { providerOf } from "@/libs/cloud/scope";
import { getCloudSettings } from "@/slicers/settingsSlice";

interface Props {
  /** Next to a text that already says the state: the dot only decorates it. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The cloud's state at a glance (ADR-029): green and pinging, grey offline, red unreachable. Nothing while not connected. */
export default function CloudStatusDot({ decorative = false, style }: Props) {
  const { t } = useTranslation();
  const server = providerOf(useSelector(getCloudSettings)) === "server";
  const { state } = useCloudStatus();
  if (!state) return null;

  return (
    <BlinkingDot
      color={CLOUD_STATE_COLOR[state]}
      animation={state === "ok" ? "ping" : "none"}
      accessibilityLabel={decorative ? undefined : t(cloudStateKey(state, server))}
      style={style}
    />
  );
}
