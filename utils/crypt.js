import { configs } from "@/configs";
import * as LocalAuthentication from "expo-local-authentication";
import CryptoJS from "react-native-crypto-js";

import { storeSecretCodeCallback } from "@/libs/registry";

export const isSecretPassphraseCorrect = (bytes) => {
  try {
    const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
    JSON.parse(convertedBytes);
  } catch (e) {
    return false;
  }
  return true;
};

export const toggleWithSecret = ({ isFingerprintEnabled, router, callback }) => {
  if (!isFingerprintEnabled) {
    storeSecretCodeCallback(callback);

    router.push({
      pathname: "/secret-code",
      params: {
        startPhase: "toggleGeneric",
      },
    });
    return;
  }

  LocalAuthentication.authenticateAsync().then((authResult) => {
    if (authResult?.success) callback();
  });
};

export const CryptNote = {
  encrypt: (note) => {
    const type = note?.type ?? "text";

    if (type === "text") {
      const noteText = CryptoJS.AES.encrypt(note.text, configs.cloud.secretKey).toString();

      return { ...note, text: noteText };
    }

    if (type === "todo") {
      let noteTodoList = [];

      note.list.forEach((todo) =>
        noteTodoList.push({
          ...todo,
          text: CryptoJS.AES.encrypt(todo.text, configs.cloud.secretKey).toString(),
        })
      );

      return { ...note, list: noteTodoList };
    }

    return null;
  },

  decrypt: (note) => {
    const type = note?.type ?? "text";

    if (type === "text") {
      const bytes = CryptoJS.AES.decrypt(note.text, configs.cloud.secretKey);

      const noteText = bytes.toString(CryptoJS.enc.Utf8);

      return { ...note, text: noteText };
    }
    if (type === "todo") {
      let noteTodoList = [];

      note.list.forEach((todo) => {
        const bytes = CryptoJS.AES.decrypt(todo.text, configs.cloud.secretKey);
        const convertedBytes = bytes.toString(CryptoJS.enc.Utf8);
        noteTodoList.push({ ...todo, text: convertedBytes });
      });

      return { ...note, list: noteTodoList };
    }

    return null;
  },
};
