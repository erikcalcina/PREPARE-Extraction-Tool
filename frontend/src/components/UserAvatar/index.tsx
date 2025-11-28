import styles from './styles.module.css';

// ================================================
// Interface
// ================================================

export interface UserAvatarProps {
    username: string;
    size?: 'small' | 'medium' | 'large';
    onClick?: () => void;
}

// ================================================
// Component
// ================================================

const UserAvatar = ({ username, size = 'medium', onClick }: UserAvatarProps) => {
    // Get initials from username (up to 2 characters)
    const getInitials = (name: string): string => {
        const parts = name.split(/[_\s-]+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const initials = getInitials(username);

    return (
        <button
            className={`${styles.avatar} ${styles[size]}`}
            onClick={onClick}
            title={username}
            type="button"
        >
            {initials}
        </button>
    );
};

export default UserAvatar;

