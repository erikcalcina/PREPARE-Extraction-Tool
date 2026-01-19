import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Layout from 'components/Layout';
import { usePageTitle } from 'hooks/usePageTitle';
import type {
    ClusterMapping,
    Vocabulary,
    ConceptSearchResult,
    ConceptHierarchy,
    AutoMapRequest,
} from 'types';
import * as api from 'api';
import ConceptDetailModal from './ConceptDetailModal';
import styles from './styles.module.css';

// ================================================
// Helper functions
// ================================================

function getLabelColorClass(label: string): string {
    const labelMap: Record<string, string> = {
        'Condition': 'condition',
        'Medication': 'medication',
        'Lab Test': 'labtest',
        'Procedure': 'procedure',
        'Body Part': 'bodypart',
    };
    return labelMap[label] || 'default';
}

function getStatusColorClass(status: string): string {
    const statusMap: Record<string, string> = {
        'unmapped': 'unmapped',
        'pending': 'pending',
        'approved': 'approved',
        'rejected': 'rejected',
    };
    return statusMap[status] || 'unmapped';
}

// ================================================
// Main Component
// ================================================

export default function DatasetMapping() {
    const { datasetId } = useParams<{ datasetId: string }>();
    const navigate = useNavigate();

    const [datasetName, setDatasetName] = useState<string>('');
    const [mappings, setMappings] = useState<ClusterMapping[]>([]);
    const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
    const [selectedMapping, setSelectedMapping] = useState<ClusterMapping | null>(null);
    const [searchResults, setSearchResults] = useState<ConceptSearchResult[]>([]);
    const [selectedVocabularies, setSelectedVocabularies] = useState<number[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<string>('');
    const [labels, setLabels] = useState<string[]>([]);
    const [domainFilter, setDomainFilter] = useState<string>('');
    const [conceptClassFilter, setConceptClassFilter] = useState<string>('');
    const [standardOnly, setStandardOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [useSourceTerm, setUseSourceTerm] = useState(true);
    const [comment, setComment] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [isMapping, setIsMapping] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedConcept, setSelectedConcept] = useState<ConceptSearchResult | null>(null);
    const [showConceptModal, setShowConceptModal] = useState(false);

    usePageTitle(datasetName ? `Concept Mapping - ${datasetName}` : 'Concept Mapping');

    // Fetch dataset info
    useEffect(() => {
        const fetchDataset = async () => {
            if (!datasetId) return;
            try {
                const data = await api.getDataset(parseInt(datasetId));
                setDatasetName(data.dataset.name);
                setLabels(data.dataset.labels);
                if (data.dataset.labels.length > 0) {
                    setSelectedLabel(data.dataset.labels[0]);
                }
            } catch (err) {
                console.error('Failed to fetch dataset:', err);
            }
        };
        fetchDataset();
    }, [datasetId]);

    // Fetch vocabularies
    useEffect(() => {
        const fetchVocabularies = async () => {
            try {
                const data = await api.getVocabularies(1, 100);
                setVocabularies(data.vocabularies);
                // Auto-select all vocabularies
                setSelectedVocabularies(data.vocabularies.map(v => v.id));
            } catch (err) {
                console.error('Failed to fetch vocabularies:', err);
            }
        };
        fetchVocabularies();
    }, []);

    // Fetch mappings
    const fetchMappings = useCallback(async () => {
        if (!datasetId) return;

        try {
            setIsLoading(true);
            setError(null);
            const data = await api.getDatasetMappings(
                parseInt(datasetId),
                selectedLabel || undefined
            );
            setMappings(data.mappings);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load mappings');
        } finally {
            setIsLoading(false);
        }
    }, [datasetId, selectedLabel]);

    useEffect(() => {
        fetchMappings();
    }, [fetchMappings]);

    // Auto-search when cluster is selected
    useEffect(() => {
        if (selectedMapping && selectedVocabularies.length > 0) {
            handleAutoSearch();
        }
    }, [selectedMapping?.cluster_id]);

    // Handle auto-search
    const handleAutoSearch = async () => {
        if (!selectedMapping || !datasetId || selectedVocabularies.length === 0) return;

        try {
            setIsSearching(true);
            const request: AutoMapRequest = {
                vocabulary_ids: selectedVocabularies,
                use_cluster_terms: true,
                domain_id: domainFilter || undefined,
                concept_class_id: conceptClassFilter || undefined,
                standard_concept: standardOnly ? 'S' : undefined,
            };

            const results = await api.autoMapCluster(
                parseInt(datasetId),
                selectedMapping.cluster_id,
                request
            );

            setSearchResults(results.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    // Handle manual search
    const handleManualSearch = async () => {
        if (!searchQuery || selectedVocabularies.length === 0) return;

        try {
            setIsSearching(true);
            const results = await api.searchConcepts({
                query: searchQuery,
                vocabulary_ids: selectedVocabularies,
                domain_id: domainFilter || undefined,
                concept_class_id: conceptClassFilter || undefined,
                standard_concept: standardOnly ? 'S' : undefined,
                limit: 10,
            });

            setSearchResults(results.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    // Handle map cluster to concept
    const handleMapConcept = async (conceptId: number, status: string = 'pending') => {
        if (!selectedMapping || !datasetId) return;

        try {
            setIsMapping(true);
            await api.mapClusterToConcept(
                parseInt(datasetId),
                selectedMapping.cluster_id,
                { concept_id: conceptId, status }
            );
            await fetchMappings();

            // Update selected mapping
            const updated = mappings.find(m => m.cluster_id === selectedMapping.cluster_id);
            if (updated) {
                setSelectedMapping(updated);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Mapping failed');
        } finally {
            setIsMapping(false);
        }
    };

    // Handle delete mapping
    const handleDeleteMapping = async () => {
        if (!selectedMapping || !datasetId || !selectedMapping.concept_id) return;

        if (!confirm('Are you sure you want to remove this mapping?')) return;

        try {
            await api.deleteClusterMapping(parseInt(datasetId), selectedMapping.cluster_id);
            await fetchMappings();

            // Update selected mapping
            const updated = mappings.find(m => m.cluster_id === selectedMapping.cluster_id);
            if (updated) {
                setSelectedMapping(updated);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete mapping');
        }
    };

    // Handle auto-map all
    const handleAutoMapAll = async () => {
        if (!datasetId || selectedVocabularies.length === 0) return;

        const unmappedCount = mappings.filter(m => m.status === 'unmapped').length;
        if (!confirm(`Auto-map all ${unmappedCount} unmapped clusters? This may take a while.`)) {
            return;
        }

        try {
            setIsLoading(true);
            const response = await api.autoMapAllClusters(parseInt(datasetId), {
                vocabulary_ids: selectedVocabularies,
                label: selectedLabel || undefined,
                use_cluster_terms: true,
            });

            alert(`Auto-mapping complete!\nMapped: ${response.mapped_count}\nFailed: ${response.failed_count}`);
            await fetchMappings();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Auto-mapping failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle export
    const handleExport = async () => {
        if (!datasetId) return;

        try {
            await api.exportMappings(parseInt(datasetId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed');
        }
    };

    // Handle import
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !datasetId) return;

        try {
            setIsLoading(true);
            const result = await api.importMappings(parseInt(datasetId), file);
            alert(result.message);
            await fetchMappings();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Filter mappings - no filter needed in table view
    const filteredMappings = useMemo(() => {
        return mappings;
    }, [mappings]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = mappings.length;
        const mapped = mappings.filter(m => m.status !== 'unmapped').length;
        const unmapped = total - mapped;
        const approved = mappings.filter(m => m.status === 'approved').length;
        const mappedPercentage = total > 0 ? Math.round((mapped / total) * 100) : 0;

        return { total, mapped, unmapped, approved, mappedPercentage };
    }, [mappings]);

    if (!datasetId) {
        return <Layout><div>Invalid dataset ID</div></Layout>;
    }

    return (
        <Layout>
            <div className={styles.page}>
                {/* Header with Navigation */}
                <div className={styles.header}>
                    <button
                        className={styles.navButton}
                        onClick={() => navigate(`/datasets/${datasetId}/clusters`)}
                        title="Back to Clustering"
                    >
                        ← Back to Clustering
                    </button>

                    <div className={styles.pageInfo}>
                        <h1 className={styles.pageTitle}>Concept Mapping</h1>
                        <button
                            className={styles.datasetLink}
                            onClick={() => navigate(`/datasets/${datasetId}`)}
                            title="Go to Dataset Overview"
                        >
                            Dataset: {datasetName || 'Loading...'}
                        </button>
                    </div>

                    <button
                        className={styles.navButton}
                        onClick={() => navigate(`/datasets/${datasetId}`)}
                        title="Go to Overview"
                    >
                        Overview →
                    </button>
                </div>

                {/* Toolbar */}
                <div className={styles.toolbarSection}>
                    <div className={styles.toolbar}>
                        <select
                            value={selectedLabel}
                            onChange={(e) => setSelectedLabel(e.target.value)}
                            className={styles.labelFilter}
                        >
                            <option value="">All Categories</option>
                            {labels.map(label => (
                                <option key={label} value={label}>{label}</option>
                            ))}
                        </select>

                        <select
                            multiple
                            value={selectedVocabularies.map(String)}
                            onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions).map(o => parseInt(o.value));
                                setSelectedVocabularies(selected);
                            }}
                            className={styles.vocabularyFilter}
                        >
                            {vocabularies.map(vocab => (
                                <option key={vocab.id} value={vocab.id}>
                                    {vocab.name} ({vocab.version})
                                </option>
                            ))}
                        </select>

                        <input
                            type="text"
                            placeholder="Domain filter..."
                            value={domainFilter}
                            onChange={(e) => setDomainFilter(e.target.value)}
                            className={styles.filterInput}
                        />

                        <input
                            type="text"
                            placeholder="Concept class filter..."
                            value={conceptClassFilter}
                            onChange={(e) => setConceptClassFilter(e.target.value)}
                            className={styles.filterInput}
                        />

                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={standardOnly}
                                onChange={(e) => setStandardOnly(e.target.checked)}
                            />
                            <span>Standard concepts only</span>
                        </label>

                        <button
                            onClick={handleAutoMapAll}
                            disabled={isLoading || selectedVocabularies.length === 0}
                            className={styles.btnAutoMapAll}
                        >
                            Auto-Map All Unmapped
                        </button>

                        <button onClick={handleExport} className={styles.btnExport}>
                            Export Mappings
                        </button>

                        <label className={styles.btnImport}>
                            Import Mappings
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleImport}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    {/* Stats */}
                    <div className={styles.stats}>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.total}</div>
                            <div className={styles.statLabel}>Total Clusters</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.mapped} ({stats.mappedPercentage}%)</div>
                            <div className={styles.statLabel}>Mapped</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.unmapped}</div>
                            <div className={styles.statLabel}>Unmapped</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.approved}</div>
                            <div className={styles.statLabel}>Approved</div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className={styles.error}>
                        {error}
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* Main Content - Usagi Style Layout */}
                <div className={styles.mainLayout}>
                    {/* Top: Mappings Table */}
                    <div className={styles.mappingsTableSection}>
                        <table className={styles.mappingsTable}>
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Source code</th>
                                    <th>Source term</th>
                                    <th>Frequency</th>
                                    <th>CodeText</th>
                                    <th>Match score</th>
                                    <th>Concept ID</th>
                                    <th>Concept name</th>
                                    <th>Domain</th>
                                    <th>Concept class</th>
                                    <th>Vocabulary</th>
                                    <th>Concept code</th>
                                    <th>Standard con...</th>
                                    <th>Parents</th>
                                    <th>Children</th>
                                    <th>Comment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={16} className={styles.loading}>Loading...</td>
                                    </tr>
                                ) : filteredMappings.length === 0 ? (
                                    <tr>
                                        <td colSpan={16} className={styles.emptyCell}>No clusters found</td>
                                    </tr>
                                ) : (
                                    filteredMappings.map(mapping => (
                                        <tr
                                            key={mapping.cluster_id}
                                            className={selectedMapping?.cluster_id === mapping.cluster_id ? styles.selectedRow : ''}
                                            onClick={() => setSelectedMapping(mapping)}
                                        >
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles[getStatusColorClass(mapping.status)]}`}>
                                                    {mapping.status.charAt(0).toUpperCase()}
                                                </span>
                                            </td>
                                            <td>{mapping.cluster_id}</td>
                                            <td>{mapping.cluster_title}</td>
                                            <td>{mapping.cluster_total_occurrences}</td>
                                            <td>
                                                <span className={`${styles.labelBadge} ${styles[getLabelColorClass(mapping.cluster_label)]}`}>
                                                    {mapping.cluster_label}
                                                </span>
                                            </td>
                                            <td>{mapping.concept_id ? (mapping.status === 'approved' ? '1.00' : '0.75') : ''}</td>
                                            <td>{mapping.concept_id || ''}</td>
                                            <td>{mapping.concept_name || ''}</td>
                                            <td>{mapping.concept_domain || ''}</td>
                                            <td>{mapping.concept_class || ''}</td>
                                            <td>{mapping.vocabulary_name || ''}</td>
                                            <td>{mapping.concept_code || ''}</td>
                                            <td>{mapping.concept_id ? 'S' : ''}</td>
                                            <td>{mapping.concept_id ? '—' : ''}</td>
                                            <td>{mapping.concept_id ? '—' : ''}</td>
                                            <td></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Middle & Bottom: Two Column Layout */}
                    <div className={styles.middleSection}>
                        {/* Left Column: Source Code + Target Concepts */}
                        <div className={styles.leftColumn}>
                            <div className={styles.sourceCodeSection}>
                                <h3 className={styles.sectionHeader}>Source code</h3>
                                {selectedMapping ? (
                                    <table className={styles.infoTable}>
                                        <tbody>
                                            <tr>
                                                <td className={styles.infoLabel}>Source code</td>
                                                <td>{selectedMapping.cluster_id}</td>
                                            </tr>
                                            <tr>
                                                <td className={styles.infoLabel}>Source term</td>
                                                <td>{selectedMapping.cluster_title}</td>
                                            </tr>
                                            <tr>
                                                <td className={styles.infoLabel}>Frequency</td>
                                                <td>{selectedMapping.cluster_total_occurrences}</td>
                                            </tr>
                                            <tr>
                                                <td className={styles.infoLabel}>CodeText</td>
                                                <td>
                                                    <span className={`${styles.labelBadge} ${styles[getLabelColorClass(selectedMapping.cluster_label)]}`}>
                                                        {selectedMapping.cluster_label}
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className={styles.noSelection}>Select a row to view details</div>
                                )}
                            </div>

                            <div className={styles.targetConceptsSection}>
                                <h3 className={styles.sectionHeader}>Target concepts</h3>
                                {selectedMapping?.concept_id ? (
                                    <>
                                        <div className={styles.targetTableWrapper}>
                                            <table className={styles.targetTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Concept ID</th>
                                                        <th>Concept name</th>
                                                        <th>Domain</th>
                                                        <th>Concept class</th>
                                                        <th>Vocabulary</th>
                                                        <th>Concept Code</th>
                                                        <th>Standard concept</th>
                                                        <th>Parents</th>
                                                        <th>Children</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td>{selectedMapping.concept_id}</td>
                                                        <td>{selectedMapping.concept_name}</td>
                                                        <td>{selectedMapping.concept_domain}</td>
                                                        <td>{selectedMapping.concept_class}</td>
                                                        <td>{selectedMapping.vocabulary_name}</td>
                                                        <td>{selectedMapping.concept_code}</td>
                                                        <td>S</td>
                                                        <td>—</td>
                                                        <td>—</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <button
                                            onClick={handleDeleteMapping}
                                            className={styles.btnRemoveConcept}
                                        >
                                            Remove concept
                                        </button>
                                    </>
                                ) : (
                                    <div className={styles.noTarget}>No target concepts</div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Search + Results */}
                        <div className={styles.rightColumn}>
                            <div className={styles.searchSection}>
                                <h3 className={styles.sectionHeader}>Search</h3>

                                <div className={styles.querySection}>
                                    <div className={styles.queryLabel}>Query</div>
                                    <label className={styles.radioOption}>
                                        <input
                                            type="radio"
                                            checked={useSourceTerm}
                                            onChange={() => setUseSourceTerm(true)}
                                        />
                                        <span>Use source term as query</span>
                                    </label>
                                    <label className={styles.radioOption}>
                                        <input
                                            type="radio"
                                            checked={!useSourceTerm}
                                            onChange={() => setUseSourceTerm(false)}
                                        />
                                        <span>Query:</span>
                                    </label>
                                    {!useSourceTerm && (
                                        <input
                                            type="text"
                                            className={styles.queryInput}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    )}
                                </div>

                                <div className={styles.filtersSection}>
                                    <div className={styles.queryLabel}>Filters</div>
                                    <label className={styles.checkboxOption}>
                                        <input type="checkbox" />
                                        <span>Filter by user selected concepts</span>
                                    </label>
                                    <label className={styles.checkboxOption}>
                                        <input
                                            type="checkbox"
                                            checked={standardOnly}
                                            onChange={(e) => setStandardOnly(e.target.checked)}
                                        />
                                        <span>Filter standard concepts</span>
                                    </label>
                                    <label className={styles.checkboxOption}>
                                        <input type="checkbox" />
                                        <span>Include source terms</span>
                                    </label>

                                    <div className={styles.filterDropdown}>
                                        <label>Filter by concept class:</label>
                                        <select className={styles.filterSelect}>
                                            <option>2-dig nonbill code</option>
                                        </select>
                                    </div>

                                    <div className={styles.filterDropdown}>
                                        <label>Filter by vocabulary:</label>
                                        <select
                                            className={styles.filterSelect}
                                            value={selectedVocabularies[0] || ''}
                                            onChange={(e) => setSelectedVocabularies(e.target.value ? [parseInt(e.target.value)] : [])}
                                        >
                                            {vocabularies.map(vocab => (
                                                <option key={vocab.id} value={vocab.id}>
                                                    {vocab.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className={styles.filterDropdown}>
                                        <label>Filter by domain:</label>
                                        <select
                                            className={styles.filterSelect}
                                            value={domainFilter}
                                            onChange={(e) => setDomainFilter(e.target.value)}
                                        >
                                            <option value="">All</option>
                                            <option value="Condition">Condition</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.resultsSection}>
                                <h3 className={styles.sectionHeader}>Results</h3>
                                <div className={styles.resultsTableWrapper}>
                                    <table className={styles.resultsTable}>
                                        <thead>
                                            <tr>
                                                <th>Score</th>
                                                <th>Term</th>
                                                <th>Concept ID</th>
                                                <th>Concept name</th>
                                                <th>Domain</th>
                                                <th>Concept class</th>
                                                <th>Vocabulary</th>
                                                <th>Concept code</th>
                                                <th>Standard concept</th>
                                                <th>Parents</th>
                                                <th>Children</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {!selectedMapping ? (
                                                <tr>
                                                    <td colSpan={11} className={styles.emptyCell}>Select a row to search</td>
                                                </tr>
                                            ) : isSearching ? (
                                                <tr>
                                                    <td colSpan={11} className={styles.loading}>Searching...</td>
                                                </tr>
                                            ) : searchResults.length === 0 ? (
                                                <tr>
                                                    <td colSpan={11} className={styles.emptyCell}>No results found</td>
                                                </tr>
                                            ) : (
                                                searchResults.map((result, idx) => (
                                                    <tr
                                                        key={`${result.concept.id}-${idx}`}
                                                        onClick={() => handleMapConcept(result.concept.id)}
                                                        className={styles.resultRow}
                                                    >
                                                        <td className={styles.scoreCell}>
                                                            {(result.score).toFixed(2)}
                                                        </td>
                                                        <td>{result.concept.vocab_term_name}</td>
                                                        <td>{result.concept.id}</td>
                                                        <td>{result.concept.vocab_term_name}</td>
                                                        <td>{result.concept.domain_id}</td>
                                                        <td>{result.concept.concept_class_id}</td>
                                                        <td>{result.vocabulary_name}</td>
                                                        <td>{result.concept.concept_code || ''}</td>
                                                        <td>{result.concept.standard_concept || 'S'}</td>
                                                        <td>—</td>
                                                        <td>—</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className={styles.resultsActions}>
                                    <button
                                        onClick={() => {
                                            if (selectedMapping && searchResults.length > 0) {
                                                handleMapConcept(searchResults[0].concept.id);
                                            }
                                        }}
                                        disabled={!selectedMapping || searchResults.length === 0}
                                        className={styles.btnReplaceConcept}
                                    >
                                        Replace concept
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (selectedMapping && searchResults.length > 0) {
                                                handleMapConcept(searchResults[0].concept.id);
                                            }
                                        }}
                                        disabled={!selectedMapping || searchResults.length === 0}
                                        className={styles.btnAddConcept}
                                    >
                                        Add concept
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar with Comment and Approve */}
                <div className={styles.bottomBar}>
                    <div className={styles.commentContainer}>
                        <label>Comment:</label>
                        <input
                            type="text"
                            className={styles.commentInput}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>
                    <div className={styles.approvalInfo}>
                        Approved / total: {stats.approved} / {stats.total}  {stats.mappedPercentage}% of total frequency
                    </div>
                    <button
                        onClick={() => {
                            if (selectedMapping?.concept_id) {
                                handleMapConcept(selectedMapping.concept_id, 'approved');
                            }
                        }}
                        disabled={!selectedMapping?.concept_id}
                        className={styles.btnApprove}
                    >
                        Approve
                    </button>
                </div>

                {/* Concept Detail Modal */}
                {showConceptModal && selectedConcept && (
                    <ConceptDetailModal
                        conceptId={selectedConcept.concept.id}
                        onClose={() => setShowConceptModal(false)}
                        onMap={() => {
                            handleMapConcept(selectedConcept.concept.id);
                            setShowConceptModal(false);
                        }}
                    />
                )}
            </div>
        </Layout>
    );
}
