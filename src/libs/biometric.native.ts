// Native (iOS/Android) variant: biometrics go through `expo-local-authentication`.
// Keeps `@tauri-apps/api` out of the React Native bundle (the web sibling owns
// the Tauri path). Mobile devices effectively always have a biometric/PIN
// enrollment, so the section is always offered — matching the prior behavior.

import * as LocalAuthentication from "expo-local-authentication";

export const isBiometricSupported = (): boolean => true;

export const authenticateBiometric = async (_reason: string): Promise<boolean> => {
  const result = await LocalAuthentication.authenticateAsync();
  return !!result?.success;
};
