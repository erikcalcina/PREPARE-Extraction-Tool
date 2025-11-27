import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import Layout from 'components/Layout';
import { useRecords } from 'hooks/useRecords';
import type { Record as RecordType, SourceTerm, SourceTermCreate } from 'types';
import AnnotationSidebar from './AnnotationSidebar';
import styles from './styles.module.css';

// ================================================
// Helper functions
// ================================================

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getLabelColorClass(label: string, labels: string[]): string {
    const index = labels.indexOf(label);
    if (index === -1) return 'label1';
    return `label${(index % 9) + 1}`;
}

// ================================================
// Highlighted Text Component
// ================================================

interface HighlightedTextProps {
    text: string;
    terms: SourceTerm[];
    labels: string[];
    focusedTermId?: number | null;
}

function HighlightedText({ text, terms, labels, focusedTermId }: HighlightedTextProps) {
    const segments = useMemo(() => {
        if (!terms.length) {
            return [{ type: 'text' as const, content: text }];
        }

        // Filter terms with valid positions and sort by start position
        const validTerms = terms
            .filter(t => t.start_position !== null && t.end_position !== null)
            .sort((a, b) => (a.start_position ?? 0) - (b.start_position ?? 0));

        if (!validTerms.length) {
            return [{ type: 'text' as const, content: text }];
        }

        const result: Array<
            | { type: 'text'; content: string }
            | { type: 'term'; content: string; term: SourceTerm }
        > = [];
        let lastEnd = 0;

        for (const term of validTerms) {
            const start = term.start_position ?? 0;
            const end = term.end_position ?? 0;

            // Skip overlapping terms
            if (start < lastEnd) continue;

            // Add text before this term
            if (start > lastEnd) {
                result.push({ type: 'text', content: text.slice(lastEnd, start) });
            }

            // Add the highlighted term
            result.push({
                type: 'term',
                content: text.slice(start, end),
                term,
            });

            lastEnd = end;
        }

        // Add remaining text
        if (lastEnd < text.length) {
            result.push({ type: 'text', content: text.slice(lastEnd) });
        }

        return result;
    }, [text, terms]);

    return (
        <div className={styles.recordText}>
            {segments.map((segment, idx) =>
                segment.type === 'text' ? (
                    <span key={idx}>{segment.content}</span>
                ) : (
                    <span
                        key={idx}
                        data-term-id={segment.term.id}
                        className={`${styles.highlightedTerm} ${styles[getLabelColorClass(segment.term.label, labels)]} ${focusedTermId === segment.term.id ? styles.focusedTerm : ''}`}
                        title={`${segment.term.label}: ${segment.term.value}`}
                    >
                        {segment.content}
                    </span>
                )
            )}
        </div>
    );
}

// ================================================
// Stats Card Component
// ================================================

interface StatCardProps {
    label: string;
    value: number;
    variant?: 'default' | 'processed' | 'pending' | 'terms';
}

function StatCard({ label, value, variant = 'default' }: StatCardProps) {
    return (
        <div className={styles.statCard}>
            <div className={`${styles.statValue} ${variant !== 'default' ? styles[variant] : ''}`}>
                {value.toLocaleString()}
            </div>
            <div className={styles.statLabel}>{label}</div>
        </div>
    );
}

// ================================================
// Record Item Component
// ================================================

interface RecordItemProps {
    record: RecordType;
    isSelected: boolean;
    onClick: () => void;
}

