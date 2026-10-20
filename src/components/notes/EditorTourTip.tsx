import TourSpotlight from "@/components/ui/TourSpotlight";
import { selectorTourStep, setTourStep } from "@/slicers/settingsSlice";
import type { RootState } from "@/types";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector, useStore } from "react-redux";

/**
 * The first-note tour's step inside an editor (rendered last, over the whole editor): the back button lit up, and
 * tappable. Opening a note is what the first step asked for; "Got it" or leaving the editor moves the tour on to its
 * last step, on the list.
 */
export default function EditorTourTip() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const step = useSelector(selectorTourStep);

  useEffect(() => {
    if (step === "create") dispatch(setTourStep("write"));
  }, [step, dispatch]);

  useEffect(
    () => () => {
      if (selectorTourStep(store.getState()) === "write") dispatch(setTourStep("explore"));
    },
    [store, dispatch]
  );

  if (step !== "write") return null;

  return (
    <TourSpotlight
      targets={["back"]}
      passThrough
      step={2}
      total={3}
      title={t("tour.write_title")}
      text={t("tour.write_text")}
      actionLabel={t("tour.got_it")}
      onAction={() => dispatch(setTourStep("explore"))}
      onSkip={() => dispatch(setTourStep("done"))}
    />
  );
}
