import React from "react";
import type { ToastType } from "./index";
import Toast from "./index";
import styles from "./styles.module.css";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
  duration?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss, duration = 3000 }) => {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={duration}
          onClose={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
