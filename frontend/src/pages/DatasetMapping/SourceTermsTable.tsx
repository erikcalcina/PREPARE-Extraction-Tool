import React, { useState, useMemo, useEffect } from "react";
import type { ClusterMapping } from "types";
import LoadingSpinner from "components/LoadingSpinner";
import { Select } from "components/Select";
import Pagination from "components/Pagination";
import styles from "./styles.module.css";

function getLabelColorClass(label: string): string {
  const labelMap: Record<string, string> = {
    Condition: "condition",
    Medication: "medication",
    "Lab Test": "labtest",
    Procedure: "procedure",
    "Body Part": "bodypart",
  };
  return labelMap[label] || "default";
}

function getStatusColorClass(status: string): string {
  const statusMap: Record<string, string> = {
    unmapped: "unmapped",
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
  };
  return statusMap[status] || "unmapped";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface SourceTermsTableProps {
  mappings: ClusterMapping[];
  selectedMapping: ClusterMapping | null;
  onSelectMapping: (mapping: ClusterMapping) => void;
  isLoading: boolean;
  labels: string[];
  selectedLabel: string;
  onLabelChange: (label: string) => void;
}

export const SourceTermsTable: React.FC<SourceTermsTableProps> = ({
  mappings,
  selectedMapping,
  onSelectMapping,
  isLoading,
  labels,
  selectedLabel,
  onLabelChange,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset pagination when mappings or label changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
  }, [mappings.length, selectedLabel]);

  // Filter mappings by search query
  const filteredMappings = useMemo(() => {
    if (!searchQuery.trim()) return mappings;

    const query = searchQuery.toLowerCase();
    return mappings.filter(
      (m) =>
        m.cluster_title.toLowerCase().includes(query) ||
        m.cluster_id.toString().includes(query) ||
        (m.concept_name && m.concept_name.toLowerCase().includes(query)) ||
        (m.concept_id && m.concept_id.toString().includes(query))
    );
  }, [mappings, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredMappings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMappings = filteredMappings.slice(startIndex, endIndex);

  // Reset to page 1 when search or page size changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className={styles.sourceTermsSection}>
      {/* Search and Controls Header */}
      <div className={styles.tableHeader}>
        <div className={styles.tableHeaderLeft}>
          <Select
            options={labels.map((l) => ({ value: l, label: l }))}
            value={selectedLabel}
            onValueChange={onLabelChange}
            placeholder="All Categories"
            aria-label="Filter by category"
            fullWidth={false}
            className={styles.labelDropdownSelect}
          />
          <div className={styles.tableSearch}>
            <input
              type="text"
              placeholder="Search source terms..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={styles.tableSearchInput}
              aria-label="Search source terms"
            />
            {searchQuery && (
              <button
                className={styles.clearSearchBtn}
                onClick={() => handleSearchChange("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className={styles.tableInfo}>
          Showing {filteredMappings.length === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, filteredMappings.length)} of{" "}
          {filteredMappings.length}
          {searchQuery && ` (filtered from ${mappings.length})`}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.sourceTermsTable} role="grid" aria-label="Source terms">
          <thead>
            <tr>
              <th>Status</th>
              <th>Source Code</th>
              <th>Source Term</th>
              <th>Freq</th>
              <th>Label</th>
              <th>Concept ID</th>
              <th>Concept Name</th>
              <th>Domain</th>
              <th>Vocabulary</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className={styles.loading}>
                  <LoadingSpinner size="small" text="Loading source terms..." />
                </td>
              </tr>
            ) : paginatedMappings.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.emptyCell}>
                  {searchQuery ? "No matching source terms found" : "No source terms found"}
                </td>
              </tr>
            ) : (
              paginatedMappings.map((mapping) => (
                <tr
                  key={mapping.cluster_id}
                  className={selectedMapping?.cluster_id === mapping.cluster_id ? styles.selectedRow : ""}
                  onClick={() => onSelectMapping(mapping)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectMapping(mapping);
                    }
                  }}
                >
                  <td>
                    <span
                      className={`${styles.statusBadge} ${styles[getStatusColorClass(mapping.status)]}`}
                      role="status"
                      aria-label={`Status: ${mapping.status}`}
                    >
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
                  <td>{mapping.concept_id || "—"}</td>
                  <td>{mapping.concept_name || "—"}</td>
                  <td>{mapping.concept_domain || "—"}</td>
                  <td>{mapping.vocabulary_name || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!isLoading && filteredMappings.length > 0 && (
        <div className={styles.paginationBar}>
          <div className={styles.pageSizeSelector}>
            <label htmlFor="page-size">Rows per page:</label>
            <Select
              id="page-size"
              options={PAGE_SIZE_OPTIONS.map((s) => ({ value: String(s), label: String(s) }))}
              value={String(pageSize)}
              onValueChange={(v) => handlePageSizeChange(Number(v))}
              size="small"
              fullWidth={false}
              className={styles.pageSizeSelect}
            />
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
        </div>
      )}
    </div>
  );
};

export default SourceTermsTable;
