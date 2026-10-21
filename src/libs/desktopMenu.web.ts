import { type DesktopCommand, IS_MAC, runCommand } from "@/libs/desktopCommands";
import i18n from "@/libs/i18n";
import { isTauri } from "@/utils/platform";

/*
 * The macOS menu bar (Windows and Linux have none: a light menu bar inside the dark window would clash, and the keyboard
 * shortcuts cover the same commands). The Rust shell builds it (`src-tauri/src/lib.rs`), in English until the labels
 * arrive in the app's language, again on every language change. Its items send their id back here.
 */

const MENU_EVENT = "fastmemo://menu";

const MENU_COMMANDS: Record<string, DesktopCommand> = {
  "new-note": "newNote",
  find: "find",
  settings: "settings",
  // Export and import live in the settings, behind the secret code: the menu only leads there.
  "export-import": "settings",
  help: "help",
};

/** The menu's labels in the app's language; `{name}` stands for the app's name (the Rust side fills it in). */
function menuLabels() {
  const t = (key: string) => i18n.t(`menu.${key}`, { name: "{name}" });
  return {
    about: t("about"),
    settings: t("settings"),
    services: t("services"),
    hide: t("hide"),
    hideOthers: t("hide_others"),
    showAll: t("show_all"),
    quit: t("quit"),
    file: t("file"),
    newNote: t("new_note"),
    exportImport: t("export_import"),
    closeWindow: t("close_window"),
    edit: t("edit"),
    undo: t("undo"),
    redo: t("redo"),
    cut: t("cut"),
    copy: t("copy"),
    paste: t("paste"),
    selectAll: t("select_all"),
    find: t("find"),
    view: t("view"),
    fullscreen: t("fullscreen"),
    window: t("window"),
    minimize: t("minimize"),
    zoom: t("zoom"),
    help: t("help"),
    helpItem: t("help_item"),
  };
}

export function installDesktopMenu(): void {
  if (!isTauri() || !IS_MAC) return;

  Promise.all([import("@tauri-apps/api/core"), import("@tauri-apps/api/event")])
    .then(([{ invoke }, { listen }]) => {
      const sendLabels = () => {
        invoke("set_menu_labels", { labels: menuLabels() }).catch(() => {});
      };
      sendLabels();
      i18n.on("languageChanged", sendLabels);

      return listen<string>(MENU_EVENT, ({ payload }) => {
        const command = MENU_COMMANDS[payload];
        if (command) void runCommand(command);
      });
    })
    .catch(() => {});
}
