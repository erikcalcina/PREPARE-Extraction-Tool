import type { RecordsOutput, RecordOutput, MessageOutput } from "types";

import { apiRequest } from "./client";

export async function getRecords(
  datasetId: number,
  page = 1,
  limit = 50,
  patientId?: string,
  text?: string,
  reviewed?: boolean
): Promise<RecordsOutput> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (patientId) {
    params.append("patient_id", patientId);
  }
  if (text) {
    params.append("text", text);
  }
  if (reviewed !== undefined) {
    params.append("reviewed", reviewed.toString());
  }

  return apiRequest<RecordsOutput>(`/datasets/${datasetId}/records?${params.toString()}`);
}

export async function getRecord(datasetId: number, recordId: number): Promise<RecordOutput> {
  return apiRequest<RecordOutput>(`/datasets/${datasetId}/records/${recordId}`);
}

export async function markRecordReviewed(datasetId: number, recordId: number, reviewed = true): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/datasets/${datasetId}/records/${recordId}/review?reviewed=${reviewed}`, {
    method: "PUT",
  });
}
