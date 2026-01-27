import { useState, useCallback } from "react";
import type { ToastType } from "components/Toast";

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

interface UseToastReturn {
  toasts: ToastState[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

let toastId = 0;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { message, type, id }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const error = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const warning = useCallback((message: string) => showToast(message, "warning"), [showToast]);
  const info = useCallback((message: string) => showToast(message, "info"), [showToast]);

  return {
    toasts,
    showToast,
    dismissToast,
    success,
    error,
    warning,
    info,
  };
}
