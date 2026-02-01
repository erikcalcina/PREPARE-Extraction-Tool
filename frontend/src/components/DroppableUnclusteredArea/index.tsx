import React from "react";
import { useDroppable } from "@dnd-kit/core";
import classNames from "classnames";

import DraggableTerm from "@components/DraggableTerm";
import type { ClusteredTerm } from "@/types";

import styles from "./styles.module.css";

interface DroppableUnclusteredAreaProps {
  terms: ClusteredTerm[];
}

const DroppableUnclusteredArea: React.FC<DroppableUnclusteredAreaProps> = ({ terms }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "unclustered",
    data: { clusterId: null },
  });

  return (
    <div className={styles["unclustered-section"]}>
      <h2>Unclustered Terms ({terms.length})</h2>
      <div
        ref={setNodeRef}
        className={classNames(styles["unclustered-area"], {
          [styles["unclustered-area--drag-over"]]: isOver,
        })}
      >
        {terms.map((term) => (
          <DraggableTerm key={term.term_id} term={term} clusterId={null} />
        ))}
      </div>
    </div>
  );
};

export default DroppableUnclusteredArea;
