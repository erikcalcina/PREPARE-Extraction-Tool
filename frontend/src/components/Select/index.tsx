import React, { useState, useRef, useEffect } from "react";
import styles from "./styles.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  placeholder?: string;

  // Single select
  value?: string;
  onValueChange?: (value: string) => void;

  // Multi select
  multiSelect?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;

  // Optional filter mode (shows checkbox when provided)
  label?: string;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;

  // Additional props for flexibility
  size?: "small" | "medium";
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select...",
  value,
  onValueChange,
  multiSelect = false,
  values = [],
  onValuesChange,
  label,
  enabled = true,
  onEnabledChange,
  size = "medium",
  fullWidth = true,
  disabled = false,
  className,
  id,
  "aria-label": ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if filter mode is active (shows checkbox header)
  const isFilterMode = label !== undefined && onEnabledChange !== undefined;

  // Combined disabled state
  const isDisabled = disabled || (isFilterMode && !enabled);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isDisabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSingleSelect = (optionValue: string) => {
    if (onValueChange) {
      onValueChange(optionValue);
    }
    setIsOpen(false);
  };

  const handleMultiSelect = (optionValue: string) => {
    if (!onValuesChange) return;

    if (values.includes(optionValue)) {
      onValuesChange(values.filter((v) => v !== optionValue));
    } else {
      onValuesChange([...values, optionValue]);
    }
  };

  const getDisplayText = () => {
    if (multiSelect) {
      if (values.length === 0) return placeholder;
      if (values.length === 1) {
        const option = options.find((o) => o.value === values[0]);
        return option?.label || values[0];
      }
      return `${values.length} selected`;
    } else {
      if (!value) return placeholder;
      const option = options.find((o) => o.value === value);
      return option?.label || value;
    }
  };

  const containerClasses = [
    styles.select,
    isDisabled ? styles["select--disabled"] : "",
    size === "small" ? styles["select--small"] : "",
    fullWidth ? styles["select--fullWidth"] : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={containerClasses} id={id}>
      {isFilterMode && (
        <div className={styles.select__header}>
          <label className={styles.select__checkboxLabel}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange?.(e.target.checked)}
              className={styles.select__checkbox}
            />
            <span className={styles.select__label}>{label}</span>
          </label>
        </div>
      )}

      <button
        type="button"
        className={styles.select__trigger}
        onClick={handleToggle}
        disabled={isDisabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <span className={styles.select__triggerText}>{getDisplayText()}</span>
        <span className={styles.select__arrow}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && !isDisabled && (
        <div className={styles.select__menu} role="listbox">
          {options.length === 0 ? (
            <div className={styles.select__empty}>No options available</div>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                className={`${styles.select__option} ${
                  multiSelect
                    ? values.includes(option.value)
                      ? styles["select__option--selected"]
                      : ""
                    : value === option.value
                      ? styles["select__option--selected"]
                      : ""
                }`}
                onClick={() => (multiSelect ? handleMultiSelect(option.value) : handleSingleSelect(option.value))}
                role="option"
                aria-selected={multiSelect ? values.includes(option.value) : value === option.value}
              >
                {multiSelect && (
                  <input
                    type="checkbox"
                    checked={values.includes(option.value)}
                    onChange={() => handleMultiSelect(option.value)}
                    className={styles.select__optionCheckbox}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <span className={styles.select__optionLabel}>{option.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Select;
