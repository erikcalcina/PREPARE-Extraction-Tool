import type { ClustersOutput, ClusterData, ClusterCreateRequest, ClusterMergeRequest, MessageOutput } from "types";

import { apiRequest, API_BASE_URL } from "./client";

export async function getClusters(datasetId: number, label?: string): Promise<ClustersOutput> {
  const params = label ? `?label=${encodeURIComponent(label)}` : "";
  return apiRequest<ClustersOutput>(`/datasets/${datasetId}/clusters${params}`);
}

export async function rebuildClusters(datasetId: number, label: string): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/datasets/${datasetId}/clusters/create?label=${encodeURIComponent(label)}`, {
    method: "POST",
  });
}

export async function createCluster(datasetId: number, data: ClusterCreateRequest): Promise<ClusterData> {
  return apiRequest<ClusterData>(`/datasets/${datasetId}/clusters`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function assignTermToCluster(termId: number, clusterId: number): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/source-terms/${termId}/map-cluster/${clusterId}`, { method: "POST" });
}

export async function unassignTermFromCluster(termId: number): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/source-terms/${termId}/unmap-cluster`, {
    method: "POST",
  });
}

export async function renameCluster(clusterId: number, title: string): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/clusters/${clusterId}?title=${encodeURIComponent(title)}`, { method: "PUT" });
}

export async function mergeClusters(datasetId: number, data: ClusterMergeRequest): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/datasets/${datasetId}/clusters/merge`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteCluster(clusterId: number): Promise<MessageOutput> {
  return apiRequest<MessageOutput>(`/clusters/${clusterId}`, {
    method: "DELETE",
  });
}

export async function updateClusterLabel(clusterId: number, label: string, color?: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/clusters/${clusterId}/label`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, color }),
  });

  if (!response.ok) {
    throw new Error("Failed to update cluster label");
  }
}
