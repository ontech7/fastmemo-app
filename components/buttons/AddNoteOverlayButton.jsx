import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PlusIcon, XMarkIcon } from "react-native-heroicons/outline";

import { useRouter } from "@/hooks/useRouter";

import { NOTE_TYPES } from "@/constants/note-types";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function AddNoteOverlayButton({ isDeleteMode, toggleDeleteMode }) {
  const { t } = useTranslation();
  const router = useRouter();

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const toggleOverlay = () => {
    if (isDeleteMode) {
      toggleDeleteMode();
      return;
    }

    setIsOverlayOpen((p) => !p);
  };

  const closeOverlay = () => {
    setIsOverlayOpen(false);
  };

  const handleNoteTypePress = (route) => {
    closeOverlay();
    router.push(route);
  };

  useEffect(() => {
    const backAction = () => {
      if (isOverlayOpen) {
        setIsOverlayOpen(false);
        return true;
      }
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [isOverlayOpen]);

  const showCloseIcon = isOverlayOpen || isDeleteMode;

  return (
    <>
      {isOverlayOpen && (
        <Pressable style={styles.fullscreenOverlay} onPress={closeOverlay}>
          <View style={styles.overlayContainer}>
            {NOTE_TYPES.map((noteType) => {
              const Icon = noteType.icon;
              return (
                <TouchableOpacity
                  key={noteType.key}
                  style={styles.noteTypeButton}
                  activeOpacity={0.7}
                  onPress={() => handleNoteTypePress(noteType.route)}
                >
                  <Text style={styles.noteTypeLabel}>{t(noteType.labelKey)}</Text>
                  <View style={styles.noteTypeIconContainer}>
                    <Icon size={28} color={COLOR.darkBlue} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.7} onPress={toggleOverlay}>
        {showCloseIcon ? <XMarkIcon size={28} color={COLOR.darkBlue} /> : <PlusIcon size={28} color={COLOR.darkBlue} />}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    zIndex: 10,
    position: "absolute",
    bottom: 60,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  fullscreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    paddingBottom: 130,
    paddingRight: 40,
    zIndex: 5,
  },
  overlayContainer: {
    gap: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.lg,
  },
  noteTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: PADDING_MARGIN.lg,
  },
  noteTypeLabel: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  noteTypeIconContainer: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
});
