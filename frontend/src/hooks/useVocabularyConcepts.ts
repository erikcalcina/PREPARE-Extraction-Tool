import { useState, useEffect, useCallback, useMemo } from "react";
import type { Vocabulary, Concept, PaginationMetadata } from "types";
import { getVocabulary, getVocabularyConcepts, downloadVocabulary as downloadVocabularyAPI } from "api";

// ================================================
// Types
// ================================================

interface FilterOptions {
  domains: string[];
  conceptClasses: string[];
  standardConcepts: string[];
}

interface Filters {
  searchQuery: string;
  domain: string;
  conceptClass: string;
  standardConcept: string;
}

// ================================================
// Hook
// ================================================

export function useVocabularyConcepts(vocabularyId: number) {
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filters, setFilters] = useState<Filters>({
    searchQuery: "",
    domain: "",
    conceptClass: "",
    standardConcept: "",
  });

  // Debounced search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(filters.searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.searchQuery]);

  // Fetch vocabulary metadata
  const fetchVocabulary = useCallback(async () => {
    if (!vocabularyId) return;
    try {
      const response = await getVocabulary(vocabularyId);
      setVocabulary(response.vocabulary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch vocabulary");
    }
  }, [vocabularyId]);

  // Fetch concepts
  const fetchConcepts = useCallback(
    async (page = 1, limit = 50) => {
      if (!vocabularyId) return;
      setIsLoadingConcepts(true);
      try {
        const response = await getVocabularyConcepts(vocabularyId, page, limit);
        setConcepts(response.concepts);
        setPagination(response.pagination);
        setCurrentPage(page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch concepts");
      } finally {
        setIsLoadingConcepts(false);
      }
    },
    [vocabularyId]
  );

  // Initial fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      await Promise.all([fetchVocabulary(), fetchConcepts(1, 50)]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchVocabulary, fetchConcepts]);

  // Compute unique filter options from loaded concepts
  const filterOptions = useMemo<FilterOptions>(() => {
    const domains = new Set<string>();
    const conceptClasses = new Set<string>();
    const standardConcepts = new Set<string>();

    concepts.forEach((concept) => {
      if (concept.domain_id) domains.add(concept.domain_id);
      if (concept.concept_class_id) conceptClasses.add(concept.concept_class_id);
      if (concept.standard_concept) standardConcepts.add(concept.standard_concept);
    });

    return {
      domains: Array.from(domains).sort(),
      conceptClasses: Array.from(conceptClasses).sort(),
      standardConcepts: Array.from(standardConcepts).sort(),
    };
  }, [concepts]);

  // Filter concepts client-side
  const filteredConcepts = useMemo(() => {
    return concepts.filter((concept) => {
      // Text search across name, id, and code
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const matchesName = concept.vocab_term_name?.toLowerCase().includes(query);
        const matchesId = concept.vocab_term_id?.toLowerCase().includes(query);
        const matchesCode = concept.concept_code?.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesCode) return false;
      }

      // Domain filter
      if (filters.domain && concept.domain_id !== filters.domain) return false;

      // Concept class filter
      if (filters.conceptClass && concept.concept_class_id !== filters.conceptClass) return false;

      // Standard concept filter
      if (filters.standardConcept && concept.standard_concept !== filters.standardConcept) return false;

      return true;
    });
  }, [concepts, debouncedSearchQuery, filters.domain, filters.conceptClass, filters.standardConcept]);

  // Update filters
  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: "",
      domain: "",
      conceptClass: "",
      standardConcept: "",
    });
  }, []);

  // Download vocabulary
  const downloadVocabulary = useCallback(async () => {
    if (!vocabularyId) return;
    await downloadVocabularyAPI(vocabularyId);
  }, [vocabularyId]);

  // Pagination
  const goToPage = useCallback(
    (page: number) => {
      fetchConcepts(page, pagination?.limit || 50);
    },
    [fetchConcepts, pagination?.limit]
  );

  return {
    vocabulary,
    concepts: filteredConcepts,
    allConcepts: concepts,
    pagination,
    isLoading,
    isLoadingConcepts,
    error,
    currentPage,
    filters,
    filterOptions,
    updateFilter,
    clearFilters,
    downloadVocabulary,
    goToPage,
    fetchConcepts,
  };
}
