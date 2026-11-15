import type { LaunchAction } from "@/libs/launch/parse";

/** What the home does with a launch action. Pure. */
export type LaunchStep =
  | { do: "nothing" }
  | { do: "notFound" }
  | { do: "share" }
  | {
      do: "open";
      route: string;
      /** A hidden note while hidden notes aren't shown. */
      askCode: boolean;
      dictate: boolean;
    };

export interface LaunchContext {
  introFinished: boolean;
  showHidden: boolean;
  /** A live note (not trashed) by its id. */
  findNote: (id: string) => { hidden: boolean } | undefined;
}

/**
 * Before the intro is finished nothing happens. A new note opens its type's route (`NOTE_TYPES`' routes), dictation a new
 * text note; a note opens if it is live (a protected one is asked for its code by its own screen), with the secret code
 * first when it is hidden and hidden notes aren't shown.
 */
export function planLaunch(action: LaunchAction, ctx: LaunchContext): LaunchStep {
  if (!ctx.introFinished) return { do: "nothing" };
  switch (action.kind) {
    case "new":
      return { do: "open", route: `/notes/new-${action.type}`, askCode: false, dictate: false };
    case "dictate":
      return { do: "open", route: "/notes/new-text", askCode: false, dictate: true };
    case "note": {
      const note = ctx.findNote(action.id);
      if (!note) return { do: "notFound" };
      return { do: "open", route: `/notes/${action.id}`, askCode: note.hidden && !ctx.showHidden, dictate: false };
    }
    case "share":
      return { do: "share" };
  }
}
