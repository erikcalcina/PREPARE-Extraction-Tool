import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Layout from "components/Layout";
import { useRecords } from "hooks/useRecords";
import { usePageTitle } from "hooks/usePageTitle";
import type { Record as RecordType, SourceTerm, SourceTermCreate } from "types";
import AnnotationSidebar from "./AnnotationSidebar";
import styles from "./styles.module.css";
import ProgressBar from "components/ProgressBar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";

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

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toLocaleString();
  if (num < 1000000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}

function getLabelColorClass(label: string, labels: string[]): string {
  const index = labels.indexOf(label);
  if (index === -1) return "label1";
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
      return [{ type: "text" as const, content: text }];
    }

    // Filter terms with valid positions and sort by start position
    const validTerms = terms
      .filter((t) => t.start_position !== null && t.end_position !== null)
      .sort((a, b) => (a.start_position ?? 0) - (b.start_position ?? 0));

    if (!validTerms.length) {
      return [{ type: "text" as const, content: text }];
    }

    const result: Array<{ type: "text"; content: string } | { type: "term"; content: string; term: SourceTerm }> = [];
    let lastEnd = 0;

    for (const term of validTerms) {
      const start = term.start_position ?? 0;
      const end = term.end_position ?? 0;

      // Skip overlapping terms
      if (start < lastEnd) continue;

      // Add text before this term
      if (start > lastEnd) {
        result.push({ type: "text", content: text.slice(lastEnd, start) });
      }

      // Add the highlighted term
      result.push({
        type: "term",
        content: text.slice(start, end),
        term,
      });

      lastEnd = end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      result.push({ type: "text", content: text.slice(lastEnd) });
    }

    return result;
  }, [text, terms]);

  return (
    <div className={styles.recordText}>
      {segments.map((segment, idx) =>
        segment.type === "text" ? (
          <span key={idx}>{segment.content}</span>
        ) : (
          <span
            key={idx}
            data-term-id={segment.term.id}
            className={`${styles.highlightedTerm} ${styles[getLabelColorClass(segment.term.label, labels)]} ${focusedTermId === segment.term.id ? styles.focusedTerm : ""}`}
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
  suffix?: string;
  variant?: "default" | "processed" | "pending" | "terms";
}

function StatCard({ label, value, suffix = "", variant = "default" }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.statValue} ${variant !== "default" ? styles[variant] : ""}`}>
        {value.toLocaleString()}
        {suffix}
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
  return (
    <div className={`${styles.recordItem} ${isSelected ? styles.selected : ""}`} onClick={onClick}>
      <div className={styles.recordItemHeader}>
        <span className={styles.recordId}>Patient ID: {record.patient_id}</span>
        <span className={styles.recordId}>{record.seq_number && `#${record.seq_number}`}</span>
      </div>
      <div className={styles.recordPreview}>
        {record.text.slice(0, 150)}
        {record.text.length > 150 ? "..." : ""}
      </div>
      <div className={styles.recordStatus}>
        <span className={styles.termCount}>
          {record.source_term_count > 0
            ? `${record.source_term_count} term${record.source_term_count !== 1 ? "s" : ""}`
            : "No terms"}
        </span>
        {record.reviewed && <span className={`${styles.statusBadge} ${styles.reviewed}`}>Reviewed</span>}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [patientIdQuery, setPatientIdQuery] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<"all" | "reviewed" | "not_reviewed">("all");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [displayMode, setDisplayMode] = useState<"percentage" | "ratio">("percentage");

  // Annotation state
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null);

  // Focused term state (for scrolling to terms)
  const [focusedTermId, setFocusedTermId] = useState<number | null>(null);

  const [navigationRecordsSnapshot, setNavigationRecordsSnapshot] = useState<RecordType[]>([]);

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
    isExtracting,
    isExtractingDataset,
    isCancellingExtraction,
    extractionProgress,
    hasMore,
    error,
    loadMoreRecords,
    selectRecord,
    markRecordReviewed,
    addSourceTerm,
    removeSourceTerm,
    updateSourceTermLabel,
    extractTermsForRecord,
    extractTermsForDataset,
    cancelDatasetExtraction,
    deleteExtractedTermsForDataset,
    fetchRecords,
    patientIdFilter,
    setPatientIdFilter,
    textFilter,
    setTextFilter,
    reviewedFilter,
    setReviewedFilter,
  } = useRecords(parsedDatasetId);

  // Update page title based on dataset name
  usePageTitle(dataset?.name ? `Term Extraction - ${dataset.name}` : "Term Extraction");

  // Debounced search - update filters after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setTextFilter(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, setTextFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPatientIdFilter(patientIdQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [patientIdQuery, setPatientIdFilter]);

  // Update reviewed filter when review status changes
  useEffect(() => {
    if (reviewStatusFilter === "all") {
      setReviewedFilter(undefined);
    } else if (reviewStatusFilter === "reviewed") {
      setReviewedFilter(true);
    } else {
      setReviewedFilter(false);
    }
  }, [reviewStatusFilter, setReviewedFilter]);

  // Refetch records when filters change
  useEffect(() => {
    fetchRecords(1, 20);
  }, [patientIdFilter, textFilter, reviewedFilter, fetchRecords]);

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
      // REMOVE THIS LINE: await fetchRecords(1, 20);
    } catch (err) {
      console.error("Failed to update review status:", err);
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

  const handleCreateAnnotation = useCallback(
    async (term: SourceTermCreate) => {
      try {
        await addSourceTerm(term);
      } catch (err) {
        console.error("Failed to create annotation:", err);
      }
    },
    [addSourceTerm]
  );

  const handleDeleteAnnotation = useCallback(
    async (termId: number) => {
      try {
        await removeSourceTerm(termId);
        if (selectedAnnotation === termId) {
          setSelectedAnnotation(null);
        }
      } catch (err) {
        console.error("Failed to delete annotation:", err);
      }
    },
    [removeSourceTerm, selectedAnnotation]
  );

  const handleUpdateAnnotationLabel = useCallback(
    async (termId: number, newLabel: string) => {
      try {
        await updateSourceTermLabel(termId, newLabel);
      } catch (err) {
        console.error("Failed to update annotation label:", err);
      }
    },
    [updateSourceTermLabel]
  );

  // Navigation handlers for annotation sidebar
  const handlePreviousRecord = useCallback(() => {
    if (!selectedRecord || records.length === 0) return;

    const currentIndex = records.findIndex((r) => r.id === selectedRecord.id);

    if (currentIndex > 0) {
      selectRecord(records[currentIndex - 1]);
    }
  }, [selectedRecord, records, selectRecord]);

  const handleNextRecord = useCallback(() => {
    if (!selectedRecord || records.length === 0) return;

    const currentIndex = records.findIndex((r) => r.id === selectedRecord.id);

    if (currentIndex < records.length - 1) {
      selectRecord(records[currentIndex + 1]);
    }
  }, [selectedRecord, records, selectRecord]);

  const handleMarkReviewedInSidebar = useCallback(async () => {
    if (!selectedRecord) return;
    try {
      await markRecordReviewed(selectedRecord.id, !selectedRecord.reviewed);
      // Don't call fetchRecords here!
    } catch (err) {
      console.error("Failed to update review status:", err);
    }
  }, [selectedRecord, markRecordReviewed]);
  // Compute navigation availability
  const currentRecordIndex = useMemo(() => {
    if (!selectedRecord || records.length === 0) return -1;
    return records.findIndex((r) => r.id === selectedRecord.id);
  }, [selectedRecord, records]);

  const hasPreviousRecord = currentRecordIndex > 0;
  const hasNextRecord = currentRecordIndex >= 0 && currentRecordIndex < records.length - 1;

  // Reset annotation selection when changing records
  useEffect(() => {
    setSelectedAnnotation(null);
    setFocusedTermId(null);
  }, [selectedRecord?.id]);

  // Scroll to a term in the text
  const scrollToTerm = useCallback((termId: number) => {
    const termElement = document.querySelector(`[data-term-id="${termId}"]`);
    if (termElement) {
      termElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusedTermId(termId);
      // Remove focus highlight after animation
      setTimeout(() => setFocusedTermId(null), 2000);
    }
  }, []);

  // Extract terms handlers
  const handleExtractTermsForRecord = useCallback(async () => {
    if (!selectedRecord) return;
    try {
      const response = await extractTermsForRecord();
      alert(response.message || "Terms extracted successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to extract terms";
      alert(`Error: ${errorMessage}`);
    }
  }, [selectedRecord, extractTermsForRecord]);

  const handleExtractTermsForDataset = useCallback(async () => {
    if (!stats?.total_records) return;

    const confirmed = window.confirm(
      `This will extract terms from all ${stats.total_records} record${stats.total_records !== 1 ? "s" : ""} in the dataset. This may take several minutes. Continue?`
    );

    if (!confirmed) return;

    try {
      await extractTermsForDataset();
      alert("Terms extracted successfully for all records");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to extract terms";
      alert(`Error: ${errorMessage}`);
    }
  }, [stats, extractTermsForDataset]);

  const handleDeleteExtractedTerms = useCallback(async () => {
    const confirmed = window.confirm("This will delete all automatically extracted terms in this dataset. Continue?");
    if (!confirmed) return;

    try {
      const res = await deleteExtractedTermsForDataset();
      alert(res.message || "Deleted extracted terms");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete extracted terms";
      alert(`Error: ${errorMessage}`);
    }
  }, [deleteExtractedTermsForDataset]);

  if (!parsedDatasetId) {
    return (
      <Layout>
        <div className={styles.page}>
          <div className={styles.error}>Invalid dataset ID</div>
        </div>
      </Layout>
    );
  }

  const totalRecords = stats?.total_records ?? 0;
  const reviewedRecords = records.filter((r) => r.reviewed).length;

  const reviewedPercentage = totalRecords > 0 ? `${((reviewedRecords / totalRecords) * 100).toFixed(1)}` : "0.0%";

  const reviewedValue = displayMode === "percentage" ? reviewedPercentage : reviewedRecords;

  const reviewedSuffix = displayMode === "percentage" ? "%" : ` / ${totalRecords}`;

  return (
    <Layout>
      <div className={styles.page}>
        {/* Header with Navigation */}
        <div className={styles.header}>
          <button
            className={styles.navButton}
            onClick={() => navigate(`/datasets/${datasetId}`)}
            title="Back to Dataset Overview"
          >
            ← Back to Overview
          </button>

          <div className={styles.pageInfo}>
            <h1 className={styles.pageTitle}>
              Term Extraction
              <span className={styles.infoTooltip}>
                <FontAwesomeIcon icon={faCircleQuestion} className={styles.infoIcon} />
                <span className={styles.tooltipContent}>
                  <p>Annotate the text with the appropriate labels to identify medical terms for standardization.</p>
                  <strong>How to use:</strong>
                  <ul>
                    <li>Click Extract All Terms to automatically identify terms</li>
                    <li>Click Edit Labels to manually add or remove annotations</li>
                    <li>Mark records as Reviewed when done</li>
                    <li>Use filters to find specific records</li>
                  </ul>
                </span>
              </span>
            </h1>
            <button
              className={styles.datasetLink}
              onClick={() => navigate(`/datasets/${datasetId}`)}
              title="Go to Dataset Overview"
            >
              Dataset: {dataset?.name || "Loading..."}
            </button>
          </div>

          <button
            className={styles.navButton}
            onClick={() => navigate(`/datasets/${datasetId}/clusters`)}
            title="Go to Term Clustering"
          >
            Clustering →
          </button>
        </div>

        {/* Statistics and Actions */}
        <div className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <StatCard label="Total" value={stats?.total_records ?? 0} />
            <StatCard label="Terms" value={stats?.extracted_terms_count ?? 0} variant="terms" />
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.processed}`}>
                {reviewedValue}
                {displayMode === "percentage" ? "%" : ""}
              </div>
              {displayMode === "percentage" && (
                <span className={styles.ratioSuffix}>
                  ({formatCompactNumber(reviewedRecords)}/{formatCompactNumber(totalRecords)})
                </span>
              )}
              <div className={styles.statLabel}>Reviewed</div>
            </div>
          </div>
          <div className={styles.pageActions}>
            <button
              className={`${styles.actionButton} ${styles.extract}`}
              onClick={handleExtractTermsForDataset}
              disabled={isExtractingDataset || !dataset?.labels?.length}
              title={!dataset?.labels?.length ? "No labels defined for this dataset" : "Extract terms from all records"}
            >
              {isExtractingDataset ? "Extracting..." : "Extract All Terms"}
            </button>
            <button
              className={`${styles.actionButton} ${styles.danger}`}
              onClick={handleDeleteExtractedTerms}
              disabled={isExtractingDataset}
              title="Delete all automatically extracted terms"
            >
              Delete Extracted Terms
            </button>
            {isExtractingDataset && (
              <button
                className={`${styles.actionButton} ${styles.secondary}`}
                onClick={cancelDatasetExtraction}
                disabled={isCancellingExtraction}
              >
                {isCancellingExtraction ? "Cancelling…" : "Cancel Extraction"}
              </button>
            )}
          </div>
          {isExtractingDataset && (
            <div className={styles.progressWrapper}>
              <span className={styles.progressLabel}>
                Extraction in progress…
                {extractionProgress && extractionProgress.total > 0
                  ? ` ${extractionProgress.completed}/${extractionProgress.total}`
                  : ""}
              </span>
              <ProgressBar
                progress={
                  extractionProgress && extractionProgress.total > 0
                    ? (extractionProgress.completed / extractionProgress.total) * 100
                    : 0
                }
                showPercentage
              />
            </div>
          )}
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
                placeholder="Search by patient ID..."
                value={patientIdQuery}
                onChange={(e) => setPatientIdQuery(e.target.value)}
              />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className={styles.filterGroup}>
                <label>
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="all"
                    checked={reviewStatusFilter === "all"}
                    onChange={(e) => setReviewStatusFilter(e.target.value as "all")}
                  />
                  <span>All</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="reviewed"
                    checked={reviewStatusFilter === "reviewed"}
                    onChange={(e) => setReviewStatusFilter(e.target.value as "reviewed")}
                  />
                  <span>Reviewed</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="not_reviewed"
                    checked={reviewStatusFilter === "not_reviewed"}
                    onChange={(e) => setReviewStatusFilter(e.target.value as "not_reviewed")}
                  />
                  <span>Not Reviewed</span>
                </label>
              </div>
            </div>
            <div className={styles.recordsList}>
              {isLoading ? (
                <div className={styles.loading}>Loading records...</div>
              ) : records.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>📄</div>
                  <p className={styles.emptyStateText}>
                    {searchQuery || patientIdQuery || reviewStatusFilter !== "all"
                      ? "No matching records"
                      : "No records yet"}
                  </p>
                </div>
              ) : (
                <>
                  {records.map((record) => (
                    <RecordItem
                      key={record.id}
                      record={record}
                      isSelected={selectedRecord?.id === record.id}
                      onClick={() => selectRecord(record)}
                    />
                  ))}
                  {hasMore && <div ref={loadMoreRef} className={styles.loadMoreTrigger} />}
                  {isLoadingMore && <div className={styles.loadingMore}>Loading more records...</div>}
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
                    <h2 className={styles.recordTextTitle}>NER View</h2>
                    <div className={styles.detailActions}>
                      <button
                        className={`${styles.actionButton} ${styles.extract}`}
                        onClick={handleExtractTermsForRecord}
                        disabled={isExtracting || !dataset?.labels?.length}
                        title={
                          !dataset?.labels?.length
                            ? "No labels defined for this dataset"
                            : "Extract terms from this record"
                        }
                      >
                        {isExtracting ? "Extracting..." : "Extract Terms"}
                      </button>
                      <button className={`${styles.actionButton} ${styles.secondary}`} onClick={handleOpenAnnotation}>
                        Edit Labels
                      </button>
                      <button className={`${styles.actionButton} ${styles.primary}`} onClick={handleMarkReviewed}>
                        {selectedRecord.reviewed ? "Unmark Reviewed" : "Mark Reviewed"}
                      </button>
                    </div>
                  </div>
                  <div className={styles.recordTextHeader}>
                    <h3 className={styles.recordTextTitle}>
                      Patient ID: {selectedRecord.patient_id}
                      {selectedRecord.seq_number && ` | #${selectedRecord.seq_number}`}
                    </h3>
                  </div>
                  <div className={styles.recordTextContent}>
                    {isLoadingTerms ? (
                      <div className={styles.loading}>Loading...</div>
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
                    <h2 className={styles.termsPanelTitle}>Extracted Terms ({selectedRecordTerms.length})</h2>
                  </div>
                  <div className={styles.termsPanelContent}>
                    {selectedRecordTerms.length === 0 ? (
                      <div className={styles.emptyState}>
                        <p className={styles.emptyStateText}>No terms extracted</p>
                        <p className={styles.emptyStateSubtext}>Run NER extraction to identify terms</p>
                      </div>
                    ) : (
                      <div className={styles.termsList}>
                        {selectedRecordTerms.map((term) => (
                          <div key={term.id} className={styles.termItem}>
                            <div className={styles.termInfo}>
                              <div className={styles.termMeta}>
                                <span className={styles.termValue}>{term.value}</span>
                                {term.start_position !== null && (
                                  <span className={styles.termPosition}>
                                    [{term.start_position}-{term.end_position}]
                                  </span>
                                )}
                                <button className={styles.termViewButton} onClick={() => scrollToTerm(term.id)}>
                                  View
                                </button>
                              </div>
                              <span
                                className={`${styles.termLabel} ${styles[getLabelColorClass(term.label, dataset?.labels ?? [])]}`}
                              >
                                {term.label}
                              </span>
                            </div>
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
                  <p className={styles.emptyStateText}>Select a record to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Annotation Sidebar */}
        <AnnotationSidebar
          isOpen={isAnnotating}
          text={selectedRecord?.text ?? ""}
          labels={dataset?.labels ?? []}
          selectedLabel={selectedLabel}
          onSelectLabel={setSelectedLabel}
          annotations={selectedRecordTerms}
          selectedAnnotation={selectedAnnotation}
          onSelectAnnotation={setSelectedAnnotation}
          onCreateAnnotation={handleCreateAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
          onUpdateAnnotationLabel={handleUpdateAnnotationLabel}
          onClose={handleCloseAnnotation}
          onPreviousRecord={handlePreviousRecord}
          onNextRecord={handleNextRecord}
          hasPreviousRecord={hasPreviousRecord}
          hasNextRecord={hasNextRecord}
          onMarkReviewed={handleMarkReviewedInSidebar}
          isReviewed={selectedRecord?.reviewed ?? false}
        />
      </div>
    </Layout>
  );
};

export default DatasetRecords;
