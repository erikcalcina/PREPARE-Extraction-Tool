// ================================================
// User types
// ================================================

export interface User {
    id: number;
    username: string;
    disabled: boolean;
    created_at: string;
    last_login: string | null;
}

export interface UserRegister {
    username: string;
    password: string;
}

export interface Token {
    access_token: string;
    token_type: string;
}

export interface UserStats {
    dataset_count: number;
    vocabulary_count: number;
}

// ================================================
// Pagination types
// ================================================

export interface PaginationMetadata {
    total: number;
    limit: number;
    offset: number;
    page: number;
    total_pages: number;
}

// ================================================
// Dataset types
// ================================================

export interface Dataset {
    id: number;
    name: string;
    uploaded: string;
    last_modified: string;
    labels: string[];
    record_count: number;
}

export interface DatasetCreate {
    name: string;
    labels?: string[];
    records?: RecordCreate[];
}

export interface DatasetOutput {
    dataset: Dataset;
}

export interface DatasetsOutput {
    datasets: Dataset[];
    pagination: PaginationMetadata;
}

// ================================================
// Record types
// ================================================

export interface Record {
    id: number;
    text: string;
    uploaded: string;
    dataset_id: number;
    reviewed: boolean;
    source_term_count: number;
}

export interface RecordCreate {
    text: string;
}

export interface RecordOutput {
    record: Record;
}

export interface RecordsOutput {
    records: Record[];
    pagination: PaginationMetadata;
}

// ================================================
// Source Term types
// ================================================

export interface SourceTerm {
    id: number;
    value: string;
    label: string;
    start_position: number | null;
    end_position: number | null;
    record_id: number;
}

export interface SourceTermCreate {
    value: string;
    label: string;
    start_position?: number;
    end_position?: number;
}

export interface SourceTermOutput {
    source_term: SourceTerm;
}

export interface SourceTermsOutput {
    source_terms: SourceTerm[];
    pagination: PaginationMetadata;
}

// ================================================
// Dataset Stats types
// ================================================

export interface DatasetStats {
    total_records: number;
    processed_count: number;
    pending_review_count: number;
    extracted_terms_count: number;
}

// ================================================
// Vocabulary types
// ================================================

export interface Vocabulary {
    id: number;
    name: string;
    uploaded: string;
    version: string;
    concept_count: number;
}

export interface VocabularyCreate {
    name: string;
    version: string;
    concepts?: ConceptCreate[];
}

export interface VocabularyOutput {
    vocabulary: Vocabulary;
}

export interface VocabulariesOutput {
    vocabularies: Vocabulary[];
    pagination: PaginationMetadata;
}

// ================================================
// Concept types
// ================================================

export interface Concept {
    id: number;
    vocab_term_id: string;
    vocab_term_name: string;
    vocabulary_id: number;
}

export interface ConceptCreate {
    vocab_term_id: string;
    vocab_term_name: string;
}

export interface ConceptOutput {
    concept: Concept;
}

export interface ConceptsOutput {
    concepts: Concept[];
    pagination: PaginationMetadata;
}

// ================================================
// Generic response types
// ================================================

export interface MessageOutput {
    message: string;
}

export interface ApiError {
    detail: string;
}

