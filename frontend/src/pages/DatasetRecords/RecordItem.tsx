import React from "react";
import classNames from "classnames";

import type { Record as RecordType } from "@/types";

import styles from "./styles.module.css";

interface RecordItemProps {
  record: RecordType;
  isSelected: boolean;
  onClick: () => void;
}

const RecordItem: React.FC<RecordItemProps> = ({ record, isSelected, onClick }) => {
  return (
    <div className={classNames(styles.recordItem, { [styles.selected]: isSelected })} onClick={onClick}>
      <div className={styles.recordItemHeader}>
        <span className={styles.recordId}>Patient ID: {record.patient_id}</span>
        <span className={styles.recordId}>{record.seq_number && `#${record.seq_number}`}</span>
      </div>
      <div className={styles.recordPreview}>
        {record.text.slice(0, 150)}
        {record.text.length > 150 ? "..." : ""}
      </div>
      <div className={styles.recordStatus}>
        <span className={styles.termCount}>
          {record.source_term_count > 0
            ? `${record.source_term_count} term${record.source_term_count !== 1 ? "s" : ""}`
            : "No terms"}
        </span>
        {record.reviewed && <span className={classNames(styles.statusBadge, styles.reviewed)}>Reviewed</span>}
      </div>
    </div>
  );
};

export default RecordItem;
