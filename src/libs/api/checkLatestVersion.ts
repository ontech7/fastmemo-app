import { configs } from "@/configs";
import type { AppVersionResponse } from "@/types";

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Fetches the latest published app version info from the FastMemo backend.
 *
 * Returns `null` if the API URL is not configured, the request fails,
 * the response is not OK, or the body does not match the expected shape.
 * The caller is expected to silently skip the update prompt in all those cases.
 */
export async function checkLatestAppVersion(): Promise<AppVersionResponse | null> {
  if (!configs.apiUrl) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${configs.apiUrl}/version`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as AppVersionResponse;

    if (
      !data ||
      typeof data !== "object" ||
      typeof data.releaseUrl !== "string" ||
      !data.mobile ||
      typeof data.mobile.version !== "string" ||
      !data.desktop ||
      typeof data.desktop.version !== "string"
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
