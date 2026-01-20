import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClusterData } from "types";
import * as api from "api";
import styles from "./styles.module.css";

interface ClusterDetailModalProps {
  cluster: ClusterData;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ClusterDetailModal({ cluster, onClose, onRefresh }: ClusterDetailModalProps) {
  const navigate = useNavigate();
  const [isChangingMainTerm, setIsChangingMainTerm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangeMainTerm = async (newTitle: string) => {
    try {
      await api.renameCluster(cluster.id, newTitle);
      // Update parent state without full refresh
      onRefresh();
      setIsChangingMainTerm(false);
      onClose(); // Close modal to see the change
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change main term");
    }
  };

  const handleRemoveTerm = async (termId: number) => {
    if (!confirm("Remove this term from the cluster?")) return;

    try {
      await api.unassignTermFromCluster(termId);
      // Refresh parent state - backend handles bulk removal of all terms with same value
      // and auto-deletes empty clusters. Parent will update selectedCluster or close modal.
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove term");
    }
  };

  const handleViewRecords = (recordIds: number[]) => {
    // Navigate to dataset records page with filter
    navigate(`/datasets/${cluster.dataset_id}?records=${recordIds.join(",")}`);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalBadges}>
              <span className={styles.clusterBadge}>CMC-{cluster.id}</span>
              <span className={`${styles.labelBadge} ${styles[cluster.label.toLowerCase().replace(" ", "")]}`}>
                {cluster.label}
              </span>
              <span className={styles.statusBadge}>Mapped</span>
            </div>
            <h2>{cluster.title}</h2>
            <p className={styles.modalSubtitle}>Suggested main term based on frequency</p>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className={styles.modalBody}>
          <div className={styles.modalStatsGrid}>
            <div className={styles.statSection}>
              <h3>Cluster Statistics</h3>
              <div className={styles.statRow}>
                <span>Total Terms:</span>
                <strong>{cluster.total_terms}</strong>
              </div>
              <div className={styles.statRow}>
                <span>Total Occurrences:</span>
                <strong>{cluster.total_occurrences}</strong>
              </div>
              <div className={styles.statRow}>
                <span>Unique Records:</span>
                <strong>{cluster.unique_records}</strong>
              </div>
            </div>

            <div className={styles.statSection}>
              <h3>Mapping Info</h3>
              <div className={styles.statRow}>
                <span>Vocabulary:</span>
                <strong>SNOMED CT</strong>
              </div>
              <div className={styles.statRow}>
                <span>Concept ID:</span>
                <strong>-</strong>
              </div>
              <div className={styles.statRow}>
                <span>Similarity:</span>
                <strong>-</strong>
              </div>
            </div>
          </div>

          <div className={styles.termsSection}>
            <div className={styles.termsSectionHeader}>
              <h3>Clustered Terms</h3>
              <button onClick={() => setIsChangingMainTerm(true)} className={styles.btnChangeMainTerm}>
                Change Main Term
              </button>
            </div>

            <table className={styles.termsTable}>
              <thead>
                <tr>
                  <th>Term Variant</th>
                  <th>Frequency</th>
                  <th>Source Records</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cluster.terms
                  .sort((a, b) => b.frequency - a.frequency)
                  .map((term) => (
                    <tr key={term.term_id}>
                      <td>
                        <div className={styles.termCell}>
                          {term.text === cluster.title && <span className={styles.mainBadge}>main</span>}
                          {isChangingMainTerm ? (
                            <button onClick={() => handleChangeMainTerm(term.text)} className={styles.btnSelectTerm}>
                              {term.text}
                            </button>
                          ) : (
                            <span>{term.text}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.frequencyCell}>
                          <span>{term.frequency}</span>
                          <div className={styles.frequencyBar}>
                            <div
                              className={styles.frequencyBarFill}
                              style={{
                                width: `${Math.min(100, (term.frequency / cluster.total_occurrences) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <button onClick={() => handleViewRecords(term.record_ids)} className={styles.btnViewRecords}>
                          {term.n_records} records
                        </button>
                      </td>
                      <td>
                        <button onClick={() => handleRemoveTerm(term.term_id)} className={styles.btnRemove}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {isChangingMainTerm && (
            <div className={styles.changeMainTermHint}>
              Click on a term above to set it as the main term
              <button onClick={() => setIsChangingMainTerm(false)} className={styles.btnCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnClose}>
            Close
          </button>
          <button className={styles.btnMerge}>Merge with Another</button>
          <button className={styles.btnSplit} disabled>
            Split Cluster
          </button>
        </div>
      </div>
    </div>
  );
}
