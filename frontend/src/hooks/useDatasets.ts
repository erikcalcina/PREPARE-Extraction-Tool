import { useState, useEffect, useCallback } from 'react';
import type { Dataset, DatasetCreate, PaginationMetadata } from 'types';
import {
    getDatasets,
    createDataset,
    deleteDataset,
    downloadDataset as downloadDatasetAPI,
} from 'api';

// ================================================
// Hook
// ================================================

export function useDatasets() {
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDatasets = useCallback(async (page = 1, limit = 50) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await getDatasets(page, limit);
            setDatasets(response.datasets);
            setPagination(response.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch datasets');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addDataset = useCallback(async (data: DatasetCreate) => {
        const response = await createDataset(data);
        // Refresh the list
        await fetchDatasets();
        return response.dataset;
    }, [fetchDatasets]);

    const removeDataset = useCallback(async (id: number) => {
        await deleteDataset(id);
        // Refresh the list
        await fetchDatasets();
    }, [fetchDatasets]);

    const downloadDataset = useCallback(async (id: number) => {
        await downloadDatasetAPI(id);
    }, []);

    // Fetch on mount
    useEffect(() => {
        fetchDatasets();
    }, [fetchDatasets]);

    return {
        datasets,
        pagination,
        isLoading,
        error,
        fetchDatasets,
        addDataset,
        removeDataset,
        downloadDataset,
    };
}

