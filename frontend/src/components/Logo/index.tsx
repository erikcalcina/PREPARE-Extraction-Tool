import React from "react";

import ToolLogo from "@assets/images/logo.svg?react";

import styles from "./styles.module.css";

export interface LogoProps {
  size?: "small" | "medium" | "large";
}

export const Logo: React.FC<LogoProps> = ({ size = "medium" }) => {
  return (
    <div className={`${styles.logo} ${styles[`logo--${size}`]}`}>
      <ToolLogo />
    </div>
  );
};

export default Logo;