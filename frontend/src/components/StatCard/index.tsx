import classNames from "classnames";
import styles from "./styles.module.css";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: "default" | "blue" | "green" | "orange";
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color = "default", className }) => {
  return (
    <div className={classNames(styles["stat-card"], className)}>
      <div
        className={classNames(styles["stat-card__value"], {
          [styles["stat-card__value--blue"]]: color === "blue",
          [styles["stat-card__value--green"]]: color === "green",
          [styles["stat-card__value--orange"]]: color === "orange",
        })}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className={styles["stat-card__label"]}>{label}</div>
    </div>
  );
};

export default StatCard;
