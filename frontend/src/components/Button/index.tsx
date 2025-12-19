import classNames from 'classnames';

import styles from './styles.module.css';

// ====================================
// Interface
// ====================================

export interface ButtonProps {
    /** Is this the principal call to action on the page? */
    primary?: boolean;
    /** What background color to use */
    backgroundColor?: string;
    /** How large should the button be? */
    size?: 'small' | 'medium' | 'large';
    /** Button contents */
    label: string;
    /** Button type */
    type?: 'button' | 'submit' | 'reset';
    /** Disabled state */
    disabled?: boolean;
    /** Optional click handler */
    onClick?: () => void;
}

// ====================================
// Component
// ====================================

/** Primary UI component for user interaction */
const Button = ({
    primary = false,
    size = 'medium',
    type = 'button',
    backgroundColor,
    label,
    ...props
}: ButtonProps) => {
    const mode = primary ? styles.primary : styles.secondary;
    return (
        <button
            type={type}
            className={classNames(styles.button, styles[size], mode)}
            style={{ backgroundColor }}
            {...props}
        >
            {label}
        </button>
    );
};

export default Button;