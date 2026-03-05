import React, { useEffect, useCallback, useState, useRef } from "react";
import classNames from "classnames";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faCheck } from "@fortawesome/free-solid-svg-icons";

import Sidebar from "@/components/Sidebar";
import Button from "@/components/Button";
import { getLabelColorClass } from "@/utils/labelColors";
import AnnotatableText from "./AnnotatableText";

import type { SourceTerm, SourceTermCreate } from "@/types";

import { format } from "date-fns";
import { tryParseWithDateFns } from "@/utils/dateUtils";
import styles from "./styles.module.css";
export interface AnnotationSidebarProps {
  isOpen: boolean;
  text: string;
  labels: string[];
  selectedLabel: string | null;
  onSelectLabel: (label: string) => void;
  annotations: SourceTerm[];
  selectedAnnotation: number | null;
  onSelectAnnotation: (id: number | null) => void;
  onCreateAnnotation: (term: SourceTermCreate) => void;
  onDeleteAnnotation: (termId: number) => void;
  onUpdateAnnotationLabel?: (termId: number, newLabel: string) => void;
  onUpdateAnnotationDate?: (termId: number, newDate: string) => void;
  onClose: () => void;
  onPreviousRecord?: () => void;
  onNextRecord?: () => void;
  hasPreviousRecord?: boolean;
  hasNextRecord?: boolean;
  onMarkReviewed?: () => void;
  isReviewed?: boolean;
  readOnly?: boolean;
}

