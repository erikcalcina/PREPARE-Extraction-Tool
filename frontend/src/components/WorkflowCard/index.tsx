import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "@/components/Button";
import styles from "./styles.module.css";

interface WorkflowCardProps {
  title: string;
  description: string;
  icon?: any;
  stats: Array<{ label: string; value: string | number }>;
  progress?: { current: number; total: number };
  actions: Array<{ label: string; onClick: () => void; variant?: "primary" | "secondary" }>;
}

const WorkflowCard = ({ title, description, icon, stats, progress, actions }: WorkflowCardProps) => {
  const progressPercentage = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className={styles.card}>
      <div className={styles.card__header}>
        <div>
          <h3 className={styles.card__title}>{title}</h3>
          <p className={styles.card__description}>{description}</p>
        </div>
        {icon && <FontAwesomeIcon icon={icon} className={styles.card__icon} />}
      </div>

      <div className={styles.card__stats}>
        {stats.map((stat, idx) => (
          <div key={idx} className={styles.card__stat}>
            <span className={styles["card__stat-label"]}>{stat.label}</span>
            <span className={styles["card__stat-value"]}>{stat.value}</span>
          </div>
        ))}
      </div>

      {progress && (
        <div className={styles.card__progress}>
          <div className={styles["card__progress-header"]}>
            <span className={styles["card__progress-label"]}>Progress</span>
            <span className={styles["card__progress-text"]}>
              {progress.current} / {progress.total} ({Math.round(progressPercentage)}%)
            </span>
          </div>
          <div className={styles["card__progress-bar"]}>
            <div className={styles["card__progress-fill"]} style={{ width: `${Math.min(100, progressPercentage)}%` }} />
          </div>
        </div>
      )}

      <div className={styles.card__actions}>
        {actions.map((action, idx) => (
          <Button
            key={idx}
            onClick={action.onClick}
            variant={action.variant === "primary" ? "primary" : "outline"}
            className={styles.card__button}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default WorkflowCard;
