import styles from './styles.module.css';

// ================================================
// Interface
// ================================================

export interface ProgressBarProps {
    progress: number; // 0-100
    showPercentage?: boolean;
}

// ================================================
// Component
// ================================================

const ProgressBar = ({ progress, showPercentage = true }: ProgressBarProps) => {
    const clampedProgress = Math.min(Math.max(progress, 0), 100);

    return (
        <div className={styles.container}>
            <div className={styles.barWrapper}>
                <div
                    className={styles.bar}
                    style={{ width: `${clampedProgress}%` }}
                />
            </div>
            {showPercentage && (
                <span className={styles.percentage}>
                    {Math.round(clampedProgress)}%
                </span>
            )}
        </div>
    );
};

export default ProgressBar;

