import React from "react";
import classNames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripVertical } from "@fortawesome/free-solid-svg-icons";

import type { ClusterData } from "@/types";

import styles from "@components/ClusterCard/styles.module.css";

interface ClusterOverlayProps {
  cluster: ClusterData;
}

const ClusterOverlay: React.FC<ClusterOverlayProps> = ({ cluster }) => {
  return (
    <div className={classNames(styles["cluster-card"], styles["cluster-card--overlay"])}>
      <div className={styles["cluster-card__header"]}>
        <div className={styles["cluster-card__drag-handle"]}>
          <FontAwesomeIcon icon={faGripVertical} />
        </div>
        <div className={styles["cluster-card__name"]}>
          <div className={styles["cluster-card__name-display"]}>
            <h3>{cluster.title}</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClusterOverlay;
