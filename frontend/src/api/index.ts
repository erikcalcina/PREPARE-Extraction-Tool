import type {
    Token,
    User,
    UserRegister,
    UserStats,
    DatasetsOutput,
    DatasetOutput,
    DatasetCreate,
    DatasetStats,
    RecordsOutput,
    RecordOutput,
    SourceTermsOutput,
    SourceTermOutput,
    SourceTermCreate,
    VocabulariesOutput,
    VocabularyOutput,
    VocabularyCreate,
    MessageOutput,
    ClustersOutput,
    ClusterData,
    ClusterCreateRequest,
    ClusterMergeRequest,
} from 'types';

// ================================================
// Configuration
// ================================================

// Use VITE_BACKEND_HOST from environment if set (production/docker),
// otherwise use relative path for development (proxied by Vite)
const API_BASE_URL = import.meta.env.VITE_BACKEND_HOST
    ? `${import.meta.env.VITE_BACKEND_HOST}/api/v1`
    : '/api/v1';

// ================================================
// Token management
// ================================================

const TOKEN_KEY = 'access_token';

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

// ================================================
// API client
// ================================================

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

async function apiRequest<T>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<T> {
    const { skipAuth = false, headers: customHeaders, ...rest } = options;

    const headers: HeadersInit = {
        ...customHeaders,
    };

    // Add auth header if token exists and not skipped
    if (!skipAuth) {
        const token = getToken();
        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
    }

    // Add content-type for JSON bodies
    if (rest.body && typeof rest.body === 'string') {
        (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...rest,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
        return {} as T;
    }

    return JSON.parse(text) as T;
}

// ================================================
// Auth API
// ================================================

export async function login(username: string, password: string): Promise<Token> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(error.detail || 'Login failed');
    }

    return response.json();
}

export async function register(data: UserRegister): Promise<MessageOutput> {
    return apiRequest<MessageOutput>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
    });
}

export async function getCurrentUser(): Promise<User> {
    return apiRequest<User>('/auth/me');
}

export async function getUserStats(): Promise<UserStats> {
    return apiRequest<UserStats>('/auth/me/statistics');
}

// ================================================
// Datasets API
// ================================================

export async function getDatasets(page = 1, limit = 50): Promise<DatasetsOutput> {
    return apiRequest<DatasetsOutput>(`/datasets/?page=${page}&limit=${limit}`);
}

export async function getDataset(id: number): Promise<DatasetOutput> {
    return apiRequest<DatasetOutput>(`/datasets/${id}`);
}

export async function createDataset(
    data: DatasetCreate,
    onProgress?: (progress: number) => void
): Promise<DatasetOutput> {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('labels', data.labels);
        formData.append('file', data.file);

        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
            }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (err) {
                    reject(new Error('Failed to parse response'));
                }
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.detail || `HTTP ${xhr.status}`));
                } catch {
                    reject(new Error(`Upload failed: HTTP ${xhr.status}`));
                }
            }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
        });

        // Open connection and set headers
        xhr.open('POST', `${API_BASE_URL}/datasets/`);

        const token = getToken();
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        // Send request
        xhr.send(formData);
    });
}

export async function deleteDataset(id: number): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(`/datasets/${id}`, {
        method: 'DELETE',
    });
}

