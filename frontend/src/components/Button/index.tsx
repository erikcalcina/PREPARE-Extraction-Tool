import React, { forwardRef } from "react";
import classNames from "classnames";

import styles from "./styles.module.css";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "ghost" | "outline";
  /** Button size */
  size?: "small" | "medium" | "large" | "icon";
  /** Button text (alternative to children) */
  label?: string;
  /** Button content (takes priority over label) */
  children?: React.ReactNode;
  /** Color scheme modifier for ghost/outline variants */
  colorScheme?: "default" | "danger" | "primary";
}

/** Primary UI component for user interaction */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "medium",
      type = "button",
      label,
      children,
      colorScheme = "default",
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={classNames(
          styles.button,
          styles[`button--${variant}`],
          styles[`button--${size}`],
          {
            [styles[`button--color-${colorScheme}`]]: colorScheme !== "default",
          },
          className
        )}
        {...props}
      >
        {children ?? label}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
