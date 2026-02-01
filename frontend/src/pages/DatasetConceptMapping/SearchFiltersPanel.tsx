import React from "react";

import { Select } from "@components/Select";

import type { Vocabulary } from "@/types";

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

  // Vocabulary filter
  vocabularies: Vocabulary[];
  selectedVocabularies: number[];
  onSelectedVocabulariesChange: (ids: number[]) => void;
  vocabularyFilterEnabled: boolean;
  onVocabularyFilterEnabledChange: (enabled: boolean) => void;

  // Domain filter
  domainFilter: string;
  onDomainFilterChange: (value: string) => void;
  domainFilterEnabled: boolean;
  onDomainFilterEnabledChange: (enabled: boolean) => void;
  domains: string[];

  // Concept class filter
  conceptClassFilter: string;
  onConceptClassFilterChange: (value: string) => void;
  conceptClassFilterEnabled: boolean;
  onConceptClassFilterEnabledChange: (enabled: boolean) => void;
  conceptClasses: string[];
}

const SearchFiltersPanel: React.FC<SearchFiltersPanelProps> = ({
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
  vocabularyFilterEnabled,
  onVocabularyFilterEnabledChange,
  domainFilter,
  onDomainFilterChange,
  domainFilterEnabled,
  onDomainFilterEnabledChange,
  domains,
  conceptClassFilter,
  onConceptClassFilterChange,
  conceptClassFilterEnabled,
  onConceptClassFilterEnabledChange,
  conceptClasses,
}) => {
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  // Convert vocabularies to Select options
  const vocabularyOptions = vocabularies.map((vocab) => ({
    value: vocab.id.toString(),
    label: vocab.name,
  }));

  // Convert domains to Select options
  const domainOptions = domains.map((domain) => ({
    value: domain,
    label: domain,
  }));

  // Convert concept classes to Select options
  const conceptClassOptions = conceptClasses.map((cc) => ({
    value: cc,
    label: cc,
  }));

  return (
    <div className={styles["search-filters-panel"]}>
      {/* Query Mode */}
      <div className={styles["search-filters-panel__section"]}>
        <div className={styles["search-filters-panel__title"]}>Query Mode</div>
        <label className={styles["search-filters-panel__option"]}>
          <input type="radio" name="queryMode" checked={useSourceTerm} onChange={() => onUseSourceTermChange(true)} />
          <span>Use source term</span>
        </label>
        <label className={styles["search-filters-panel__option"]}>
          <input type="radio" name="queryMode" checked={!useSourceTerm} onChange={() => onUseSourceTermChange(false)} />
          <span>Custom query</span>
        </label>
        {!useSourceTerm && (
          <input
            type="text"
            className={styles["search-filters-panel__input"]}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Enter search term..."
            aria-label="Custom search query"
          />
        )}
      </div>

      {/* Concept Filters */}
      <div className={styles["search-filters-panel__section"]}>
        <div className={styles["search-filters-panel__title"]}>Filters</div>
        <label className={styles["search-filters-panel__option"]}>
          <input type="checkbox" checked={standardOnly} onChange={(e) => onStandardOnlyChange(e.target.checked)} />
          <span>Standard concepts only</span>
        </label>
        <label className={styles["search-filters-panel__option"]}>
          <input
            type="checkbox"
            checked={includeSourceTerms}
            onChange={(e) => onIncludeSourceTermsChange(e.target.checked)}
          />
          <span>Include source terms</span>
        </label>
      </div>

      {/* Vocabulary Filter - Multi-select */}
      <div className={styles["search-filters-panel__section"]}>
        <Select
          label="Vocabulary"
          enabled={vocabularyFilterEnabled}
          onEnabledChange={onVocabularyFilterEnabledChange}
          options={vocabularyOptions}
          placeholder="Select vocabularies..."
          multiSelect={true}
          values={selectedVocabularies.map(String)}
          onValuesChange={(vals) => onSelectedVocabulariesChange(vals.map((v) => parseInt(v)))}
        />
      </div>

      {/* Domain Filter - Single-select */}
      <div className={styles["search-filters-panel__section"]}>
        <Select
          label="Domain"
          enabled={domainFilterEnabled}
          onEnabledChange={onDomainFilterEnabledChange}
          options={domainOptions}
          placeholder="Select domain..."
          multiSelect={false}
          value={domainFilter}
          onValueChange={onDomainFilterChange}
        />
      </div>

      {/* Concept Class Filter - Single-select */}
      <div className={styles["search-filters-panel__section"]}>
        <Select
          label="Concept Class"
          enabled={conceptClassFilterEnabled}
          onEnabledChange={onConceptClassFilterEnabledChange}
          options={conceptClassOptions}
          placeholder="Select concept class..."
          multiSelect={false}
          value={conceptClassFilter}
          onValueChange={onConceptClassFilterChange}
        />
      </div>
    </div>
  );
};

export default SearchFiltersPanel;
