import { useEffect, useState, useRef, useCallback } from "react";
import type { ConceptHierarchy } from "types";
import * as api from "api";
import LoadingSpinner from "components/LoadingSpinner";
import Button from "components/Button";
import styles from "./styles.module.css";

interface ConceptDetailModalProps {
  conceptId: number;
  onClose: () => void;
  onMap: () => void;
}

export default function ConceptDetailModal({ conceptId, onClose, onMap }: ConceptDetailModalProps) {
  const [hierarchy, setHierarchy] = useState<ConceptHierarchy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setIsLoading(true);
        const data = await api.getConceptHierarchy(conceptId);
        setHierarchy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load concept details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHierarchy();
  }, [conceptId]);

  // Store previous active element and focus close button when opening
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    };
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={styles.modalOverlay} onClick={onClose} aria-hidden="true">
      <div
        ref={modalRef}
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-detail-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="concept-detail-title">Concept Details</h2>
          <button ref={closeButtonRef} onClick={onClose} className={styles.modalCloseBtn} aria-label="Close dialog">
            x
          </button>
        </div>

        <div className={styles.modalBody}>
          {isLoading ? (
            <div className={styles.loading}>
              <LoadingSpinner text="Loading concept details..." />
            </div>
          ) : error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : hierarchy ? (
            <>
              <div className={styles.conceptDetailSection}>
                <h3>Concept Information</h3>
                <div className={styles.detailGrid}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>ID:</span>
                    <span>{hierarchy.concept.vocab_term_id}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Name:</span>
                    <span>{hierarchy.concept.vocab_term_name}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Code:</span>
                    <span>{hierarchy.concept.concept_code || "N/A"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Domain:</span>
                    <span>{hierarchy.concept.domain_id}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Class:</span>
                    <span>{hierarchy.concept.concept_class_id}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Standard:</span>
                    <span>{hierarchy.concept.standard_concept || "Non-standard"}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Valid Range:</span>
                    <span>
                      {hierarchy.concept.valid_start_date} to {hierarchy.concept.valid_end_date}
                    </span>
                  </div>
                  {hierarchy.concept.invalid_reason && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Invalid Reason:</span>
                      <span>{hierarchy.concept.invalid_reason}</span>
                    </div>
                  )}
                </div>
              </div>

              {hierarchy.parents.length > 0 && (
                <div className={styles.conceptDetailSection}>
                  <h3>Parent Concepts ({hierarchy.parents.length})</h3>
                  <div className={styles.conceptList}>
                    {hierarchy.parents.map((parent) => (
                      <div key={parent.id} className={styles.conceptListItem}>
                        <span className={styles.conceptListId}>{parent.vocab_term_id}</span>
                        <span className={styles.conceptListName}>{parent.vocab_term_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hierarchy.children.length > 0 && (
                <div className={styles.conceptDetailSection}>
                  <h3>Child Concepts ({hierarchy.children.length})</h3>
                  <div className={styles.conceptList}>
                    {hierarchy.children.map((child) => (
                      <div key={child.id} className={styles.conceptListItem}>
                        <span className={styles.conceptListId}>{child.vocab_term_id}</span>
                        <span className={styles.conceptListName}>{child.vocab_term_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hierarchy.related_concepts.length > 0 && (
                <div className={styles.conceptDetailSection}>
                  <h3>Related Concepts ({hierarchy.related_concepts.length})</h3>
                  <div className={styles.conceptList}>
                    {hierarchy.related_concepts.map((related) => (
                      <div key={related.id} className={styles.conceptListItem}>
                        <span className={styles.conceptListId}>{related.vocab_term_id}</span>
                        <span className={styles.conceptListName}>{related.vocab_term_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="success" onClick={onMap}>
            Map to Selected Cluster
          </Button>
        </div>
      </div>
    </div>
  );
}
