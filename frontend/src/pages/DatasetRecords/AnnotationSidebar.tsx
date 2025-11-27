import { useEffect, useCallback } from 'react';
import Sidebar from 'components/Sidebar';
import type { SourceTerm, SourceTermCreate } from 'types';
import AnnotatableText from './AnnotatableText';
import styles from './styles.module.css';

// ================================================
// Helper function
// ================================================

function getLabelColorClass(label: string, labels: string[]): string {
    const index = labels.indexOf(label);
    if (index === -1) return 'label1';
    // Return label1 through label9 based on index (wrapping if more than 9)
    return `label${(index % 9) + 1}`;
}

// ================================================
// Interface
// ================================================

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
    onClose: () => void;
}

// ================================================
// Component
// ================================================

const AnnotationSidebar = ({
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
    onClose,
}: AnnotationSidebarProps) => {
    // Keyboard shortcuts for label selection (1-9)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't handle if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        const key = parseInt(e.key, 10);
        if (key >= 1 && key <= 9 && key <= labels.length) {
            e.preventDefault();
            onSelectLabel(labels[key - 1]);
        }

        // Delete selected annotation with Delete or Backspace
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotation !== null) {
            e.preventDefault();
            onDeleteAnnotation(selectedAnnotation);
            onSelectAnnotation(null);
        }
    }, [labels, onSelectLabel, selectedAnnotation, onDeleteAnnotation, onSelectAnnotation]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    return (
        <Sidebar
            isOpen={isOpen}
            onClose={onClose}
            title="Label Annotations"
            width="75vw"
        >
            <div className={styles.annotationSidebarLayout}>
                {/* Left side - Text to annotate */}
                <div className={styles.annotationTextPanel}>
                    <div className={styles.annotationTextHeader}>
                        <h3 className={styles.sectionTitle}>Medical Record</h3>
                        <span className={styles.annotationHelpText}>
                            {selectedLabel
                                ? `Highlight text to annotate as "${selectedLabel}"`
                                : 'Select a label first, then highlight text'
                            }
                        </span>
                    </div>
                    <div className={styles.annotationTextContent}>
                        <AnnotatableText
                            text={text}
                            labels={labels}
                            annotations={annotations}
                            selectedLabel={selectedLabel}
                            selectedAnnotation={selectedAnnotation}
                            onCreateAnnotation={onCreateAnnotation}
                            onSelectAnnotation={onSelectAnnotation}
                            isAnnotating={true}
                        />
                    </div>
                </div>

                {/* Right side - Controls */}
                <div className={styles.annotationControlsPanel}>
                    {/* Instructions */}
                    <div className={styles.annotationInstructions}>
                        <p>Select a label, then highlight text to create annotations.</p>
                        <p>Click an annotation to select it, then press <kbd>Delete</kbd> to remove.</p>
                    </div>

                    {/* Label selector */}
                    <div className={styles.labelSection}>
                        <h3 className={styles.sectionTitle}>Labels</h3>
                        <div className={styles.labelButtons}>
                            {labels.map((label, index) => (
                                <button
                                    key={label}
                                    className={`${styles.labelButton} ${styles[`label${index + 1}`]} ${selectedLabel === label ? styles.active : ''}`}
                                    onClick={() => onSelectLabel(label)}
                                >
                                    <span className={styles.labelShortcut}>{index + 1}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {labels.length === 0 && (
                            <p className={styles.noLabels}>
                                No labels defined for this dataset.
                            </p>
                        )}
                    </div>

                    {/* Current annotations */}
                    <div className={styles.annotationSection}>
                        <h3 className={styles.sectionTitle}>
                            Annotations ({annotations.length})
                        </h3>
                        {annotations.length === 0 ? (
                            <p className={styles.noAnnotations}>
                                No annotations yet. Select text to create one.
                            </p>
                        ) : (
                            <div className={styles.annotationList}>
                                {annotations.map((annotation) => (
                                    <div
                                        key={annotation.id}
                                        className={`${styles.annotationItem} ${selectedAnnotation === annotation.id ? styles.selected : ''}`}
                                        onClick={() => onSelectAnnotation(
                                            selectedAnnotation === annotation.id ? null : annotation.id
                                        )}
                                    >
                                        <div className={styles.annotationContent}>
                                            <span className={styles.annotationValue}>
                                                "{annotation.value}"
                                            </span>
                                            <span className={`${styles.annotationLabel} ${styles[getLabelColorClass(annotation.label, labels)]}`}>
                                                {annotation.label}
                                            </span>
                                        </div>
                                        <button
                                            className={styles.deleteAnnotationButton}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteAnnotation(annotation.id);
                                            }}
                                            title="Delete annotation"
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M2 4H14M5.333 4V2.667C5.333 2.298 5.632 2 6 2H10C10.368 2 10.667 2.298 10.667 2.667V4M12.667 4V13.333C12.667 13.702 12.368 14 12 14H4C3.632 14 3.333 13.702 3.333 13.333V4H12.667Z"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Sidebar>
    );
};

export default AnnotationSidebar;

