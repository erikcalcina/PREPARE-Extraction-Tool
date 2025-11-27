import { useEffect } from 'react';
import styles from './styles.module.css';

// ================================================
// Interface
// ================================================

export interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    width?: string;
    children: React.ReactNode;
}

// ================================================
// Component
// ================================================

const Sidebar = ({ isOpen, onClose, title, width = '400px', children }: SidebarProps) => {
    // Close sidebar on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`${styles.backdrop} ${isOpen ? styles.visible : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sidebar panel */}
            <aside
                className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
                style={{ width }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <header className={styles.header}>
                    <h2 className={styles.title}>{title}</h2>
                    <button
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Close sidebar"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M15 5L5 15M5 5L15 15"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </header>
                <div className={styles.content}>
                    {children}
                </div>
            </aside>
        </>
    );
};

export default Sidebar;

