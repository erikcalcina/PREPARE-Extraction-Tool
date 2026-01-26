import { useParams, useNavigate } from "react-router-dom";
import Layout from "components/Layout";
import Table from "components/Table";
import Button from "components/Button";
import { useVocabularyConcepts } from "hooks/useVocabularyConcepts";
import { usePageTitle } from "hooks/usePageTitle";
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
// Pagination Component
// ================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("...");
      }
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push("...");
      }
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className={styles.pagination}>
      <button className={styles.pageButton} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        Previous
      </button>
      <div className={styles.pageNumbers}>
        {getPageNumbers().map((page, index) =>
          typeof page === "number" ? (
            <button
              key={index}
              className={`${styles.pageNumber} ${currentPage === page ? styles.active : ""}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ) : (
            <span key={index} className={styles.ellipsis}>
              {page}
            </span>
          )
        )}
      </div>
      <button
        className={styles.pageButton}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
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
          <button className={styles.backButton} onClick={() => navigate("/vocabularies")}>
            ← Back to Vocabularies
          </button>
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

            <select
              className={styles.filterSelect}
              value={filters.domain}
              onChange={(e) => updateFilter("domain", e.target.value)}
            >
              <option value="">All Domains</option>
              {filterOptions.domains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filters.conceptClass}
              onChange={(e) => updateFilter("conceptClass", e.target.value)}
            >
              <option value="">All Classes</option>
              {filterOptions.conceptClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filters.standardConcept}
              onChange={(e) => updateFilter("standardConcept", e.target.value)}
            >
              <option value="">All Types</option>
              {filterOptions.standardConcepts.map((sc) => (
                <option key={sc} value={sc}>
                  {formatStandardConcept(sc)}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button className={styles.clearButton} onClick={clearFilters}>
                Clear Filters
              </button>
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
