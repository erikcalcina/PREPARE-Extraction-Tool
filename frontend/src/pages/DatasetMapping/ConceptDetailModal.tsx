import { useEffect, useState } from 'react';
import type { ConceptHierarchy } from 'types';
import * as api from 'api';
import styles from './styles.module.css';

interface ConceptDetailModalProps {
    conceptId: number;
    onClose: () => void;
    onMap: () => void;
}

export default function ConceptDetailModal({ conceptId, onClose, onMap }: ConceptDetailModalProps) {
    const [hierarchy, setHierarchy] = useState<ConceptHierarchy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHierarchy = async () => {
            try {
                setIsLoading(true);
                const data = await api.getConceptHierarchy(conceptId);
                setHierarchy(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load concept details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHierarchy();
    }, [conceptId]);

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>Concept Details</h2>
                    <button onClick={onClose} className={styles.modalCloseBtn}>
                        ×
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {isLoading ? (
                        <div className={styles.loading}>Loading...</div>
                    ) : error ? (
                        <div className={styles.error}>{error}</div>
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
                                        <span>{hierarchy.concept.concept_code || 'N/A'}</span>
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
                                        <span>{hierarchy.concept.standard_concept || 'Non-standard'}</span>
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
                                    <h3>Parent Concepts</h3>
                                    <div className={styles.conceptList}>
                                        {hierarchy.parents.map(parent => (
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
                                    <h3>Child Concepts</h3>
                                    <div className={styles.conceptList}>
                                        {hierarchy.children.map(child => (
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
                                    <h3>Related Concepts</h3>
                                    <div className={styles.conceptList}>
                                        {hierarchy.related_concepts.map(related => (
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
                    <button onClick={onClose} className={styles.btnSecondary}>
                        Close
                    </button>
                    <button onClick={onMap} className={styles.btnPrimary}>
                        Map to Selected Cluster
                    </button>
                </div>
            </div>
        </div>
    );
}
