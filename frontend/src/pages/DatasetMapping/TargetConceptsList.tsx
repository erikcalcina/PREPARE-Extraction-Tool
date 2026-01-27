import React from "react";
import type { ClusterMapping, ConceptSearchResult } from "types";
import LoadingSpinner from "components/LoadingSpinner";
import styles from "./styles.module.css";

interface TargetConceptsListProps {
  selectedMapping: ClusterMapping | null;
  searchResults: ConceptSearchResult[];
  isSearching: boolean;
  onMapConcept: (conceptId: number) => void;
}

export const TargetConceptsList: React.FC<TargetConceptsListProps> = ({
  selectedMapping,
  searchResults,
  isSearching,
  onMapConcept,
}) => {
  return (
    <div className={styles.targetConceptsListPanel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Target Concepts</h3>
        {searchResults.length > 0 && <span>{searchResults.length} results</span>}
      </div>
      <div className={styles.panelContent}>
        <table className={styles.conceptResultsTable} role="grid" aria-label="Target concepts">
          <thead>
            <tr>
              <th>Score</th>
              <th>Concept ID</th>
              <th>Concept Name</th>
              <th>Domain</th>
              <th>Vocabulary</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!selectedMapping ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  Select a source term to search for concepts
                </td>
              </tr>
            ) : isSearching ? (
              <tr>
                <td colSpan={6} className={styles.loading}>
                  <LoadingSpinner size="small" text="Searching..." />
                </td>
              </tr>
            ) : searchResults.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No matching concepts found
                </td>
              </tr>
            ) : (
              searchResults.map((result, idx) => (
                <tr
                  key={`${result.concept.id}-${idx}`}
                  className={styles.conceptResultRow}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onMapConcept(result.concept.id);
                    }
                  }}
                >
                  <td className={styles.scoreCell}>{result.score.toFixed(2)}</td>
                  <td>{result.concept.id}</td>
                  <td>{result.concept.vocab_term_name}</td>
                  <td>{result.concept.domain_id}</td>
                  <td>{result.vocabulary_name}</td>
                  <td>
                    <div className={styles.conceptActions}>
                      <button
                        className={styles.btnMapConcept}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMapConcept(result.concept.id);
                        }}
                      >
                        Map
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TargetConceptsList;