const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  isOpen,
  text,
  labels,
  selectedLabel,
  onSelectLabel,
  annotations,
  selectedAnnotation,
  onSelectAnnotation,
  onCreateAnnotation,
  onDeleteAnnotation,
  onUpdateAnnotationLabel,
  onUpdateAnnotationDate,
  onClose,
  onPreviousRecord,
  onNextRecord,
  hasPreviousRecord = true,
  hasNextRecord = true,
  onMarkReviewed,
  isReviewed = false,
  readOnly = false,
}) => {
  // Handle label selection - either update selected annotation or select for new annotations
  const handleLabelSelection = useCallback(
    (label: string) => {
      if (selectedAnnotation !== null) return;
      onSelectLabel(label);
    },
    [selectedAnnotation, onUpdateAnnotationLabel, onSelectLabel]
  );

  // Local editing state for the date input so typing isn't immediately overwritten
  const [editingDate, setEditingDate] = useState<string>("");
  const [editingDateError, setEditingDateError] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedAnnotation !== null) {
      const ann = annotations.find((a) => a.id === selectedAnnotation);
      if (ann && ann.linked_visit_date) {
        const d = new Date(ann.linked_visit_date);
        const formatted = format(d, "dd/MM/yyyy");
        setEditingDate(formatted);
        setEditingDateError(null);
      } else {
        setEditingDate("");
        setEditingDateError(null);
      }
    } else {
      setEditingDate("");
      setEditingDateError(null);
    }
  }, [selectedAnnotation, annotations]);

  // Keyboard shortcuts for label selection (1-9)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = parseInt(e.key, 10);
      if (!readOnly && key >= 1 && key <= 9 && key <= labels.length) {
        e.preventDefault();
        handleLabelSelection(labels[key - 1]);
      }

      // Delete selected annotation with Delete or Backspace
      if (!readOnly && (e.key === "Delete" || e.key === "Backspace") && selectedAnnotation !== null) {
        e.preventDefault();
        onDeleteAnnotation(selectedAnnotation);
        onSelectAnnotation(null);
      }

      // Arrow Left - Previous record
      if (e.key === "ArrowLeft" && onPreviousRecord && hasPreviousRecord) {
        e.preventDefault();
        onPreviousRecord();
      }

      // Arrow Right - Next record
      if (e.key === "ArrowRight" && onNextRecord && hasNextRecord) {
        e.preventDefault();
        onNextRecord();
      }

      // Enter - Toggle reviewed status
      if (e.key === "Enter" && onMarkReviewed) {
        e.preventDefault();
        onMarkReviewed();
      }
    },
    [
      labels,
      handleLabelSelection,
      selectedAnnotation,
      onDeleteAnnotation,
      onSelectAnnotation,
      onPreviousRecord,
      onNextRecord,
      hasPreviousRecord,
      hasNextRecord,
      onMarkReviewed,
      readOnly,
    ]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return (
    <Sidebar isOpen={isOpen} onClose={onClose} title="Annotation Panel" width="75vw">
      <div className={styles["annotation-sidebar"]}>
        {/* Left side - Text to annotate */}
        <div>
          {/* Label selector */}
          <div className={styles["label-section"]}>
            <h3 className={styles["section-title"]}>Labels</h3>
            <div className={styles["label-section__buttons"]}>
              {labels.map((label, index) => (
                <button
                  key={label}
                  className={classNames(styles["label-button"], styles[`label${index + 1}`], {
                    [styles["label-button--active"]]: selectedLabel === label,
                  })}
                  onClick={() => handleLabelSelection(label)}
                  disabled={readOnly || selectedAnnotation !== null}
                >
                  <span className={styles["label-button__shortcut"]}>{index + 1}</span>
                  {label}
                </button>
              ))}
            </div>
            {labels.length === 0 && (
              <p className={styles["label-section__empty"]}>No labels defined for this dataset.</p>
            )}
          </div>
          <div className={styles["annotation-text"]}>
            <div className={styles["annotation-text__header"]}>
              <h3 className={styles["section-title"]}>Medical Record</h3>
              <span className={styles["annotation-text__help"]}>
                {selectedLabel ? (
                  <>
                    Highlight text to annotate as{" "}
                    <span
                      className={classNames(
                        styles["inline-label-badge"],
                        styles[getLabelColorClass(selectedLabel, labels)]
                      )}
                    >
                      {selectedLabel}
                    </span>
                  </>
                ) : (
                  "Select a label first, then highlight text"
                )}
              </span>
            </div>
            <div className={styles["annotation-text__content"]}>
              <AnnotatableText
                text={text}
                labels={labels}
                annotations={annotations}
                selectedLabel={selectedLabel}
                selectedAnnotation={selectedAnnotation}
                onCreateAnnotation={onCreateAnnotation}
                onSelectAnnotation={onSelectAnnotation}
                isAnnotating={!readOnly}
              />
            </div>
          </div>
        </div>

        {/* Right side - Controls */}

        <div className={styles["annotation-controls"]}>
          {/* Navigation and review buttons */}
          <div className={styles["record-navigation"]}>
            <div className={styles["record-navigation__buttons"]}>
              <Button
                variant="outline"
                onClick={onPreviousRecord}
                disabled={!onPreviousRecord || !hasPreviousRecord}
                title="Previous record"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
                <span className={styles["record-navigation__button-text"]}>Previous</span>
              </Button>
              <Button
                variant="outline"
                onClick={onNextRecord}
                disabled={!onNextRecord || !hasNextRecord}
                title="Next record"
              >
                <span className={styles["record-navigation__button-text"]}>Next</span>
                <FontAwesomeIcon icon={faChevronRight} />
              </Button>
            </div>
            <Button
              variant={isReviewed ? "success" : "primary"}
              onClick={onMarkReviewed}
              disabled={!onMarkReviewed}
              title={isReviewed ? "Marked as reviewed" : "Mark as reviewed"}
            >
              {isReviewed ? <FontAwesomeIcon icon={faCheck} /> : null}
              <span className={styles["record-navigation__review-text"]}>
                {isReviewed ? "Reviewed" : "Mark as Reviewed"}
              </span>
            </Button>
          </div>

          {/* Instructions */}
          <div className={styles["annotation-instructions"]}>
            {readOnly ? (
              <>
                <p>
                  <strong>Read-only mode:</strong> This record is marked as reviewed. Unmark it to edit annotations.
                </p>
                <p>
                  <strong>Keyboard shortcuts:</strong>
                </p>
                <ul className={styles["annotation-instructions__shortcuts"]}>
                  <li>
                    <kbd>←</kbd> / <kbd>→</kbd> Prev / next record
                  </li>
                  <li>
                    <kbd>Enter</kbd> Toggle reviewed status
                  </li>
                </ul>
              </>
            ) : (
              <>
                <p>
                  <strong>Creating annotations:</strong> Select a label below, then highlight text in the medical record
                  to annotate it.
                </p>
                <p>
                  <strong>Changing labels:</strong> Click an annotation to select it, then click a label or press{" "}
                  <kbd>1</kbd>-<kbd>9</kbd> to change its label.
                </p>
                <p>
                  <strong>Deleting:</strong> Click an annotation to select it, then press <kbd>Delete</kbd> or{" "}
                  <kbd>Backspace</kbd> to remove.
                </p>
                <p>
                  <strong>Keyboard shortcuts:</strong>
                </p>
                <ul className={styles["annotation-instructions__shortcuts"]}>
                  <li>
                    <kbd>1</kbd>-<kbd>9</kbd> Select / change label
                  </li>
                  <li>
                    <kbd>Delete</kbd> Delete annotation
                  </li>
                  <li>
                    <kbd>←</kbd> / <kbd>→</kbd> Prev / next record
                  </li>
                  <li>
                    <kbd>Enter</kbd> Mark as reviewed
                  </li>
                </ul>
              </>
            )}
          </div>

          {/* Current annotations */}
          <div className={styles["annotation-section"]}>
            <h3 className={styles["section-title"]}>Annotations ({annotations.length})</h3>
            {annotations.length === 0 ? (
              <p className={styles["annotation-section__empty"]}>No annotations yet. Select text to create one.</p>
            ) : (
              <div className={styles["annotation-section__list"]}>
                {annotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    className={classNames(styles["annotation-item"], {
                      [styles["annotation-item--selected"]]: selectedAnnotation === annotation.id,
                    })}
                    onClick={() =>
                      !readOnly && onSelectAnnotation(selectedAnnotation === annotation.id ? null : annotation.id)
                    }
                  >
                    <div className={styles["annotation-item__content"]}>
                      <span className={styles["annotation-item__value"]}>{annotation.value}</span>
                      <span
                        className={classNames(
                          styles["annotation-item__label"],
                          styles[getLabelColorClass(annotation.label, labels)]
                        )}
                      >
                        {annotation.label}
                      </span>
                      {/* Date input for selected annotation */}
                      {selectedAnnotation === annotation.id ? (
                        <>
                          <input
                            type="text"
                            className={styles["annotation-item__date-input"]}
                            value={editingDate}
                            placeholder="DD/MM/YYYY"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setEditingDate(e.target.value);
                              // Clear previous error while the user is editing
                              if (editingDateError) setEditingDateError(null);
                            }}
                            onBlur={() => {
                              // On blur, attempt a smart parse and notify parent only if valid.
                              const v = editingDate.trim();
                              if (v === "") {
                                if (onUpdateAnnotationDate) onUpdateAnnotationDate(annotation.id, "");
                                setEditingDateError(null);
                                return;
                              }
                              const parsed = tryParseWithDateFns(v);
                              if (parsed) {
                                const iso = format(parsed, "yyyy-MM-dd"); // YYYY-MM-DD (local date)
                                if (onUpdateAnnotationDate) onUpdateAnnotationDate(annotation.id, iso);
                                // normalize visible input to DD/MM/YYYY
                                setEditingDate(format(parsed, "dd/MM/yyyy"));
                                setEditingDateError(null);
                              } else {
                                // Keep user's text but show an error
                                setEditingDateError("Unrecognized date format");
                              }
                            }}
                            ref={dateInputRef}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                dateInputRef.current?.blur();
                              }
                            }}
                          />
                          {editingDateError ? (
                            <span className={styles["annotation-item__date-error"]}>{editingDateError}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className={styles["annotation-item__date"]}>
                          {annotation.linked_visit_date ? (
                            new Date(annotation.linked_visit_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })) : ("No date")
                          }
                        </span>
                      )}
                      {annotation.linked_date_term_id &&
                        (() => {
                          const dateTerm = annotations.find((a) => a.id === annotation.linked_date_term_id);
                          // Only show if found
                          if (!dateTerm) return null;
                          return (
                            <span className={styles["annotation-item__date-id"]}>↳ linked to {dateTerm.value}</span>
                          );
                        })()}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      colorScheme="danger"
                      className={styles["annotation-item__delete"]}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAnnotation(annotation.id);
                      }}
                      title="Delete annotation"
                      disabled={readOnly}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M2 4H14M5.333 4V2.667C5.333 2.298 5.632 2 6 2H10C10.368 2 10.667 2.298 10.667 2.667V4M12.667 4V13.333C12.667 13.702 12.368 14 12 14H4C3.632 14 3.333 13.702 3.333 13.333V4H12.667Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Sidebar >
  );
};

export default AnnotationSidebar;