export async function downloadDataset(id: number): Promise<void> {
    const token = getToken();
    const headers: HeadersInit = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/datasets/${id}/download`, {
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Download failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename=(.+)/);
    const filename = filenameMatch ? filenameMatch[1] : `dataset_${id}.csv`;

    // Create blob and trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

export async function getDatasetStats(datasetId: number): Promise<DatasetStats> {
    return apiRequest<DatasetStats>(`/datasets/${datasetId}/statistics`);
}

// ================================================
// Records API
// ================================================

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
        params.append('patient_id', patientId);
    }
    if (text) {
        params.append('text', text);
    }
    if (reviewed !== undefined) {
        params.append('reviewed', reviewed.toString());
    }

    return apiRequest<RecordsOutput>(
        `/datasets/${datasetId}/records?${params.toString()}`
    );
}

export async function getRecord(
    datasetId: number,
    recordId: number
): Promise<RecordOutput> {
    return apiRequest<RecordOutput>(`/datasets/${datasetId}/records/${recordId}`);
}

export async function markRecordReviewed(
    datasetId: number,
    recordId: number,
    reviewed = true
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(
        `/datasets/${datasetId}/records/${recordId}/review?reviewed=${reviewed}`,
        { method: 'PUT' }
    );
}

// ================================================
// Source Terms API
// ================================================

export async function getRecordSourceTerms(
    datasetId: number,
    recordId: number
): Promise<SourceTermsOutput> {
    return apiRequest<SourceTermsOutput>(
        `/datasets/${datasetId}/records/${recordId}/source-terms`
    );
}

export async function createSourceTerm(
    datasetId: number,
    recordId: number,
    term: SourceTermCreate
): Promise<SourceTermOutput> {
    return apiRequest<SourceTermOutput>(
        `/datasets/${datasetId}/records/${recordId}/source-terms`,
        {
            method: 'POST',
            body: JSON.stringify(term),
        }
    );
}

export async function deleteSourceTerm(termId: number): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(`/source-terms/${termId}`, {
        method: 'DELETE',
    });
}

// ================================================
// Bioner Extraction API
// ================================================

export async function extractRecordTerms(
    datasetId: number,
    recordId: number,
    labels: string[]
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(
        `/bioner/${datasetId}/records/${recordId}/extract`,
        {
            method: 'POST',
            body: JSON.stringify({ labels }),
        }
    );
}

export async function extractDatasetTerms(
    datasetId: number,
    labels: string[]
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(
        `/bioner/${datasetId}/records/extract`,
        {
            method: 'POST',
            body: JSON.stringify({ labels }),
        }
    );
}

// ================================================
// Vocabularies API
// ================================================

export async function getVocabularies(page = 1, limit = 50): Promise<VocabulariesOutput> {
    return apiRequest<VocabulariesOutput>(`/vocabularies/?page=${page}&limit=${limit}`);
}

export async function getVocabulary(id: number): Promise<VocabularyOutput> {
    return apiRequest<VocabularyOutput>(`/vocabularies/${id}`);
}

export async function createVocabulary(
    data: VocabularyCreate,
    onProgress?: (progress: number) => void
): Promise<VocabularyOutput> {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('version', data.version);
        formData.append('file', data.file);

        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
            }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (err) {
                    reject(new Error('Failed to parse response'));
                }
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.detail || `HTTP ${xhr.status}`));
                } catch {
                    reject(new Error(`Upload failed: HTTP ${xhr.status}`));
                }
            }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
        });

        // Open connection and set headers
        xhr.open('POST', `${API_BASE_URL}/vocabularies/`);

        const token = getToken();
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        // Send request
        xhr.send(formData);
    });
}

export async function deleteVocabulary(id: number): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(`/vocabularies/${id}`, {
        method: 'DELETE',
    });
}

export async function downloadVocabulary(id: number): Promise<void> {
    const token = getToken();
    const headers: HeadersInit = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/vocabularies/${id}/download`, {
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Download failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename=(.+)/);
    const filename = filenameMatch ? filenameMatch[1] : `vocabulary_${id}.csv`;

    // Create blob and trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// ================================================
// Clustering API
// ================================================

export async function getClusters(
    datasetId: number,
    label?: string
): Promise<ClustersOutput> {
    const params = label ? `?label=${encodeURIComponent(label)}` : '';
    return apiRequest<ClustersOutput>(`/datasets/${datasetId}/clusters${params}`);
}

export async function rebuildClusters(
    datasetId: number,
    label: string
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(
        `/datasets/${datasetId}/clusters/create?label=${encodeURIComponent(label)}`,
        { method: 'POST' }
    );
}

export async function createCluster(
    datasetId: number,
    data: ClusterCreateRequest
): Promise<ClusterData> {
    return apiRequest<ClusterData>(`/datasets/${datasetId}/clusters`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function assignTermToCluster(
    termId: number,
    clusterId: number
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(
        `/source-terms/${termId}/map-cluster/${clusterId}`,
        { method: 'POST' }
    );
}

export async function unassignTermFromCluster(
    termId: number
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(`/source-terms/${termId}/unmap-cluster`, {
        method: 'POST',
    });
}

export async function renameCluster(
    clusterId: number,
    title: string
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(
        `/clusters/${clusterId}?title=${encodeURIComponent(title)}`,
        { method: 'PUT' }
    );
}

export async function mergeClusters(
    datasetId: number,
    data: ClusterMergeRequest
): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(`/datasets/${datasetId}/clusters/merge`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function deleteCluster(clusterId: number): Promise<MessageOutput> {
    return apiRequest<MessageOutput>(`/clusters/${clusterId}`, {
        method: 'DELETE',
    });
}

