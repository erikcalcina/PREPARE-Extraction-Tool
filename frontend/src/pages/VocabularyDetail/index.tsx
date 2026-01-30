import { useParams, useNavigate } from "react-router-dom";
import Layout from "components/Layout";
import Table from "components/Table";
import Button from "components/Button";
import { Select } from "components/Select";
import Pagination from "components/Pagination";
import { useVocabularyConcepts } from '@/hooks/useVocabularyConcepts';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Concept } from "types";
import styles from "./styles.module.css";

// ================================================
// Helper functions
// ================================================

function formatDate(dateString: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStandardConcept(value: string | null): string {
  if (!value) return "-";
  if (value === "S") return "Standard";
  if (value === "C") return "Classification";
  return value;
}

// ================================================
// Stat Card Component
// ================================================

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// ================================================
// Main Component
// ================================================

const VocabularyDetail = () => {
  const { vocabularyId } = useParams<{ vocabularyId: string }>();
  const navigate = useNavigate();
  const parsedVocabularyId = vocabularyId ? parseInt(vocabularyId, 10) : 0;

  const {
    vocabulary,
    concepts,
    allConcepts,
    pagination,
    isLoading,
    isLoadingConcepts,
    error,
    currentPage,
    filters,
    filterOptions,
    updateFilter,
    clearFilters,
    downloadVocabulary,
    goToPage,
  } = useVocabularyConcepts(parsedVocabularyId);

  usePageTitle(vocabulary?.name ? `${vocabulary.name} - Vocabulary` : "Vocabulary Detail");

  // Compute unique domains from all loaded concepts
  const uniqueDomains = new Set(allConcepts.map((c) => c.domain_id).filter(Boolean));

  const columns = [
    {
      key: "vocab_term_id",
      header: "Concept ID",
      width: "12%",
    },
    {
      key: "vocab_term_name",
      header: "Name",
      width: "25%",
    },
    {
      key: "domain_id",
      header: "Domain",
      width: "12%",
    },
    {
      key: "concept_class_id",
      header: "Class",
      width: "12%",
    },
    {
      key: "standard_concept",
      header: "Standard",
      width: "10%",
      render: (item: Concept) => formatStandardConcept(item.standard_concept),
    },
    {
      key: "concept_code",
      header: "Code",
      width: "10%",
      render: (item: Concept) => item.concept_code || "-",
    },
    {
      key: "valid_start_date",
      header: "Valid From",
      width: "10%",
      render: (item: Concept) => formatDate(item.valid_start_date),
    },
    {
      key: "invalid_reason",
      header: "Invalid",
      width: "9%",
      render: (item: Concept) => item.invalid_reason || "-",
    },
  ];

  if (!parsedVocabularyId) {
    return (
      <Layout>
        <div className={styles.page}>
          <div className={styles.error}>Invalid vocabulary ID</div>
        </div>
      </Layout>
    );
  }

  const hasActiveFilters = filters.searchQuery || filters.domain || filters.conceptClass || filters.standardConcept;

  return (
    <Layout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <Button variant="outline" onClick={() => navigate("/vocabularies")}>
            ← Back to Vocabularies
          </Button>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>{vocabulary?.name || "Loading..."}</h1>
            {vocabulary?.version && <span className={styles.version}>v{vocabulary.version}</span>}
          </div>
          <Button label="Download" onClick={downloadVocabulary} />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Stats Section */}
        {vocabulary && (
          <div className={styles.statsSection}>
            <StatCard label="Total Concepts" value={vocabulary.concept_count} />
            <StatCard label="Unique Domains" value={uniqueDomains.size} />
            <StatCard label="Uploaded" value={formatDate(vocabulary.uploaded)} />
          </div>
        )}

        {/* Filters */}
        <div className={styles.filtersSection}>
          <div className={styles.filterRow}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, ID, or code..."
              value={filters.searchQuery}
              onChange={(e) => updateFilter("searchQuery", e.target.value)}
            />

            <Select
              options={filterOptions.domains.map((d) => ({ value: d, label: d }))}
              value={filters.domain}
              onValueChange={(v) => updateFilter("domain", v)}
              placeholder="All Domains"
              fullWidth={false}
              className={styles.filterSelect}
            />

            <Select
              options={filterOptions.conceptClasses.map((c) => ({ value: c, label: c }))}
              value={filters.conceptClass}
              onValueChange={(v) => updateFilter("conceptClass", v)}
              placeholder="All Classes"
              fullWidth={false}
              className={styles.filterSelect}
            />

            <Select
              options={filterOptions.standardConcepts.map((sc) => ({
                value: sc,
                label: formatStandardConcept(sc),
              }))}
              value={filters.standardConcept}
              onValueChange={(v) => updateFilter("standardConcept", v)}
              placeholder="All Types"
              fullWidth={false}
              className={styles.filterSelect}
            />

            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className={styles.filterInfo}>
              Showing {concepts.length} of {allConcepts.length} concepts on this page
            </div>
          )}
        </div>

        {/* Concepts Table */}
        {isLoading ? (
          <div className={styles.loading}>Loading vocabulary...</div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              {isLoadingConcepts && <div className={styles.loadingOverlay}>Loading concepts...</div>}
              <Table
                columns={columns}
                data={concepts}
                keyExtractor={(item) => item.id}
                emptyMessage={hasActiveFilters ? "No concepts match the filters" : "No concepts in this vocabulary"}
              />
            </div>

            {pagination && (
              <Pagination currentPage={currentPage} totalPages={pagination.total_pages} onPageChange={goToPage} />
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default VocabularyDetail;
