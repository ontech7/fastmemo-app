import React, { memo } from "react";

import SectionList from "./components/list/SectionList";
import SectionHeader from "./components/SectionHeader";
import SectionWrapper from "./components/SectionWrapper";

function Section({ title, icon, sectionItems }) {
  return (
    <SectionWrapper>
      <SectionHeader title={title} icon={icon} />

      <SectionList>
        {sectionItems.map((SectionComp, i) => (
          <SectionComp key={`section_${title}_${i}`} isLast={i == sectionItems.length - 1} />
        ))}
      </SectionList>
    </SectionWrapper>
  );
}

export default memo(Section);
