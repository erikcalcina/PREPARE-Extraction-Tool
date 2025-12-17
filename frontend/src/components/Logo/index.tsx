import styles from './styles.module.css';
import ToolLogo from 'assets/images/logo.svg?react';

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
            <ToolLogo />
        </div>
    );
};

export default Logo;