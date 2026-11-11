import { useSegments } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { addTrail, setDiagnosticsContext } from "@/libs/diagnostics";
import type { CloudKind } from "@/libs/diagnostics/report";
import { providerOf } from "@/libs/cloud/scope";
import { getCloudConnected, getCloudSettings } from "@/slicers/settingsSlice";

/**
 * Keeps Sentry's tags and trail in step with the app (ADR-035): the language and the kind of cloud as tags, each route as
 * a trail step. The route is expo-router's segments, already a pattern (`notes/[noteId]`): never an id.
 */
export default function DiagnosticsProvider(): null {
  const { i18n } = useTranslation();
  const language = i18n.language;

  const isCloudConnected = useSelector(getCloudConnected);
  const cloudSettings = useSelector(getCloudSettings);
  const provider = providerOf(cloudSettings);
  const serverUrl = provider === "server" ? cloudSettings?.serverUrl : undefined;
  const cloud: CloudKind = isCloudConnected ? provider : "none";

  useEffect(() => {
    setDiagnosticsContext({ language, cloud, serverUrl });
  }, [language, cloud, serverUrl]);

  const segments = useSegments();
  const route = segments.join("/") || "index";
  useEffect(() => {
    addTrail("route", { name: route });
  }, [route]);

  return null;
}
