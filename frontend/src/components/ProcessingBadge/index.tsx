import React from "react";
import classNames from "classnames";

import type { ProcessingStatus } from "@/types";
import LoadingSpinner from "@components/LoadingSpinner";
import styles from "./styles.module.css";

interface ProcessingBadgeProps {
  status: ProcessingStatus;
  errorMessage?: string | null;
}

const ProcessingBadge: React.FC<ProcessingBadgeProps> = ({ status, errorMessage }) => {
  if (status === "DONE") return null;

  if (status === "PENDING" || status === "PROCESSING") {
    const label = status === "PENDING" ? "Pending" : "Processing";
    return (
      <span className={classNames(styles["processing-badge"], styles["processing-badge--active"])}>
        <LoadingSpinner size="small" />
        {label}
      </span>
    );
  }

  if (status === "FAILED") {
    return (
      <span
        className={classNames(styles["processing-badge"], styles["processing-badge--failed"])}
        title={errorMessage || "Processing failed"}
      >
        Failed
      </span>
    );
  }

  return null;
};

export default ProcessingBadge;
