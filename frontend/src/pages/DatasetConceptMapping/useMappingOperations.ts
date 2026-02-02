import { useCallback } from "react";

import * as api from "@/api";

import type { ClusterMapping, AutoMapRequest, ConceptSearchResult } from "@/types";

interface UseMappingOperationsProps {
  datasetId: string | undefined;
  selectedMapping: ClusterMapping | null;
  selectedVocabularies: number[];
  selectedLabel: string;
  domainFilter: string;
  conceptClassFilter: string;
  standardOnly: boolean;
  searchQuery: string;
  mappings: ClusterMapping[];
  setMappings: (mappings: ClusterMapping[]) => void;
  setSearchResults: (results: ConceptSearchResult[]) => void;
  setSelectedMapping: (mapping: ClusterMapping | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsSearching: (searching: boolean) => void;
  setIsMapping: (mapping: boolean) => void;
  setError: (error: string | null) => void;
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
}

export function useMappingOperations({
  datasetId,
  selectedMapping,
  selectedVocabularies,
  selectedLabel,
  domainFilter,
  conceptClassFilter,
  standardOnly,
  searchQuery,
  mappings,
  setMappings,
  setSearchResults,
  setSelectedMapping,
  setIsLoading,
  setIsSearching,
  setIsMapping,
  setError,
  toast,
}: UseMappingOperationsProps) {
  const fetchMappings = useCallback(async () => {
    if (!datasetId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getDatasetMappings(parseInt(datasetId), selectedLabel || undefined);
      setMappings(data.mappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mappings");
    } finally {
      setIsLoading(false);
    }
  }, [datasetId, selectedLabel, setIsLoading, setError, setMappings]);

  const handleAutoSearch = useCallback(async () => {
    if (!selectedMapping || !datasetId || selectedVocabularies.length === 0) return;

    try {
      setIsSearching(true);
      const request: AutoMapRequest = {
        vocabulary_ids: selectedVocabularies,
        use_cluster_terms: true,
        domain_id: domainFilter || undefined,
        concept_class_id: conceptClassFilter || undefined,
        standard_concept: standardOnly ? "S" : undefined,
      };

      const results = await api.autoMapCluster(parseInt(datasetId), selectedMapping.cluster_id, request);
      setSearchResults(results.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [
    datasetId,
    selectedMapping,
    selectedVocabularies,
    domainFilter,
    conceptClassFilter,
    standardOnly,
    setIsSearching,
    setSearchResults,
    setError,
  ]);

  const handleManualSearch = useCallback(async () => {
    if (!searchQuery || selectedVocabularies.length === 0) return;

    try {
      setIsSearching(true);
      const results = await api.searchConcepts({
        query: searchQuery,
        vocabulary_ids: selectedVocabularies,
        domain_id: domainFilter || undefined,
        concept_class_id: conceptClassFilter || undefined,
        standard_concept: standardOnly ? "S" : undefined,
        limit: 10,
      });

      setSearchResults(results.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [
    searchQuery,
    selectedVocabularies,
    domainFilter,
    conceptClassFilter,
    standardOnly,
    setIsSearching,
    setSearchResults,
    setError,
  ]);

  const handleMapConcept = useCallback(
    async (conceptId: number, status: "pending" | "approved" | "rejected" = "pending") => {
      if (!selectedMapping || !datasetId) return;

      try {
        setIsMapping(true);
        await api.mapClusterToConcept(parseInt(datasetId), selectedMapping.cluster_id, {
          concept_id: conceptId,
          status,
        });
        await fetchMappings();
        toast.success(status === "approved" ? "Mapping approved" : "Concept mapped successfully");

        // Update selected mapping
        const updated = mappings.find((m) => m.cluster_id === selectedMapping.cluster_id);
        if (updated) {
          setSelectedMapping(updated);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Mapping failed");
      } finally {
        setIsMapping(false);
      }
    },
    [datasetId, selectedMapping, mappings, fetchMappings, setIsMapping, setSelectedMapping, toast]
  );

  const performDeleteMapping = useCallback(async () => {
    if (!selectedMapping || !datasetId) return;

    try {
      await api.deleteClusterMapping(parseInt(datasetId), selectedMapping.cluster_id);
      await fetchMappings();
      toast.success("Mapping removed successfully");

      const updated = mappings.find((m) => m.cluster_id === selectedMapping.cluster_id);
      if (updated) {
        setSelectedMapping(updated);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete mapping");
    }
  }, [datasetId, selectedMapping, mappings, fetchMappings, setSelectedMapping, toast]);

  const performAutoMapAll = useCallback(async () => {
    if (!datasetId) return;

    try {
      setIsLoading(true);
      const response = await api.autoMapAllClusters(parseInt(datasetId), {
        vocabulary_ids: selectedVocabularies,
        label: selectedLabel || undefined,
        use_cluster_terms: true,
      });

      toast.success(`Auto-mapping complete! Mapped: ${response.mapped_count}, Failed: ${response.failed_count}`);
      await fetchMappings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-mapping failed");
    } finally {
      setIsLoading(false);
    }
  }, [datasetId, selectedVocabularies, selectedLabel, fetchMappings, setIsLoading, toast]);

  const handleExport = useCallback(async () => {
    if (!datasetId) return;

    try {
      await api.exportMappings(parseInt(datasetId));
      toast.success("Mappings exported successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }, [datasetId, toast]);

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !datasetId) return;

      try {
        setIsLoading(true);
        const result = await api.importMappings(parseInt(datasetId), file);
        toast.success(result.message);
        await fetchMappings();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      } finally {
        setIsLoading(false);
      }
    },
    [datasetId, fetchMappings, setIsLoading, toast]
  );

  return {
    fetchMappings,
    handleAutoSearch,
    handleManualSearch,
    handleMapConcept,
    performDeleteMapping,
    performAutoMapAll,
    handleExport,
    handleImport,
  };
}
