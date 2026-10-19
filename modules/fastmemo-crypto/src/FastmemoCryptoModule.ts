import { requireOptionalNativeModule } from "expo";

import type { FastmemoCryptoApi } from "./FastmemoCrypto.types";

// Optional: a binary built before this module existed (an old dev client) simply has none, and
// callers fall back to the JS implementation.
export default requireOptionalNativeModule<FastmemoCryptoApi>("FastmemoCrypto");
