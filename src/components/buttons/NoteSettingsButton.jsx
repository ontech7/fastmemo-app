import * as LocalAuthentication from "expo-local-authentication";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  BookOpenIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  EyeSlashIcon,
  KeyIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useDispatch, useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";
import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import { storeSecretCodeCallback } from "@/libs/registry";
import { temporaryDeleteNote } from "../../slicers/notesSlice";
import { selectorIsFingerprintEnabled, selectorWebhook_temporaryDeleteNote } from "../../slicers/settingsSlice";
import ContextMenu from "../renderers/ContextMenu";

export default function NoteSettingsButton({ note, setNote }) {
  const { t } = useTranslation();

  const router = useRouter();

  const { id, type, title, important, readOnly, hidden, locked } = note;

  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const selectorFingerprintEnabled = useSelector(selectorIsFingerprintEnabled);

  const dispatch = useDispatch();

  const deleteNoteFromItems = () => {
    dispatch(temporaryDeleteNote(id));
    webhook(webhook_temporaryDeleteNote, {
      action: "note/temporaryDeleteNote",
      id: id,
    });
    router.back();
  };

  const toggleImportantNoteFromItems = () => {
    setNote({ ...note, important: !important });
  };

  const toggleProtectedNoteFromItems = () => {
    if (!selectorFingerprintEnabled) {
      storeSecretCodeCallback(() => {
        setNote({ ...note, locked: !locked });
      });

      router.push({
        pathname: "/secret-code",
        params: {
          startPhase: "toggleGeneric",
        },
      });
      return;
    }

    LocalAuthentication.authenticateAsync().then((authResult) => {
      if (authResult?.success) {
        setNote({ ...note, locked: !locked });
      }
    });
  };

  const toggleReadOnlyNoteFromItems = () => {
    setNote({ ...note, readOnly: !readOnly });
  };

  const toggleHiddenNoteFromItems = () => {
    setNote({ ...note, hidden: !hidden });
  };

  const changeCategory = () => {
    router.push({
      pathname: "/categories/change",
      params: {
        noteId: id,
      },
    });
  };

  return (
    <Menu renderer={ContextMenu}>
      <MenuTrigger customStyles={{ TriggerTouchableComponent: TouchableOpacity }}>
        <EllipsisVerticalIcon size={28} color={COLOR.softWhite} />
      </MenuTrigger>

      <MenuOptions customStyles={menuOptionsCustomStyles}>
        <MenuOption style={[styles.menuOption, !id && styles.menuOptionDisabled]} disabled={!id} onSelect={deleteNoteFromItems}>
          <Text style={styles.menuOptionText}>{t("note.settings.delete")}</Text>

          <TrashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleImportantNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {important && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, important && styles.menuOptionTextSelected]}>
              {t("note.settings.important")}
            </Text>
          </View>

          <StarIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleProtectedNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {locked && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, locked && styles.menuOptionTextSelected]}>{t("note.settings.protect")}</Text>
          </View>

          <KeyIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleReadOnlyNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {readOnly && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, readOnly && styles.menuOptionTextSelected]}>
              {t("note.settings.readonly")}
            </Text>
          </View>

          <BookOpenIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        <MenuOption style={styles.menuOption} onSelect={toggleHiddenNoteFromItems}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {hidden && <CheckIcon size={16} color={COLOR.softWhite} style={{ marginRight: 5 }} />}

            <Text style={[styles.menuOptionText, hidden && styles.menuOptionTextSelected]}>{t("note.settings.hide")}</Text>
          </View>

          <EyeSlashIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
        </MenuOption>

        {note.createdAt !== note.updatedAt && (
          <MenuOption style={[styles.menuOption, !id && styles.menuOptionDisabled]} disabled={!id} onSelect={changeCategory}>
            <Text style={styles.menuOptionText}>{t("note.settings.changecategory")}</Text>

            <TagIcon style={styles.menuOptionIcon} size={16} color={COLOR.softWhite} />
          </MenuOption>
        )}
      </MenuOptions>
    </Menu>
  );
}

/* STYLES */

const menuOptionsCustomStyles = {
  optionsContainer: {
    marginTop: 35,
    marginRight: 5,
    backgroundColor: COLOR.blue,
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
  },
  optionsWrapper: {
    backgroundColor: COLOR.blue,
  },
};

const styles = StyleSheet.create({
  menuViewWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuOption: {
    padding: PADDING_MARGIN.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuOptionDisabled: {
    opacity: 0.5,
  },
  menuOptionIcon: {
    marginLeft: PADDING_MARGIN.lg,
  },
  menuOptionText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
  },
  menuOptionTextSelected: {
    fontWeight: FONTWEIGHT.semiBold,
  },
});
