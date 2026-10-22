import { postWebhook } from "@/libs/net";
import type { WebhookPayload } from "@/types";

export const webhook = async (payload: WebhookPayload, body: Record<string, unknown> = {}): Promise<void> => {
  if (!payload || !payload.enabled || !payload.url) {
    return;
  }

  try {
    await postWebhook(
      payload.url,
      JSON.stringify({
        success: true,
        ...body,
      })
    );
  } catch (err) {
    console.log(err);
  }
};
