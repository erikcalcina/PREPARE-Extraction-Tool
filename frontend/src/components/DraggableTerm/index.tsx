import React from "react";
import { useDraggable } from "@dnd-kit/core";
import classNames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripVertical, faXmark } from "@fortawesome/free-solid-svg-icons";

import Button from "@components/Button";
import type { ClusteredTerm } from "@/types";

import styles from "./styles.module.css";

interface DraggableTermProps {
  term: ClusteredTerm;
  clusterId: number | null;
  onRemove?: (termId: number) => void;
}

const DraggableTerm: React.FC<DraggableTermProps> = ({ term, clusterId, onRemove }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `term-${term.term_id}`,
    data: { termId: term.term_id, sourceClusterId: clusterId, term },
  });

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(term.term_id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={classNames(styles["term-item"], {
        [styles["term-item--dragging"]]: isDragging,
        [styles["term-item--no-remove"]]: !onRemove,
      })}
    >
      <div className={styles["term__drag-handle"]} {...listeners} {...attributes}>
        <FontAwesomeIcon icon={faGripVertical} />
      </div>
      <span className={styles["term__text"]}>{term.text}</span>
      <div className={styles["term__stats"]}>
        <span className={styles["term__frequency"]}>{term.frequency}</span>
        <div className={styles["term__frequency-bar"]}>
          <div
            className={styles["term__frequency-bar-fill"]}
            style={{ width: `${Math.min(100, (term.frequency / 20) * 100)}%` }}
          />
        </div>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className={styles["term__remove-btn"]}
          onClick={handleRemove}
          title="Remove from cluster"
        >
          <FontAwesomeIcon icon={faXmark} />
        </Button>
      )}
    </div>
  );
};

export default DraggableTerm;
