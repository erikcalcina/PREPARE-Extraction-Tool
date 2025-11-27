import { useState, useRef, useEffect, ReactNode } from 'react';
import styles from './styles.module.css';

// ================================================
// Interface
// ================================================

export interface DropdownItem {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    variant?: 'default' | 'danger';
}

export interface DropdownProps {
    trigger: ReactNode;
    items: DropdownItem[];
    align?: 'left' | 'right';
}

// ================================================
// Component
// ================================================

const Dropdown = ({ trigger, items, align = 'right' }: DropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Close dropdown on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleItemClick = (item: DropdownItem) => {
        item.onClick();
        setIsOpen(false);
    };

    return (
        <div className={styles.dropdown} ref={dropdownRef}>
            <div
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
            >
                {trigger}
            </div>

            {isOpen && (
                <div className={`${styles.menu} ${styles[align]}`}>
                    {items.map((item, index) => (
                        <button
                            key={index}
                            className={`${styles.item} ${item.variant === 'danger' ? styles.danger : ''}`}
                            onClick={() => handleItemClick(item)}
                            type="button"
                        >
                            {item.icon && <span className={styles.icon}>{item.icon}</span>}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dropdown;

