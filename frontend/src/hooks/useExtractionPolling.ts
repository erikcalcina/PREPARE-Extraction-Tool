import { useState, useEffect, useCallback, useRef } from "react";
import type { SourceTerm, Dataset } from "@/types";
import {
  getRecordSourceTerms,
  extractRecordTerms as extractRecordTermsAPI,
  extractDatasetTerms as extractDatasetTermsAPI,
  getDatasetExtractionStatus as getDatasetExtractionStatusAPI,
  cancelDatasetExtraction as cancelDatasetExtractionAPI,
  deleteDatasetExtractedTerms as deleteDatasetExtractedTermsAPI,
} from "@/api";

interface ExtractionProgress {
  completed: number;
  total: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
}

interface UseExtractionPollingParams {
  datasetId: number;
  dataset: Dataset | null;
  selectedRecordId: number | null;
  setSelectedRecordTerms: React.Dispatch<React.SetStateAction<SourceTerm[]>>;
  fetchStats: () => Promise<void>;
  refreshRecords: () => Promise<void>;
}

export function useExtractionPolling({
  datasetId,
  dataset,
  selectedRecordId,
  setSelectedRecordTerms,
  fetchStats,
  refreshRecords,
}: UseExtractionPollingParams) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractingDataset, setIsExtractingDataset] = useState(false);
  const [isCancellingExtraction, setIsCancellingExtraction] = useState(false);
  const [extractionJobId, setExtractionJobId] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);

  const cancelledRef = useRef(false);
  const latestSelectedRecordIdRef = useRef<number | null>(null);
  const extractionStorageKey = `extractionJob-${datasetId}`;

  // Cleanup on unmount
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    latestSelectedRecordIdRef.current = selectedRecordId;
  }, [selectedRecordId]);

  const pollExtractionJob = useCallback(
    async (jobId: string) => {
      setIsExtractingDataset(true);
      setExtractionJobId(jobId);
      localStorage.setItem(extractionStorageKey, jobId);

      try {
        let pollCount = 0;
        let lastStatus: ExtractionProgress["status"] = "pending";
        while (!cancelledRef.current) {
          const status = await getDatasetExtractionStatusAPI(datasetId, jobId);

          if (cancelledRef.current) break;

          lastStatus = status.status;
          setExtractionProgress({
            completed: status.completed,
            total: status.total,
            status: status.status,
          });

          if (["completed", "cancelled"].includes(status.status)) {
            break;
          }
          if (status.status === "failed") {
            throw new Error(status.error_message || "Dataset extraction failed");
          }

          pollCount++;
          if (pollCount % 5 === 0) {
            await refreshRecords();
          }

          await new Promise((res) => setTimeout(res, 2000));
        }

        const activeRecordId = latestSelectedRecordIdRef.current;
        if (!cancelledRef.current && activeRecordId) {
          const termsResponse = await getRecordSourceTerms(datasetId, activeRecordId);
          if (cancelledRef.current || latestSelectedRecordIdRef.current !== activeRecordId) {
            return { status: lastStatus };
          }
          setSelectedRecordTerms(termsResponse.source_terms);
        }
        if (!cancelledRef.current) {
          await refreshRecords();
          await fetchStats();
        }

        return { status: lastStatus };
      } finally {
        setIsExtractingDataset(false);
        setIsCancellingExtraction(false);
        setExtractionJobId(null);
        setExtractionProgress(null);
        localStorage.removeItem(extractionStorageKey);
      }
    },
    [datasetId, selectedRecordId, setSelectedRecordTerms, fetchStats, refreshRecords, extractionStorageKey]
  );

  const extractTermsForRecord = useCallback(async () => {
    if (!selectedRecordId) {
      throw new Error("No record selected");
    }
    if (!dataset?.labels || dataset.labels.length === 0) {
      throw new Error("No labels defined for this dataset");
    }

    setIsExtracting(true);
    try {
      const response = await extractRecordTermsAPI(datasetId, selectedRecordId, dataset.labels);
      const termsResponse = await getRecordSourceTerms(datasetId, selectedRecordId);
      setSelectedRecordTerms(termsResponse.source_terms);
      await refreshRecords();
      await fetchStats();
      return response;
    } finally {
      setIsExtracting(false);
    }
  }, [datasetId, selectedRecordId, dataset, setSelectedRecordTerms, fetchStats, refreshRecords]);

  const extractTermsForDataset = useCallback(async () => {
    if (!dataset?.labels || dataset.labels.length === 0) {
      throw new Error("No labels defined for this dataset");
    }

    setExtractionProgress({ completed: 0, total: 0, status: "pending" });
    const { job_id } = await extractDatasetTermsAPI(datasetId, dataset.labels);
    if (!job_id) {
      throw new Error("Extraction job did not return an ID");
    }

    return await pollExtractionJob(job_id);
  }, [datasetId, dataset, pollExtractionJob]);

  const cancelDatasetExtraction = useCallback(async () => {
    if (!extractionJobId) return;
    setIsCancellingExtraction(true);
    try {
      await cancelDatasetExtractionAPI(datasetId, extractionJobId);
    } catch (err) {
      setIsCancellingExtraction(false);
      throw err;
    }
  }, [datasetId, extractionJobId]);

  const deleteExtractedTermsForDataset = useCallback(async () => {
    const res = await deleteDatasetExtractedTermsAPI(datasetId);
    await refreshRecords();
    await fetchStats();
    if (selectedRecordId) {
      const termsResponse = await getRecordSourceTerms(datasetId, selectedRecordId);
      setSelectedRecordTerms(termsResponse.source_terms);
    }
    return res;
  }, [datasetId, selectedRecordId, setSelectedRecordTerms, fetchStats, refreshRecords]);

  // Resume polling if a job was running when the user navigated away
  useEffect(() => {
    const savedJobId = localStorage.getItem(extractionStorageKey);
    if (savedJobId && !isExtractingDataset) {
      pollExtractionJob(savedJobId).catch(() => {
        // Polling failure is non-critical — job status will be stale
      });
    }
  }, [extractionStorageKey, isExtractingDataset, pollExtractionJob]);

  return {
    isExtracting,
    isExtractingDataset,
    isCancellingExtraction,
    extractionJobId,
    extractionProgress,
    extractTermsForRecord,
    extractTermsForDataset,
    cancelDatasetExtraction,
    deleteExtractedTermsForDataset,
  };
}
