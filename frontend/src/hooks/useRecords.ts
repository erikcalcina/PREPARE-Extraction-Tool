import { useState, useEffect, useCallback } from 'react';
import type {
    Record,
    SourceTerm,
    SourceTermCreate,
    DatasetStats,
    PaginationMetadata,
    Dataset,
} from 'types';
import {
    getRecords,
    getRecord,
    getRecordSourceTerms,
    getDatasetStats,
    getDataset,
    markRecordReviewed as markRecordReviewedAPI,
    createSourceTerm as createSourceTermAPI,
    deleteSourceTerm as deleteSourceTermAPI,
    extractRecordTerms as extractRecordTermsAPI,
    extractDatasetTerms as extractDatasetTermsAPI,
    getDatasetExtractionStatus as getDatasetExtractionStatusAPI,
    cancelDatasetExtraction as cancelDatasetExtractionAPI,
} from 'api';

// ================================================
// Hook
// ================================================

export function useRecords(datasetId: number) {
    const [dataset, setDataset] = useState<Dataset | null>(null);
    const [records, setRecords] = useState<Record[]>([]);
    const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
    const [stats, setStats] = useState<DatasetStats | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
    const [selectedRecordTerms, setSelectedRecordTerms] = useState<SourceTerm[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingTerms, setIsLoadingTerms] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExtractingDataset, setIsExtractingDataset] = useState(false);
    const [isCancellingExtraction, setIsCancellingExtraction] = useState(false);
    const [extractionJobId, setExtractionJobId] = useState<string | null>(null);
    const [extractionProgress, setExtractionProgress] = useState<{
        completed: number;
        total: number;
        status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [patientIdFilter, setPatientIdFilter] = useState<string>('');
    const [textFilter, setTextFilter] = useState<string>('');
    const [reviewedFilter, setReviewedFilter] = useState<boolean | undefined>(undefined);

    // Fetch dataset info
    const fetchDataset = useCallback(async () => {
        try {
            const response = await getDataset(datasetId);
            setDataset(response.dataset);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch dataset');
        }
    }, [datasetId]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await getDatasetStats(datasetId);
            setStats(response);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, [datasetId]);

    // Fetch records (initial or refresh)
    const fetchRecords = useCallback(async (page = 1, limit = 20) => {
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
            setError(err instanceof Error ? err.message : 'Failed to fetch records');
        } finally {
            setIsLoading(false);
        }
    }, [datasetId, patientIdFilter, textFilter, reviewedFilter]);

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
            setRecords(prev => [...prev, ...response.records]);
            setPagination(response.pagination);
        } catch (err) {
            console.error('Failed to load more records:', err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [datasetId, pagination, isLoadingMore, patientIdFilter, textFilter, reviewedFilter]);

    // Check if there are more records to load
    const hasMore = pagination ? pagination.page < pagination.total_pages : false;

    // Select a record and fetch its source terms
    const selectRecord = useCallback(async (record: Record) => {
        setSelectedRecord(record);
        setIsLoadingTerms(true);
        try {
            const response = await getRecordSourceTerms(datasetId, record.id);
            setSelectedRecordTerms(response.source_terms);
        } catch (err) {
            console.error('Failed to fetch source terms:', err);
            setSelectedRecordTerms([]);
        } finally {
            setIsLoadingTerms(false);
        }
    }, [datasetId]);

    // Refresh selected record data
    const refreshSelectedRecord = useCallback(async () => {
        if (!selectedRecord) return;
        try {
            const response = await getRecord(datasetId, selectedRecord.id);
            setSelectedRecord(response.record);
            // Update in the list too
            setRecords(prev =>
                prev.map(r => r.id === response.record.id ? response.record : r)
            );
        } catch (err) {
            console.error('Failed to refresh record:', err);
        }
    }, [datasetId, selectedRecord]);

    // Mark record as reviewed
    const markRecordReviewed = useCallback(async (recordId: number, reviewed = true) => {
        try {
            await markRecordReviewedAPI(datasetId, recordId, reviewed);
            // Update local state
            setRecords(prev =>
                prev.map(r => r.id === recordId ? { ...r, reviewed } : r)
            );
            if (selectedRecord?.id === recordId) {
                setSelectedRecord(prev => prev ? { ...prev, reviewed } : null);
            }
            // Refresh stats
            await fetchStats();
        } catch (err) {
            console.error('Failed to mark record as reviewed:', err);
            throw err;
        }
    }, [datasetId, selectedRecord, fetchStats]);

    // Add a new source term to the selected record
    const addSourceTerm = useCallback(async (term: SourceTermCreate) => {
        if (!selectedRecord) {
            throw new Error('No record selected');
        }
        try {
            const response = await createSourceTermAPI(datasetId, selectedRecord.id, term);
            // Update local state with the new term
            setSelectedRecordTerms(prev => [...prev, response.source_term]);
            // Refresh stats
            await fetchStats();
            return response.source_term;
        } catch (err) {
            console.error('Failed to create source term:', err);
            throw err;
        }
    }, [datasetId, selectedRecord, fetchStats]);

    // Remove a source term from the selected record
    const removeSourceTerm = useCallback(async (termId: number) => {
        try {
            await deleteSourceTermAPI(termId);
            // Update local state
            setSelectedRecordTerms(prev => prev.filter(t => t.id !== termId));
            // Refresh stats
            await fetchStats();
        } catch (err) {
            console.error('Failed to delete source term:', err);
            throw err;
        }
    }, [fetchStats]);

    // Extract terms for the selected record using bioner
    const extractTermsForRecord = useCallback(async () => {
        if (!selectedRecord) {
            throw new Error('No record selected');
        }
        if (!dataset?.labels || dataset.labels.length === 0) {
            throw new Error('No labels defined for this dataset');
        }

        setIsExtracting(true);
        try {
            const response = await extractRecordTermsAPI(
                datasetId,
                selectedRecord.id,
                dataset.labels
            );
            // Refresh the terms for the selected record
            const termsResponse = await getRecordSourceTerms(datasetId, selectedRecord.id);
            setSelectedRecordTerms(termsResponse.source_terms);
            // Refresh stats
            await fetchStats();
            return response;
        } catch (err) {
            console.error('Failed to extract terms for record:', err);
            throw err;
        } finally {
            setIsExtracting(false);
        }
    }, [datasetId, selectedRecord, dataset, fetchStats]);

    // Extract terms for all records in the dataset using bioner
    const extractTermsForDataset = useCallback(async () => {
        if (!dataset?.labels || dataset.labels.length === 0) {
            throw new Error('No labels defined for this dataset');
        }

        setIsExtractingDataset(true);
        setExtractionProgress({ completed: 0, total: 0, status: 'pending' });
        try {
            const { job_id } = await extractDatasetTermsAPI(datasetId, dataset.labels);
            if (!job_id) {
                throw new Error('Extraction job did not return an ID');
            }
            setExtractionJobId(job_id);

            // Poll until job finishes
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const status = await getDatasetExtractionStatusAPI(datasetId, job_id);

                setExtractionProgress({
                    completed: status.completed,
                    total: status.total,
                    status: status.status,
                });

                if (['completed', 'cancelled'].includes(status.status)) {
                    break;
                }
                if (status.status === 'failed') {
                    throw new Error(status.error_message || 'Dataset extraction failed');
                }
                await new Promise(res => setTimeout(res, 2000));
            }

            // Refresh the terms for the selected record if one is selected
            if (selectedRecord) {
                const termsResponse = await getRecordSourceTerms(datasetId, selectedRecord.id);
                setSelectedRecordTerms(termsResponse.source_terms);
            }
            // Refresh stats
            await fetchStats();

            return { status: 'completed' as const };
        } catch (err) {
            console.error('Failed to extract terms for dataset:', err);
            throw err;
        } finally {
            setIsExtractingDataset(false);
            setIsCancellingExtraction(false);
            setExtractionJobId(null);
            setExtractionProgress(null);
        }
    }, [datasetId, dataset, selectedRecord, fetchStats]);

    const cancelDatasetExtraction = useCallback(async () => {
        if (!extractionJobId) return;
        setIsCancellingExtraction(true);
        try {
            await cancelDatasetExtractionAPI(datasetId, extractionJobId);
        } catch (err) {
            console.error('Failed to cancel extraction job:', err);
            throw err;
        } finally {
            setIsCancellingExtraction(false);
        }
    }, [datasetId, extractionJobId]);

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
        isExtracting,
        isExtractingDataset,
        isCancellingExtraction,
        extractionJobId,
        extractionProgress,
        hasMore,
        error,
        fetchRecords,
        loadMoreRecords,
        selectRecord,
        refreshSelectedRecord,
        markRecordReviewed,
        fetchStats,
        addSourceTerm,
        removeSourceTerm,
        extractTermsForRecord,
        extractTermsForDataset,
        cancelDatasetExtraction,
        // Filter state and setters
        patientIdFilter,
        setPatientIdFilter,
        textFilter,
        setTextFilter,
        reviewedFilter,
        setReviewedFilter,
    };
}

