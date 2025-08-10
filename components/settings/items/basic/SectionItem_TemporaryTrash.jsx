import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { getTemporaryTrashTimespan, setTemporaryTrashTimespan } from "../../../../slicers/notesSlice";
import SectionItemList_Text from "../../components/item/SectionItemList_Text";
import SectionItemList from "../../components/list/SectionItemList";

export default function SectionItem_TemporaryTrash({ isLast }) {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const currTimespan = useSelector(getTemporaryTrashTimespan);

  const changeTemporasyTrashTimespan = () => {
    let nextTimespan = currTimespan;

    switch (currTimespan) {
      case 3:
        nextTimespan = 7;
        break;
      case 7:
        nextTimespan = 15;
        break;
      case 15:
        nextTimespan = 30;
        break;
      case 30:
        nextTimespan = 3;
        break;
      default:
        break;
    }

    dispatch(setTemporaryTrashTimespan(nextTimespan));
  };

  return (
    <SectionItemList isLast={isLast}>
      <SectionItemList_Text
        title={t("generalsettings.temporary_trash_lifespan")}
        text={`${currTimespan} ${t("generalsettings.days")}`}
        onPress={changeTemporasyTrashTimespan}
      />
    </SectionItemList>
  );
}
