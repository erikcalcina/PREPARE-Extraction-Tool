import React from "react";
import { useDroppable } from "@dnd-kit/core";
import classNames from "classnames";

import DraggableTerm from "@components/DraggableTerm";
import type { ClusteredTerm } from "@/types";

import styles from "./styles.module.css";

interface DroppableUnclusteredAreaProps {
  terms: ClusteredTerm[];
  readOnly?: boolean;
}

const DroppableUnclusteredArea: React.FC<DroppableUnclusteredAreaProps> = ({ terms, readOnly = false }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "unclustered",
    data: { clusterId: null },
    disabled: readOnly,
  });

  return (
    <div className={styles["droppable-unclustered-area"]}>
      <h2>Unclustered Terms ({terms.length})</h2>
      <div
        ref={setNodeRef}
        className={classNames(styles["droppable-unclustered-area__drop-zone"], {
          [styles["droppable-unclustered-area__drop-zone--drag-over"]]: isOver,
        })}
      >
        {terms.map((term) => (
          <DraggableTerm key={term.term_id} term={term} clusterId={null} readOnly={readOnly} />
        ))}
      </div>
    </div>
  );
};

export default DroppableUnclusteredArea;
