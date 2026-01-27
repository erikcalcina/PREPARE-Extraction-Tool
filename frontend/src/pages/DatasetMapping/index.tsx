import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import Layout from "components/Layout";
import { usePageTitle } from "hooks/usePageTitle";
import { useToast } from "hooks/useToast";
import type { ClusterMapping, Vocabulary, ConceptSearchResult, AutoMapRequest } from "types";
import * as api from "api";
import ConceptDetailModal from "./ConceptDetailModal";
import { ToastContainer } from "components/Toast/ToastContainer";
import ConfirmDialog from "components/ConfirmDialog";
import SourceTermsTable from "./SourceTermsTable";
import SearchFiltersPanel from "./SearchFiltersPanel";
import TargetConceptsList from "./TargetConceptsList";
import styles from "./styles.module.css";

export default function DatasetMapping() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();

  const [datasetName, setDatasetName] = useState<string>("");
  const [mappings, setMappings] = useState<ClusterMapping[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<ClusterMapping | null>(null);
  const [searchResults, setSearchResults] = useState<ConceptSearchResult[]>([]);
  const [selectedVocabularies, setSelectedVocabularies] = useState<number[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [labels, setLabels] = useState<string[]>([]);
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [conceptClassFilter, setConceptClassFilter] = useState<string>("");
  const [standardOnly, setStandardOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [useSourceTerm, setUseSourceTerm] = useState(true);
  const [comment, setComment] = useState("");
  const [includeSourceTerms, setIncludeSourceTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedConcept, setSelectedConcept] = useState<ConceptSearchResult | null>(null);
  const [showConceptModal, setShowConceptModal] = useState(false);
  // Silence unused warning - will be used for concept detail modal
  void setSelectedConcept;

  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info";
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  usePageTitle(datasetName ? `Concept Mapping - ${datasetName}` : "Concept Mapping");

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
        console.error("Failed to fetch dataset:", err);
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
        setSelectedVocabularies(data.vocabularies.map((v) => v.id));
      } catch (err) {
        console.error("Failed to fetch vocabularies:", err);
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
      const data = await api.getDatasetMappings(parseInt(datasetId), selectedLabel || undefined);
      setMappings(data.mappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mappings");
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
        standard_concept: standardOnly ? "S" : undefined,
      };

      const results = await api.autoMapCluster(parseInt(datasetId), selectedMapping.cluster_id, request);
      setSearchResults(results.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
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
        standard_concept: standardOnly ? "S" : undefined,
        limit: 10,
      });

      setSearchResults(results.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search (triggered by Enter key or search button)
  const handleSearch = () => {
    if (useSourceTerm) {
      handleAutoSearch();
    } else {
      handleManualSearch();
    }
  };

  // Handle map cluster to concept
  const handleMapConcept = async (conceptId: number, status: "pending" | "approved" | "rejected" = "pending") => {
    if (!selectedMapping || !datasetId) return;

    try {
      setIsMapping(true);
      await api.mapClusterToConcept(parseInt(datasetId), selectedMapping.cluster_id, { concept_id: conceptId, status });
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
  };

  // Handle delete mapping
  const handleDeleteMapping = () => {
    if (!selectedMapping || !datasetId || !selectedMapping.concept_id) return;

    setConfirmDialog({
      isOpen: true,
      title: "Remove Mapping",
      message: "Are you sure you want to remove this mapping?",
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
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
      },
    });
  };

  // Handle auto-map all
  const handleAutoMapAll = () => {
    if (!datasetId || selectedVocabularies.length === 0) return;

    const unmappedCount = mappings.filter((m) => m.status === "unmapped").length;

    setConfirmDialog({
      isOpen: true,
      title: "Auto-Map All Unmapped",
      message: `Auto-map all ${unmappedCount} unmapped clusters? This may take a while.`,
      variant: "warning",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
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
      },
    });
  };

  // Handle export
  const handleExport = async () => {
    if (!datasetId) return;

    try {
      await api.exportMappings(parseInt(datasetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  // Handle import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = mappings.length;
    const mapped = mappings.filter((m) => m.status !== "unmapped").length;
    const unmapped = total - mapped;
    const approved = mappings.filter((m) => m.status === "approved").length;
    const mappedPercentage = total > 0 ? Math.round((mapped / total) * 100) : 0;

    return { total, mapped, unmapped, approved, mappedPercentage };
  }, [mappings]);

  if (!datasetId) {
    return (
      <Layout>
        <div>Invalid dataset ID</div>
      </Layout>
    );
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
              Dataset: {datasetName || "Loading..."}
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

        {/* Stats Section with Actions */}
        <div className={styles.statsSection}>
          <div className={styles.statsContainer}>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.terms}`}>{stats.total}</div>
              <div className={styles.statLabel}>Total</div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.mapped}`}>
                {stats.mapped} ({stats.mappedPercentage}%)
              </div>
              <div className={styles.statLabel}>Mapped</div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.approved}`}>{stats.approved}</div>
              <div className={styles.statLabel}>Approved</div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.unmapped}`}>{stats.unmapped}</div>
              <div className={styles.statLabel}>Unmapped</div>
            </div>
          </div>

          <div className={styles.toolbarButtons}>
            <button
              onClick={handleAutoMapAll}
              disabled={isLoading || selectedVocabularies.length === 0}
              className={styles.btnAutoMapAll}
            >
              Auto-Map All
            </button>

            <button onClick={handleExport} className={styles.btnExport}>
              Export
            </button>

            <label className={styles.btnImport}>
              Import
              <input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Main Content */}
        <div className={styles.mainLayout}>
          {/* Source Terms Table */}
          <SourceTermsTable
            mappings={mappings}
            selectedMapping={selectedMapping}
            onSelectMapping={setSelectedMapping}
            isLoading={isLoading}
            labels={labels}
            selectedLabel={selectedLabel}
            onLabelChange={setSelectedLabel}
          />

          {/* Selection Bar */}
          <div className={styles.selectionBar}>
            <div className={styles.selectionInfo}>
              <span className={styles.selectionLabel}>Selected:</span>
              {selectedMapping ? (
                <>
                  <span className={styles.selectionValue}>{selectedMapping.cluster_title}</span>
                  <span className={styles.selectionArrow}>→</span>
                  {selectedMapping.concept_name ? (
                    <span className={styles.selectionTarget}>{selectedMapping.concept_name}</span>
                  ) : (
                    <span className={styles.noSelection}>No concept mapped</span>
                  )}
                </>
              ) : (
                <span className={styles.noSelection}>No source term selected</span>
              )}
            </div>
            <div className={styles.selectionActions}>
              {selectedMapping?.concept_id && (
                <button onClick={handleDeleteMapping} className={styles.btnRemoveConcept}>
                  Remove
                </button>
              )}
              <button
                onClick={() => {
                  if (selectedMapping?.concept_id) {
                    handleMapConcept(selectedMapping.concept_id, "approved");
                  }
                }}
                disabled={!selectedMapping?.concept_id || isMapping}
                className={styles.btnApprove}
              >
                Accept
              </button>
            </div>
          </div>

          {/* Comment Row */}
          <div className={styles.commentRow}>
            <label className={styles.commentLabel} htmlFor="mapping-comment">
              Comment:
            </label>
            <input
              id="mapping-comment"
              type="text"
              className={styles.commentInputField}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment for the selected mapping"
            />
          </div>

          {/* Bottom Section: Target Concepts List + Search Filters */}
          <div className={styles.bottomSection}>
            <TargetConceptsList
              selectedMapping={selectedMapping}
              searchResults={searchResults}
              isSearching={isSearching}
              onMapConcept={handleMapConcept}
            />

            <SearchFiltersPanel
              useSourceTerm={useSourceTerm}
              onUseSourceTermChange={setUseSourceTerm}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearch={handleSearch}
              standardOnly={standardOnly}
              onStandardOnlyChange={setStandardOnly}
              includeSourceTerms={includeSourceTerms}
              onIncludeSourceTermsChange={setIncludeSourceTerms}
              vocabularies={vocabularies}
              selectedVocabularies={selectedVocabularies}
              onSelectedVocabulariesChange={setSelectedVocabularies}
              domainFilter={domainFilter}
              onDomainFilterChange={setDomainFilter}
              conceptClassFilter={conceptClassFilter}
              onConceptClassFilterChange={setConceptClassFilter}
            />
          </div>
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

        {/* Toast notifications */}
        <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />

        {/* Confirm dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </Layout>
  );
}
