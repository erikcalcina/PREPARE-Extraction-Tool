import type { SourceTermsOutput, SourceTermOutput, SourceTermCreate, SourceTermUpdate, MessageOutput } from "types";

import { apiRequest } from "./client";

export async function getRecordSourceTerms(datasetId: number, recordId: number, limit = 50): Promise<SourceTermsOutput> {
  return apiRequest<SourceTermsOutput>(`/datasets/${datasetId}/records/${recordId}/source-terms?limit=${limit}`);
}

export async function createSourceTerm(
  datasetId: number,
  recordId: number,
  term: SourceTermCreate
): Promise<SourceTermOutput> {
  return apiRequest<SourceTermOutput>(`/datasets/${datasetId}/records/${recordId}/source-terms`, {
    method: "POST",
    body: JSON.stringify(term),
  });
}

export async function deleteSourceTerm(termId: number): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/source-terms/${termId}`, {
    method: "DELETE",
  });
}

export async function updateSourceTerm(termId: number, update: SourceTermUpdate): Promise<SourceTermOutput> {
  return apiRequest<SourceTermOutput>(`/source-terms/${termId}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}
