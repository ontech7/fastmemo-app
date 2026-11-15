import { useSyncExternalStore } from "react";

import { getWhatsNewPhase, subscribeWhatsNew } from "@/libs/whatsNew";
import type { WhatsNewPhase } from "@/libs/whatsNew";

/** Where the news of a new version is: nowhere, the home's message, or the sidebar's icon (libs/whatsNew). */
export const useWhatsNew = (): WhatsNewPhase => useSyncExternalStore(subscribeWhatsNew, getWhatsNewPhase, getWhatsNewPhase);
