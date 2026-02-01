import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import classNames from "classnames";

import Layout from "@/components/Layout";
import Button from "@/components/Button";
import StatCard from "@/components/StatCard";
import WorkflowPageHeader from "@/components/WorkflowPageHeader";
import ProgressBar from "@/components/ProgressBar";
import { useRecords } from "@/hooks/useRecords";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatCompactNumber } from "@/utils/formatters";
import { getLabelColorClass } from "@/utils/labelColors";
import HighlightedText from "./HighlightedText";
import RecordItem from "./RecordItem";
import AnnotationSidebar from "./AnnotationSidebar";

import type { SourceTermCreate } from "@/types";

import styles from "./styles.module.css";

const DatasetRecords: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [patientIdQuery, setPatientIdQuery] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<"all" | "reviewed" | "not_reviewed">("all");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [displayMode] = useState<"percentage" | "ratio">("percentage");

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

  return (
    <Layout>
      <div className={styles.page}>
        {/* Header with Navigation */}
        <WorkflowPageHeader
          title="Term Extraction"
          datasetId={datasetId!}
          datasetName={dataset?.name}
          backButton={{
            label: "Back to Overview",
            to: `/datasets/${datasetId}`,
            title: "Back to Dataset Overview",
          }}
          forwardButton={{
            label: "Clustering",
            to: `/datasets/${datasetId}/clusters`,
            title: "Go to Term Clustering",
          }}
          helpContent={
            <>
              <p>Annotate the text with the appropriate labels to identify medical terms for standardization.</p>
              <strong>How to use:</strong>
              <ul>
                <li>Click Extract All Terms to automatically identify terms</li>
                <li>Click Edit Labels to manually add or remove annotations</li>
                <li>Mark records as Reviewed when done</li>
                <li>Use filters to find specific records</li>
              </ul>
            </>
          }
        />

        {/* Statistics and Actions */}
        <div className={styles["stats-section"]}>
          <div className={styles["stats-section__grid"]}>
            <StatCard label="Total" value={stats?.total_records ?? 0} />
            <StatCard label="Terms" value={stats?.extracted_terms_count ?? 0} color="blue" />
            <StatCard
              label="Reviewed"
              value={
                displayMode === "percentage"
                  ? `${reviewedValue}% (${formatCompactNumber(reviewedRecords)}/${formatCompactNumber(totalRecords)})`
                  : reviewedValue
              }
              color="green"
            />
          </div>
          <div className={styles["stats-section__actions"]}>
            <Button
              variant="outline"
              onClick={handleExtractTermsForDataset}
              disabled={isExtractingDataset || !dataset?.labels?.length}
              title={!dataset?.labels?.length ? "No labels defined for this dataset" : "Extract terms from all records"}
            >
              {isExtractingDataset ? "Extracting..." : "Extract All Terms"}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteExtractedTerms}
              disabled={isExtractingDataset}
              title="Delete all automatically extracted terms"
            >
              Delete Extracted Terms
            </Button>
            {isExtractingDataset && (
              <Button variant="primary" onClick={cancelDatasetExtraction} disabled={isCancellingExtraction}>
                {isCancellingExtraction ? "Cancelling…" : "Cancel Extraction"}
              </Button>
            )}
          </div>
          {isExtractingDataset && (
            <div className={styles["stats-section__progress"]}>
              <span className={styles["stats-section__progress-label"]}>
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
          <div className={styles["records-panel"]}>
            <div className={styles["records-panel__header"]}>
              <h2 className={styles["records-panel__title"]}>Records List</h2>
              <input
                type="text"
                className={styles["records-panel__search"]}
                placeholder="Search by patient ID..."
                value={patientIdQuery}
                onChange={(e) => setPatientIdQuery(e.target.value)}
              />
              <input
                type="text"
                className={styles["records-panel__search"]}
                placeholder="Search by text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className={styles["records-panel__filters"]}>
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
            <div className={styles["records-panel__list"]}>
              {isLoading ? (
                <div className={styles.loading}>Loading records...</div>
              ) : records.length === 0 ? (
                <div className={styles["empty-state"]}>
                  <div className={styles["empty-state__icon"]}>📄</div>
                  <p className={styles["empty-state__text"]}>
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
                  {hasMore && <div ref={loadMoreRef} className={styles["load-more-trigger"]} />}
                  {isLoadingMore && <div className={styles["loading-more"]}>Loading more records...</div>}
                </>
              )}
            </div>
          </div>

          {/* Detail Panels */}
          <div className={styles["detail-panels"]}>
            {selectedRecord ? (
              <>
                {/* Record Text Panel */}
                <div className={styles["record-text-panel"]}>
                  <div className={styles["record-text-panel__header"]}>
                    <h2 className={styles["record-text-panel__title"]}>NER View</h2>
                    <div className={styles["record-text-panel__actions"]}>
                      <Button
                        variant="outline"
                        size="small"
                        onClick={handleExtractTermsForRecord}
                        disabled={isExtracting || !dataset?.labels?.length}
                        title={
                          !dataset?.labels?.length
                            ? "No labels defined for this dataset"
                            : "Extract terms from this record"
                        }
                      >
                        {isExtracting ? "Extracting..." : "Extract Terms"}
                      </Button>
                      <Button variant="primary" size="small" onClick={handleOpenAnnotation}>
                        Edit Labels
                      </Button>
                      <Button variant="success" size="small" onClick={handleMarkReviewed}>
                        {selectedRecord.reviewed ? "Unmark Reviewed" : "Mark Reviewed"}
                      </Button>
                    </div>
                  </div>
                  <div className={styles["record-text-panel__header"]}>
                    <h3 className={styles["record-text-panel__title"]}>
                      Patient ID: {selectedRecord.patient_id}
                      {selectedRecord.seq_number && ` | #${selectedRecord.seq_number}`}
                    </h3>
                  </div>
                  <div className={styles["record-text-panel__content"]}>
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
                <div className={styles["terms-panel"]}>
                  <div className={styles["terms-panel__header"]}>
                    <h2 className={styles["terms-panel__title"]}>Extracted Terms ({selectedRecordTerms.length})</h2>
                  </div>
                  <div className={styles["terms-panel__content"]}>
                    {selectedRecordTerms.length === 0 ? (
                      <div className={styles["empty-state"]}>
                        <p className={styles["empty-state__text"]}>No terms extracted</p>
                        <p className={styles["empty-state__subtext"]}>Run NER extraction to identify terms</p>
                      </div>
                    ) : (
                      <div className={styles["terms-list"]}>
                        {selectedRecordTerms.map((term) => (
                          <div key={term.id} className={styles["term-item"]}>
                            <div className={styles["term-item__info"]}>
                              <div className={styles["term-item__meta"]}>
                                <span className={styles["term-item__value"]}>{term.value}</span>
                                {term.start_position !== null && (
                                  <span className={styles["term-item__position"]}>
                                    [{term.start_position}-{term.end_position}]
                                  </span>
                                )}
                                <Button variant="ghost" size="small" onClick={() => scrollToTerm(term.id)}>
                                  View
                                </Button>
                              </div>
                              <span
                                className={classNames(
                                  styles["term-item__label"],
                                  styles[getLabelColorClass(term.label, dataset?.labels ?? [])]
                                )}
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
              <div className={styles["record-text-panel"]}>
                <div className={styles["empty-state"]}>
                  <div className={styles["empty-state__icon"]}>👈</div>
                  <p className={styles["empty-state__text"]}>Select a record to view details</p>
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
