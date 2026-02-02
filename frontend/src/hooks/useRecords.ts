import { useState, useEffect, useCallback } from "react";
import type { Record, SourceTerm, DatasetStats, PaginationMetadata, Dataset } from "@/types";
import {
  getRecords,
  getRecord,
  getRecordSourceTerms,
  getDatasetStats,
  getDataset,
  markRecordReviewed as markRecordReviewedAPI,
} from "@/api";
import { useSourceTerms } from "@/hooks/useSourceTerms";
import { useExtractionPolling } from "@/hooks/useExtractionPolling";

// ================================================
// Hook
// ================================================

export function useRecords(datasetId: number) {
  const SOURCE_TERMS_LIMIT = 500;
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [selectedRecordTerms, setSelectedRecordTerms] = useState<SourceTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [patientIdFilter, setPatientIdFilter] = useState<string>("");
  const [textFilter, setTextFilter] = useState<string>("");
  const [reviewedFilter, setReviewedFilter] = useState<boolean | undefined>(undefined);

  // Fetch dataset info
  const fetchDataset = useCallback(async () => {
    try {
      const response = await getDataset(datasetId);
      setDataset(response.dataset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dataset");
    }
  }, [datasetId]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await getDatasetStats(datasetId);
      setStats(response);
    } catch {
      // Stats fetch failure is non-critical — don't block UI
    }
  }, [datasetId]);

  // Fetch records (initial or refresh)
  const fetchRecords = useCallback(
    async (page = 1, limit = 20) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getRecords(
          datasetId,
          page,
          limit,
          patientIdFilter || undefined,
          textFilter || undefined,
          reviewedFilter
        );
        setRecords(response.records);
        setPagination(response.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch records");
      } finally {
        setIsLoading(false);
      }
    },
    [datasetId, patientIdFilter, textFilter, reviewedFilter]
  );

  // Load more records (for infinite scroll)
  const loadMoreRecords = useCallback(async () => {
    if (!pagination || isLoadingMore) return;

    const nextPage = pagination.page + 1;
    if (nextPage > pagination.total_pages) return;

    setIsLoadingMore(true);
    try {
      const response = await getRecords(
        datasetId,
        nextPage,
        pagination.limit,
        patientIdFilter || undefined,
        textFilter || undefined,
        reviewedFilter
      );
      setRecords((prev) => [...prev, ...response.records]);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more records");
    } finally {
      setIsLoadingMore(false);
    }
  }, [datasetId, pagination, isLoadingMore, patientIdFilter, textFilter, reviewedFilter]);

  // Check if there are more records to load
  const hasMore = pagination ? pagination.page < pagination.total_pages : false;

  // Select a record and fetch its source terms
  const selectRecord = useCallback(
    async (record: Record) => {
      setSelectedRecord(record);
      setIsLoadingTerms(true);
      try {
        const response = await getRecordSourceTerms(datasetId, record.id, SOURCE_TERMS_LIMIT);
        setSelectedRecordTerms(response.source_terms);
      } catch {
        setSelectedRecordTerms([]);
      } finally {
        setIsLoadingTerms(false);
      }
    },
    [datasetId]
  );

  // Refresh selected record data
  const refreshSelectedRecord = useCallback(async () => {
    if (!selectedRecord) return;
    try {
      const response = await getRecord(datasetId, selectedRecord.id);
      setSelectedRecord(response.record);
      setRecords((prev) => prev.map((r) => (r.id === response.record.id ? response.record : r)));
    } catch {
      // Refresh failure is non-critical
    }
  }, [datasetId, selectedRecord]);

  // Mark record as reviewed
  const markRecordReviewed = useCallback(
    async (recordId: number, reviewed = true) => {
      await markRecordReviewedAPI(datasetId, recordId, reviewed);
      setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, reviewed } : r)));
      if (selectedRecord?.id === recordId) {
        setSelectedRecord((prev) => (prev ? { ...prev, reviewed } : null));
      }
      await fetchStats();
    },
    [datasetId, selectedRecord, fetchStats]
  );

  // Silently re-fetch current records and selected record terms without resetting scroll/selection
  const refreshRecords = useCallback(async () => {
    try {
      const response = await getRecords(
        datasetId,
        1,
        records.length || 20,
        patientIdFilter || undefined,
        textFilter || undefined,
        reviewedFilter
      );
      setRecords(response.records);
      setPagination(response.pagination);
      setSelectedRecord((prev) => {
        if (!prev) return prev;
        const updated = response.records.find((r) => r.id === prev.id);
        return updated ?? prev;
      });
    } catch {
      // Non-critical — stale counts are acceptable
    }

    // Also refresh the selected record's source terms so the detail panel stays in sync
    if (selectedRecord) {
      try {
        const termsResponse = await getRecordSourceTerms(datasetId, selectedRecord.id, SOURCE_TERMS_LIMIT);
        setSelectedRecordTerms(termsResponse.source_terms);
      } catch {
        // Non-critical
      }
    }
  }, [datasetId, records.length, patientIdFilter, textFilter, reviewedFilter, selectedRecord]);

  // Compose sub-hooks
  const sourceTerms = useSourceTerms({
    datasetId,
    selectedRecordId: selectedRecord?.id ?? null,
    setSelectedRecordTerms,
    fetchStats,
  });

  const extraction = useExtractionPolling({
    datasetId,
    dataset,
    selectedRecordId: selectedRecord?.id ?? null,
    setSelectedRecordTerms,
    fetchStats,
    refreshRecords,
  });

  // Fetch on mount
  useEffect(() => {
    fetchDataset();
    fetchRecords();
    fetchStats();
  }, [fetchDataset, fetchRecords, fetchStats]);

  return {
    dataset,
    records,
    pagination,
    stats,
    selectedRecord,
    selectedRecordTerms,
    isLoading,
    isLoadingMore,
    isLoadingTerms,
    hasMore,
    error,
    fetchRecords,
    loadMoreRecords,
    selectRecord,
    refreshSelectedRecord,
    markRecordReviewed,
    fetchStats,
    // Source term operations
    ...sourceTerms,
    // Extraction operations
    ...extraction,
    // Filter state and setters
    patientIdFilter,
    setPatientIdFilter,
    textFilter,
    setTextFilter,
    reviewedFilter,
    setReviewedFilter,
  };
}
