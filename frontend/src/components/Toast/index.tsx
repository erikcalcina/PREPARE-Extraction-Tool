import React, { useEffect } from "react";
import classNames from "classnames";

import Button from "@components/Button";

import styles from "./styles.module.css";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = "info", duration = 3000, onClose }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={classNames(styles.toast, styles[`toast--${type}`])} role="alert" aria-live="polite">
      <span className={styles["toast__icon"]}>{getIcon(type)}</span>
      <span className={styles["toast__message"]}>{message}</span>
      <Button
        variant="ghost"
        size="icon"
        className={styles["toast__close-button"]}
        onClick={onClose}
        aria-label="Close notification"
      >
        &times;
      </Button>
    </div>
  );
};

function getIcon(type: ToastType): string {
  switch (type) {
    case "success":
      return "\u2713";
    case "error":
      return "\u2717";
    case "warning":
      return "\u26A0";
    case "info":
    default:
      return "\u2139";
  }
}

export default Toast;
