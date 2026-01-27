import React from "react";
import styles from "./styles.module.css";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "medium", text }) => {
  return (
    <div className={styles.container} role="status" aria-label={text || "Loading"}>
      <div className={`${styles.spinner} ${styles[`spinner--${size}`]}`} />
      {text && <span className={styles.text}>{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