function RecordItem({ record, isSelected, onClick }: RecordItemProps) {
    const hasTerms = record.source_term_count > 0;

    return (
        <div
            className={`${styles.recordItem} ${isSelected ? styles.selected : ''}`}
            onClick={onClick}
        >
            <div className={styles.recordItemHeader}>
                <span className={styles.recordId}>Record #{record.id}</span>
                <span className={styles.recordTime}>
                    {formatRelativeTime(record.uploaded)}
                </span>
            </div>
            <div className={styles.recordPreview}>
                {record.text.slice(0, 150)}
                {record.text.length > 150 ? '...' : ''}
            </div>
            <div className={styles.recordStatus}>
                {hasTerms ? (
                    <span className={`${styles.statusBadge} ${styles.processed}`}>
                        Processed
                    </span>
                ) : (
                    <span className={`${styles.statusBadge} ${styles.pending}`}>
                        Pending
                    </span>
                )}
                {record.reviewed && (
                    <span className={`${styles.statusBadge} ${styles.reviewed}`}>
                        Reviewed
                    </span>
                )}
                {record.source_term_count > 0 && (
                    <span className={styles.termCount}>
                        {record.source_term_count} term{record.source_term_count !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </div>
    );
}

// ================================================
// Main Component
// ================================================

const DatasetRecords = () => {
    const { datasetId } = useParams<{ datasetId: string }>();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Annotation state
    const [isAnnotating, setIsAnnotating] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null);

    // Focused term state (for scrolling to terms)
    const [focusedTermId, setFocusedTermId] = useState<number | null>(null);

    const parsedDatasetId = datasetId ? parseInt(datasetId, 10) : 0;

    const {
        dataset,
        records,
        stats,
        selectedRecord,
        selectedRecordTerms,
        isLoading,
        isLoadingMore,
        isLoadingTerms,
        hasMore,
        error,
        loadMoreRecords,
        selectRecord,
        markRecordReviewed,
        addSourceTerm,
        removeSourceTerm,
    } = useRecords(parsedDatasetId);

    // Infinite scroll observer
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore || isLoadingMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreRecords();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loadMoreRef.current);

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, loadMoreRecords]);

    // Auto-select first record
    useEffect(() => {
        if (records.length > 0 && !selectedRecord) {
            selectRecord(records[0]);
        }
    }, [records, selectedRecord, selectRecord]);

    const handleMarkReviewed = useCallback(async () => {
        if (!selectedRecord) return;
        try {
            await markRecordReviewed(selectedRecord.id, !selectedRecord.reviewed);
        } catch (err) {
            console.error('Failed to update review status:', err);
        }
    }, [selectedRecord, markRecordReviewed]);

    // Annotation handlers
    const handleOpenAnnotation = useCallback(() => {
        setIsAnnotating(true);
        // Auto-select first label if available
        if (dataset?.labels && dataset.labels.length > 0) {
            setSelectedLabel(dataset.labels[0]);
        }
    }, [dataset]);

    const handleCloseAnnotation = useCallback(() => {
        setIsAnnotating(false);
        setSelectedLabel(null);
        setSelectedAnnotation(null);
    }, []);

    const handleCreateAnnotation = useCallback(async (term: SourceTermCreate) => {
        try {
            await addSourceTerm(term);
        } catch (err) {
            console.error('Failed to create annotation:', err);
        }
    }, [addSourceTerm]);

    const handleDeleteAnnotation = useCallback(async (termId: number) => {
        try {
            await removeSourceTerm(termId);
            if (selectedAnnotation === termId) {
                setSelectedAnnotation(null);
            }
        } catch (err) {
            console.error('Failed to delete annotation:', err);
        }
    }, [removeSourceTerm, selectedAnnotation]);

    // Reset annotation selection when changing records
    useEffect(() => {
        setSelectedAnnotation(null);
        setFocusedTermId(null);
    }, [selectedRecord?.id]);

    // Scroll to a term in the text
    const scrollToTerm = useCallback((termId: number) => {
        const termElement = document.querySelector(`[data-term-id="${termId}"]`);
        if (termElement) {
            termElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setFocusedTermId(termId);
            // Remove focus highlight after animation
            setTimeout(() => setFocusedTermId(null), 2000);
        }
    }, []);

    // Filter records based on search
    const filteredRecords = useMemo(() => {
        if (!searchQuery.trim()) return records;
        const query = searchQuery.toLowerCase();
        return records.filter((r) =>
            r.text.toLowerCase().includes(query) ||
            r.id.toString().includes(query)
        );
    }, [records, searchQuery]);

    if (!parsedDatasetId) {
        return (
            <Layout>
                <div className={styles.page}>
                    <div className={styles.error}>Invalid dataset ID</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.page}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleSection}>
                        <button
                            className={styles.backButton}
                            onClick={() => navigate('/datasets')}
                            title="Back to Datasets"
                        >
                            ←
                        </button>
                        <div>
                            <h1 className={styles.title}>
                                {dataset?.name || 'Dataset Records'}
                            </h1>
                            <p className={styles.subtitle}>
                                View and annotate medical records with NER extraction
                            </p>
                        </div>
                    </div>
                    {/* Stats Cards */}
                    <div className={styles.statsGrid}>
                        <StatCard
                            label="Total"
                            value={stats?.total_records ?? 0}
                        />
                        <StatCard
                            label="Processed"
                            value={stats?.processed_count ?? 0}
                            variant="processed"
                        />
                        <StatCard
                            label="Terms"
                            value={stats?.extracted_terms_count ?? 0}
                            variant="terms"
                        />
                        <StatCard
                            label="Pending"
                            value={stats?.pending_review_count ?? 0}
                            variant="pending"
                        />
                    </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                {/* Main Content */}
                <div className={styles.content}>
                    {/* Records List Panel */}
                    <div className={styles.recordsPanel}>
                        <div className={styles.recordsPanelHeader}>
                            <h2 className={styles.recordsPanelTitle}>Records List</h2>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search records..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className={styles.recordsList}>
                            {isLoading ? (
                                <div className={styles.loading}>Loading records...</div>
                            ) : filteredRecords.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyStateIcon}>📄</div>
                                    <p className={styles.emptyStateText}>
                                        {searchQuery ? 'No matching records' : 'No records yet'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {filteredRecords.map((record) => (
                                        <RecordItem
                                            key={record.id}
                                            record={record}
                                            isSelected={selectedRecord?.id === record.id}
                                            onClick={() => selectRecord(record)}
                                        />
                                    ))}
                                    {hasMore && (
                                        <div
                                            ref={loadMoreRef}
                                            className={styles.loadMoreTrigger}
                                        />
                                    )}
                                    {isLoadingMore && (
                                        <div className={styles.loadingMore}>
                                            Loading more records...
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Detail Panels */}
                    <div className={styles.detailPanels}>
                        {selectedRecord ? (
                            <>
                                {/* Record Text Panel */}
                                <div className={styles.recordTextPanel}>
                                    <div className={styles.recordTextHeader}>
                                        <h2 className={styles.recordTextTitle}>
                                            Record #{selectedRecord.id} - NER View
                                        </h2>
                                        <div className={styles.detailActions}>
                                            <button
                                                className={`${styles.actionButton} ${styles.secondary}`}
                                                onClick={handleOpenAnnotation}
                                            >
                                                Edit Labels
                                            </button>
                                            <button
                                                className={`${styles.actionButton} ${styles.primary}`}
                                                onClick={handleMarkReviewed}
                                            >
                                                {selectedRecord.reviewed
                                                    ? 'Unmark Reviewed'
                                                    : 'Mark Reviewed'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.recordTextContent}>
                                        {isLoadingTerms ? (
                                            <div className={styles.loading}>
                                                Loading...
                                            </div>
                                        ) : (
                                            <HighlightedText
                                                text={selectedRecord.text}
                                                terms={selectedRecordTerms}
                                                labels={dataset?.labels ?? []}
                                                focusedTermId={focusedTermId}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Extracted Terms Panel */}
                                <div className={styles.termsPanel}>
                                    <div className={styles.termsPanelHeader}>
                                        <h2 className={styles.termsPanelTitle}>
                                            Extracted Terms ({selectedRecordTerms.length})
                                        </h2>
                                    </div>
                                    <div className={styles.termsPanelContent}>
                                        {selectedRecordTerms.length === 0 ? (
                                            <div className={styles.emptyState}>
                                                <p className={styles.emptyStateText}>
                                                    No terms extracted
                                                </p>
                                                <p className={styles.emptyStateSubtext}>
                                                    Run NER extraction to identify terms
                                                </p>
                                            </div>
                                        ) : (
                                            <div className={styles.termsList}>
                                                {selectedRecordTerms.map((term) => (
                                                    <div
                                                        key={term.id}
                                                        className={styles.termItem}
                                                    >
                                                        <div className={styles.termInfo}>
                                                            <span className={styles.termValue}>
                                                                {term.value}
                                                            </span>
                                                            <div className={styles.termMeta}>
                                                                <span
                                                                    className={`${styles.termLabel} ${styles[getLabelColorClass(term.label, dataset?.labels ?? [])]}`}
                                                                >
                                                                    {term.label}
                                                                </span>
                                                                {term.start_position !== null && (
                                                                    <span className={styles.termPosition}>
                                                                        [{term.start_position}-{term.end_position}]
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            className={styles.termViewButton}
                                                            onClick={() => scrollToTerm(term.id)}
                                                        >
                                                            View
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={styles.recordTextPanel}>
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyStateIcon}>👈</div>
                                    <p className={styles.emptyStateText}>
                                        Select a record to view details
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Annotation Sidebar */}
                <AnnotationSidebar
                    isOpen={isAnnotating}
                    text={selectedRecord?.text ?? ''}
                    labels={dataset?.labels ?? []}
                    selectedLabel={selectedLabel}
                    onSelectLabel={setSelectedLabel}
                    annotations={selectedRecordTerms}
                    selectedAnnotation={selectedAnnotation}
                    onSelectAnnotation={setSelectedAnnotation}
                    onCreateAnnotation={handleCreateAnnotation}
                    onDeleteAnnotation={handleDeleteAnnotation}
                    onClose={handleCloseAnnotation}
                />
            </div>
        </Layout>
    );
};

export default DatasetRecords;

