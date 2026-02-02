import { useCallback } from "react";
import type { SourceTerm, SourceTermCreate } from "@/types";
import {
  createSourceTerm as createSourceTermAPI,
  deleteSourceTerm as deleteSourceTermAPI,
  updateSourceTerm as updateSourceTermAPI,
} from "@/api";

interface UseSourceTermsParams {
  datasetId: number;
  selectedRecordId: number | null;
  setSelectedRecordTerms: React.Dispatch<React.SetStateAction<SourceTerm[]>>;
  fetchStats: () => Promise<void>;
}

export function useSourceTerms({
  datasetId,
  selectedRecordId,
  setSelectedRecordTerms,
  fetchStats,
}: UseSourceTermsParams) {
  const addSourceTerm = useCallback(
    async (term: SourceTermCreate) => {
      if (!selectedRecordId) {
        throw new Error("No record selected");
      }
      const response = await createSourceTermAPI(datasetId, selectedRecordId, term);
      setSelectedRecordTerms((prev) => [...prev, response.source_term]);
      await fetchStats();
      return response.source_term;
    },
    [datasetId, selectedRecordId, setSelectedRecordTerms, fetchStats]
  );

  const removeSourceTerm = useCallback(
    async (termId: number) => {
      await deleteSourceTermAPI(termId);
      setSelectedRecordTerms((prev) => prev.filter((t) => t.id !== termId));
      await fetchStats();
    },
    [setSelectedRecordTerms, fetchStats]
  );

  const updateSourceTermLabel = useCallback(
    async (termId: number, newLabel: string) => {
      const response = await updateSourceTermAPI(termId, { label: newLabel });
      setSelectedRecordTerms((prev) => prev.map((t) => (t.id === termId ? response.source_term : t)));
      return response.source_term;
    },
    [setSelectedRecordTerms]
  );

  return {
    addSourceTerm,
    removeSourceTerm,
    updateSourceTermLabel,
  };
}
