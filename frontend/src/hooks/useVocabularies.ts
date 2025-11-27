import { useState, useEffect, useCallback } from 'react';
import type { Vocabulary, VocabularyCreate, PaginationMetadata } from 'types';
import {
    getVocabularies,
    createVocabulary,
    deleteVocabulary,
    downloadVocabulary as downloadVocabularyAPI,
} from 'api';

// ================================================
// Hook
// ================================================

export function useVocabularies() {
    const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
    const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVocabularies = useCallback(async (page = 1, limit = 50) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await getVocabularies(page, limit);
            setVocabularies(response.vocabularies);
            setPagination(response.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch vocabularies');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addVocabulary = useCallback(async (data: VocabularyCreate) => {
        const response = await createVocabulary(data);
        // Refresh the list
        await fetchVocabularies();
        return response.vocabulary;
    }, [fetchVocabularies]);

    const removeVocabulary = useCallback(async (id: number) => {
        await deleteVocabulary(id);
        // Refresh the list
        await fetchVocabularies();
    }, [fetchVocabularies]);

    const downloadVocabulary = useCallback(async (id: number) => {
        await downloadVocabularyAPI(id);
    }, []);

    // Fetch on mount
    useEffect(() => {
        fetchVocabularies();
    }, [fetchVocabularies]);

    return {
        vocabularies,
        pagination,
        isLoading,
        error,
        fetchVocabularies,
        addVocabulary,
        removeVocabulary,
        downloadVocabulary,
    };
}

