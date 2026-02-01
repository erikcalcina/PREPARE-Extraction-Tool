import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/Button";

import styles from "./styles.module.css";

interface NavButton {
  label: string;
  to: string;
  title?: string;
}

interface WorkflowPageHeaderProps {
  title: string;
  datasetId: string;
  datasetName?: string;
  backButton: NavButton;
  forwardButton: NavButton;
  helpContent?: React.ReactNode;
}

const WorkflowPageHeader: React.FC<WorkflowPageHeaderProps> = ({
  title,
  datasetId,
  datasetName,
  backButton,
  forwardButton,
  helpContent,
}) => {
  const navigate = useNavigate();

  return (
    <div className={styles["header"]}>
      <Button variant="outline" onClick={() => navigate(backButton.to)} title={backButton.title}>
        &larr; {backButton.label}
      </Button>

      <div className={styles["header__info"]}>
        <h1 className={styles["header__title"]}>
          {title}
          {helpContent && (
            <span className={styles["info-tooltip"]}>
              <FontAwesomeIcon icon={faCircleQuestion} className={styles["info-tooltip__icon"]} />
              <span className={styles["info-tooltip__content"]}>{helpContent}</span>
            </span>
          )}
        </h1>
        <Button
          variant="ghost"
          className={styles["header__dataset-link"]}
          onClick={() => navigate(`/datasets/${datasetId}`)}
          title="Go to Dataset Overview"
        >
          Dataset: {datasetName || "Loading..."}
        </Button>
      </div>

      <Button variant="outline" onClick={() => navigate(forwardButton.to)} title={forwardButton.title}>
        {forwardButton.label} &rarr;
      </Button>
    </div>
  );
};

export default WorkflowPageHeader;
