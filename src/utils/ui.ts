/**
 * Yield to the UI thread so a pending render (e.g. a loading spinner) can paint
 * before a heavy SYNCHRONOUS operation blocks the JS thread.
 *
 * crypto-js PBKDF2 (used at vault init/unlock/passphrase-change) is synchronous
 * and blocks JS for ~1-2s. Without yielding first, `setLoading(true)` never gets
 * a chance to paint before the freeze, so the user sees no feedback. The native
 * ActivityIndicator keeps animating on the UI thread during the freeze once it
 * has been painted.
 */
export const yieldToUI = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));
