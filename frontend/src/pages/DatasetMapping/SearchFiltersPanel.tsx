import React from "react";
import type { Vocabulary } from "types";
import styles from "./styles.module.css";

interface SearchFiltersPanelProps {
  // Query mode
  useSourceTerm: boolean;
  onUseSourceTermChange: (value: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;

  // Filters
  standardOnly: boolean;
  onStandardOnlyChange: (value: boolean) => void;
  includeSourceTerms: boolean;
  onIncludeSourceTermsChange: (value: boolean) => void;

  // Vocabulary and domain filters
  vocabularies: Vocabulary[];
  selectedVocabularies: number[];
  onSelectedVocabulariesChange: (ids: number[]) => void;
  domainFilter: string;
  onDomainFilterChange: (value: string) => void;
  conceptClassFilter: string;
  onConceptClassFilterChange: (value: string) => void;
}

export const SearchFiltersPanel: React.FC<SearchFiltersPanelProps> = ({
  useSourceTerm,
  onUseSourceTermChange,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  standardOnly,
  onStandardOnlyChange,
  includeSourceTerms,
  onIncludeSourceTermsChange,
  vocabularies,
  selectedVocabularies,
  onSelectedVocabulariesChange,
  domainFilter,
  onDomainFilterChange,
  conceptClassFilter,
  onConceptClassFilterChange,
}) => {
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className={styles.searchFiltersPanel}>
      {/* Query Mode */}
      <div className={styles.filterSection}>
        <div className={styles.filterTitle}>Query Mode</div>
        <label className={styles.filterOption}>
          <input type="radio" name="queryMode" checked={useSourceTerm} onChange={() => onUseSourceTermChange(true)} />
          <span>Use source term</span>
        </label>
        <label className={styles.filterOption}>
          <input type="radio" name="queryMode" checked={!useSourceTerm} onChange={() => onUseSourceTermChange(false)} />
          <span>Custom query</span>
        </label>
        {!useSourceTerm && (
          <input
            type="text"
            className={styles.filterInputField}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Enter search term..."
            aria-label="Custom search query"
          />
        )}
      </div>

      {/* Concept Filters */}
      <div className={styles.filterSection}>
        <div className={styles.filterTitle}>Filters</div>
        <label className={styles.filterOption}>
          <input type="checkbox" checked={standardOnly} onChange={(e) => onStandardOnlyChange(e.target.checked)} />
          <span>Standard concepts only</span>
        </label>
        <label className={styles.filterOption}>
          <input
            type="checkbox"
            checked={includeSourceTerms}
            onChange={(e) => onIncludeSourceTermsChange(e.target.checked)}
          />
          <span>Include source terms</span>
        </label>
      </div>

      {/* Vocabulary Filter */}
      <div className={styles.filterSection}>
        <div className={styles.filterTitle}>Vocabulary</div>
        <select
          className={styles.filterSelect}
          multiple
          value={selectedVocabularies.map(String)}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => parseInt(o.value));
            onSelectedVocabulariesChange(selected);
          }}
          style={{ minHeight: "80px" }}
        >
          {vocabularies.map((vocab) => (
            <option key={vocab.id} value={vocab.id}>
              {vocab.name} ({vocab.version})
            </option>
          ))}
        </select>
      </div>

      {/* Domain Filter */}
      <div className={styles.filterSection}>
        <div className={styles.filterTitle}>Domain</div>
        <input
          type="text"
          className={styles.filterInputField}
          value={domainFilter}
          onChange={(e) => onDomainFilterChange(e.target.value)}
          placeholder="e.g., Condition, Drug..."
        />
      </div>

      {/* Concept Class Filter */}
      <div className={styles.filterSection}>
        <div className={styles.filterTitle}>Concept Class</div>
        <input
          type="text"
          className={styles.filterInputField}
          value={conceptClassFilter}
          onChange={(e) => onConceptClassFilterChange(e.target.value)}
          placeholder="e.g., Clinical Finding..."
        />
      </div>
    </div>
  );
};

export default SearchFiltersPanel;
