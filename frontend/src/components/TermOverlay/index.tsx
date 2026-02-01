import React from "react";
import classNames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripVertical } from "@fortawesome/free-solid-svg-icons";

import type { ClusteredTerm } from "@/types";

import styles from "@components/DraggableTerm/styles.module.css";

interface TermOverlayProps {
  term: ClusteredTerm;
}

const TermOverlay: React.FC<TermOverlayProps> = ({ term }) => {
  return (
    <div className={classNames(styles["term-item"], styles["term-item--overlay"], styles["term-item--no-remove"])}>
      <div className={styles["term__drag-handle"]}>
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
    </div>
  );
};

export default TermOverlay;
