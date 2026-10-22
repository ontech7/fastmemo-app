import { requireOptionalNativeModule } from "expo";

import type { FastmemoDownloadsApi } from "./FastmemoDownloads.types";

// Optional: Android only, and a binary built before this module existed (an old dev client) has none: callers download in
// the app instead.
export default requireOptionalNativeModule<FastmemoDownloadsApi>("FastmemoDownloads");
