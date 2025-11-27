import styles from './styles.module.css';

// ================================================
// Interface
// ================================================

export interface LogoProps {
    size?: 'small' | 'medium' | 'large';
}

// ================================================
// Component
// ================================================

const Logo = ({ size = 'medium' }: LogoProps) => {
    return (
        <div className={`${styles.logo} ${styles[size]}`}>
            <div className={styles.icon}>
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" stroke="#4CAF50" strokeWidth="3" fill="none" />
                    <path
                        d="M12 20 C12 14, 20 10, 28 14"
                        stroke="#4CAF50"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                    />
                </svg>
            </div>
            <div className={styles.text}>
                <span className={styles.prepare}>PREPARE</span>
                <span className={styles.rehab}>REHAB</span>
            </div>
        </div>
    );
};

export default Logo;

