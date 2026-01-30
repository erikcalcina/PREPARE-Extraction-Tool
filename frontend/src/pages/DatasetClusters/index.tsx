import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { DndContext, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import Layout from "components/Layout";
import Button from "components/Button";
import { Select } from "components/Select";
import { usePageTitle } from '@/hooks/usePageTitle';
import type { ClusterData, ClusteredTerm } from "types";
import * as api from "api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripVertical,
  faPencil,
  faCheck,
  faXmark,
  faCircleQuestion,
  faArrowUp,
} from "@fortawesome/free-solid-svg-icons";
import StatCard from "components/StatCard";
import styles from "./styles.module.css";

// ================================================
// Helper functions
// ================================================

function getLabelColorClass(label: string, customColor?: string): string {
  if (customColor) {
    return "custom-label";
  }
  const labelMap: Record<string, string> = {
    Condition: "condition",
    Medication: "medication",
    "Lab Test": "labtest",
    Procedure: "procedure",
    "Body Part": "bodypart",
  };
  return labelMap[label] || "default";
}

// ================================================
// Draggable Term Component
// ================================================

interface DraggableTermProps {
  term: ClusteredTerm;
  clusterId: number | null;
  onRemove?: (termId: number) => void;
}

function DraggableTerm({ term, clusterId, onRemove }: DraggableTermProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `term-${term.term_id}`,
    data: { termId: term.term_id, sourceClusterId: clusterId, term },
  });

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(term.term_id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`${styles.termItem} ${isDragging ? styles.termItemDragging : ""} ${onRemove ? "" : styles.termItemNoRemoveBtn}`}
    >
      <div className={styles.termDragHandle} {...listeners} {...attributes}>
        <FontAwesomeIcon icon={faGripVertical} />
      </div>
      <span className={styles.termText}>{term.text}</span>
      <div className={styles.termStats}>
        <span className={styles.frequency}>{term.frequency}</span>
        <div className={styles.frequencyBar}>
          <div
            className={styles.frequencyBarFill}
            style={{ width: `${Math.min(100, (term.frequency / 20) * 100)}%` }}
          />
        </div>
      </div>
      {onRemove && (
        <button className={styles.termRemoveBtn} onClick={handleRemove} title="Remove from cluster">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
    </div>
  );
}

// ================================================
// Term Overlay Component (for DragOverlay)
// ================================================

interface TermOverlayProps {
  term: ClusteredTerm;
}

function TermOverlay({ term }: TermOverlayProps) {
  return (
    <div className={`${styles.termItem} ${styles.termItemOverlay} ${styles.termItemNoRemoveBtn}`}>
      <div className={styles.termDragHandle}>
        <FontAwesomeIcon icon={faGripVertical} />
      </div>
      <span className={styles.termText}>{term.text}</span>
      <div className={styles.termStats}>
        <span className={styles.frequency}>{term.frequency}</span>
        <div className={styles.frequencyBar}>
          <div
            className={styles.frequencyBarFill}
            style={{ width: `${Math.min(100, (term.frequency / 20) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ================================================
// Droppable Unclustered Area Component
// ================================================

interface DroppableUnclusteredAreaProps {
  terms: ClusteredTerm[];
}

function DroppableUnclusteredArea({ terms }: DroppableUnclusteredAreaProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unclustered",
    data: { clusterId: null },
  });

  return (
    <div className={styles.unclusteredSection}>
      <h2>Unclustered Terms ({terms.length})</h2>
      <div ref={setNodeRef} className={`${styles.unclusteredArea} ${isOver ? styles.unclusteredDragOver : ""}`}>
        {terms.map((term) => (
          <DraggableTerm key={term.term_id} term={term} clusterId={null} />
        ))}
      </div>
    </div>
  );
}

// ================================================
// Cluster Overlay Component (for DragOverlay when dragging clusters)
// ================================================

interface ClusterOverlayProps {
  cluster: ClusterData;
}

function ClusterOverlay({ cluster }: ClusterOverlayProps) {
  return (
    <div className={`${styles.clusterCard} ${styles.clusterOverlay}`}>
      <div className={styles.clusterCardHeader}>
        <div className={styles.dragHandle}>
          <FontAwesomeIcon icon={faGripVertical} />
        </div>
        <div className={styles.clusterName}>
          <div className={styles.clusterNameDisplay}>
            <h3>{cluster.title}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================
// Cluster Card Component
// ================================================

interface ClusterCardProps {
  cluster: ClusterData;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  onRemoveTerm: (termId: number) => void;
  isDraggingCluster: boolean;
}

function ClusterCard({ cluster, onRename, onDelete, onRemoveTerm, isDraggingCluster }: ClusterCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(cluster.title);

  // Make cluster draggable
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-cluster-${cluster.id}`,
    data: { type: "cluster", clusterId: cluster.id, cluster },
  });

  // Make cluster droppable (for both terms and other clusters)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `cluster-${cluster.id}`,
    data: { clusterId: cluster.id },
  });

  // Combine refs for both drag and drop
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== cluster.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  // Inline style for custom color
  const labelStyle = cluster.label_color
    ? {
        backgroundColor: `${cluster.label_color}20`,
        color: cluster.label_color,
        border: `1px solid ${cluster.label_color}40`,
      }
    : {};

  return (
    <div
      ref={setNodeRef}
      className={`${styles.clusterCard} ${isOver && isDraggingCluster ? styles.clusterMergeTarget : ""} ${isOver && !isDraggingCluster ? styles.dragOver : ""} ${isDragging ? styles.clusterDragging : ""}`}
      data-cluster-id={cluster.id}
    >
      {/* Top Header Section */}
      <div className={styles.clusterCardHeader}>
        <div
          className={styles.dragHandle}
          {...dragListeners}
          {...dragAttributes}
          title="Drag to merge with another cluster"
        >
          <FontAwesomeIcon icon={faGripVertical} />
        </div>

        {/* Editable cluster name */}
        <div className={styles.clusterName}>
          {isEditing ? (
            <div className={styles.clusterNameEdit}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setEditTitle(cluster.title);
                    setIsEditing(false);
                  }
                }}
                autoFocus
                className={styles.titleInput}
              />
              <button onClick={handleRename} className={styles.btnEditAction} title="Save">
                <FontAwesomeIcon icon={faCheck} />
              </button>
              <button
                onClick={() => {
                  setEditTitle(cluster.title);
                  setIsEditing(false);
                }}
                className={`${styles.btnEditAction} ${styles.btnEditCancel}`}
                title="Cancel"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          ) : (
            <div className={styles.clusterNameDisplay}>
              <h3>{cluster.title}</h3>
              <button onClick={() => setIsEditing(true)} className={styles.btnEditName} title="Edit cluster name">
                <FontAwesomeIcon icon={faPencil} />
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className={styles.clusterStats}>
          <span title="Total terms">{cluster.total_terms} terms</span>
          <span title="Total occurrences">{cluster.total_occurrences} occurrences</span>
          <span title="Unique records">{cluster.unique_records} unique records</span>
        </div>

        {/* Label badge */}
        <span
          className={`${styles.labelBadge} ${styles[getLabelColorClass(cluster.label, cluster.label_color)]}`}
          style={labelStyle}
        >
          {cluster.label}
        </span>

        {/* Action buttons */}
        <div className={styles.headerActions}>
          <Button variant="outline" size="small" colorScheme="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* Bottom Terms Section */}
      <div className={styles.clusterCardBody}>
        <div className={styles.termsList}>
          {cluster.terms.map((term) => (
            <DraggableTerm key={term.term_id} term={term} clusterId={cluster.id} onRemove={onRemoveTerm} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ================================================
// Main Component
// ================================================

export default function DatasetClusters() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [unclusteredTerms, setUnclusteredTerms] = useState<ClusteredTerm[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoClustering, setIsAutoClustering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState<string>("");
  const [activeDragTerm, setActiveDragTerm] = useState<ClusteredTerm | null>(null);
  const [activeDragCluster, setActiveDragCluster] = useState<ClusterData | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  usePageTitle(datasetName ? `Term Clustering - ${datasetName}` : "Term Clustering");

  // Back-to-top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fetch dataset info
  useEffect(() => {
    const fetchDataset = async () => {
      if (!datasetId) return;
      try {
        const data = await api.getDataset(parseInt(datasetId));
        setDatasetName(data.dataset.name);
      } catch (err) {
        console.error("Failed to fetch dataset:", err);
      }
    };
    fetchDataset();
  }, [datasetId]);

  // Fetch labels first to initialize the filter
  useEffect(() => {
    const fetchLabels = async () => {
      if (!datasetId) return;
      try {
        // Fetch once to get labels, passing undefined gets all data including labels
        const data = await api.getClusters(parseInt(datasetId), undefined);
        setLabels(data.labels);
        // Set default label to first label
        if (data.labels.length > 0) {
          setSelectedLabel(data.labels[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load labels");
      }
    };
    fetchLabels();
  }, [datasetId]);

  // Fetch clusters when label is selected
  const fetchClusters = async (silent = false) => {
    if (!datasetId || !selectedLabel) return;

    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const data = await api.getClusters(parseInt(datasetId), selectedLabel);
      setClusters(data.clusters);
      setUnclusteredTerms(data.unclustered_terms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clusters");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, [datasetId, selectedLabel]);

  // Handle auto-clustering
  const handleAutoClustering = async () => {
    if (!datasetId || !selectedLabel) return;

    try {
      setIsAutoClustering(true);
      await api.rebuildClusters(parseInt(datasetId), selectedLabel);
      await fetchClusters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-clustering failed");
    } finally {
      setIsAutoClustering(false);
    }
  };

  // Helper function to recalculate cluster stats
  const recalculateClusterStats = (cluster: ClusterData): ClusterData => {
    const totalTerms = cluster.terms.length;
    const totalOccurrences = cluster.terms.reduce((sum, t) => sum + t.frequency, 0);
    const uniqueRecordIds = new Set(cluster.terms.flatMap((t) => t.record_ids));
    const uniqueRecords = uniqueRecordIds.size;

    return {
      ...cluster,
      total_terms: totalTerms,
      total_occurrences: totalOccurrences,
      unique_records: uniqueRecords,
    };
  };

  // Handle drag start (dnd-kit)
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dragType = active.data.current?.type;

    if (dragType === "cluster") {
      const cluster = active.data.current?.cluster as ClusterData | undefined;
      if (cluster) {
        setActiveDragCluster(cluster);
        setActiveDragTerm(null);
      }
    } else {
      const term = active.data.current?.term as ClusteredTerm | undefined;
      if (term) {
        setActiveDragTerm(term);
        setActiveDragCluster(null);
      }
    }
  };

  // Handle cluster merge
  const handleClusterMerge = (sourceClusterId: number, targetClusterId: number) => {
    const sourceCluster = clusters.find((c) => c.id === sourceClusterId);
    const targetCluster = clusters.find((c) => c.id === targetClusterId);

    if (!sourceCluster || !targetCluster) return;

    // Store original state for rollback
    const originalClusters = clusters;

    // Optimistic update: merge source terms into target, remove source cluster
    // Use a Map to merge terms by text (case-insensitive)
    const termMap = new Map<string, ClusteredTerm>();

    // Add target terms first
    for (const term of targetCluster.terms) {
      termMap.set(term.text.toLowerCase(), { ...term });
    }

    // Merge source terms
    for (const sourceTerm of sourceCluster.terms) {
      const key = sourceTerm.text.toLowerCase();
      const existing = termMap.get(key);
      if (existing) {
        // Merge: combine frequencies and record_ids
        const mergedRecordIds = [...new Set([...existing.record_ids, ...sourceTerm.record_ids])];
        termMap.set(key, {
          ...existing,
          frequency: existing.frequency + sourceTerm.frequency,
          record_ids: mergedRecordIds,
          n_records: mergedRecordIds.length,
        });
      } else {
        termMap.set(key, { ...sourceTerm });
      }
    }

    const mergedTerms = Array.from(termMap.values());

    const mergedCluster = recalculateClusterStats({
      ...targetCluster,
      terms: mergedTerms,
    });

    // Update state: replace target with merged, remove source
    setClusters((prev) =>
      prev.map((c) => (c.id === targetClusterId ? mergedCluster : c)).filter((c) => c.id !== sourceClusterId)
    );

    // API call in background
    api
      .mergeClusters(parseInt(datasetId!), {
        cluster_ids: [targetClusterId, sourceClusterId],
        new_title: targetCluster.title,
      })
      .then(() => {
        // Silently refresh to sync with backend (gets the new cluster ID)
        fetchClusters(true);
      })
      .catch((err) => {
        // Rollback on error
        setClusters(originalClusters);
        setError(err instanceof Error ? err.message : "Failed to merge clusters");
      });
  };

  // Handle drag end (dnd-kit)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const dragType = active.data.current?.type;

    // Reset drag states
    setActiveDragTerm(null);
    setActiveDragCluster(null);

    if (!over) return;

    // Handle cluster drag (merging)
    if (dragType === "cluster") {
      const sourceClusterId = active.data.current?.clusterId as number;
      const targetClusterId = over.data.current?.clusterId as number | undefined;

      // Only merge if dropping on a different cluster
      if (targetClusterId && targetClusterId !== sourceClusterId) {
        handleClusterMerge(sourceClusterId, targetClusterId);
      }
      return;
    }

    // Handle term drag (existing logic)
    const termId = active.data.current?.termId as number;
    const sourceClusterId = active.data.current?.sourceClusterId as number | null;
    const targetClusterId = over.data.current?.clusterId as number | null;

    // Don't do anything if dropping in same cluster
    if (sourceClusterId === targetClusterId) return;

    // Optimistic update
    const term = findTermById(termId);
    if (!term) return;

    // Store original state for rollback
    const originalClusters = clusters;
    const originalUnclustered = unclusteredTerms;

    // Check if source cluster will be empty after removing the term
    let sourceClusterWillBeEmpty = false;
    if (sourceClusterId !== null) {
      const sourceCluster = clusters.find((c) => c.id === sourceClusterId);
      sourceClusterWillBeEmpty = sourceCluster?.terms.length === 1;
    }

    // Remove from source (or delete source cluster if it becomes empty)
    if (sourceClusterId === null) {
      setUnclusteredTerms((prev) => prev.filter((t) => t.term_id !== termId));
    } else if (sourceClusterWillBeEmpty) {
      // Remove the entire cluster if it becomes empty
      setClusters((prev) => prev.filter((c) => c.id !== sourceClusterId));
    } else {
      setClusters((prev) =>
        prev.map((c) => {
          if (c.id === sourceClusterId) {
            const updated = {
              ...c,
              terms: c.terms.filter((t) => t.term_id !== termId),
            };
            return recalculateClusterStats(updated);
          }
          return c;
        })
      );
    }

    // Add to target (merge if same text exists in target cluster)
    if (targetClusterId === null) {
      // Check for duplicate in unclustered
      const existingUnclustered = unclusteredTerms.find(
        (t) => t.text.toLowerCase() === term.text.toLowerCase() && t.term_id !== termId
      );
      if (existingUnclustered) {
        // Merge: update existing term's stats
        setUnclusteredTerms((prev) =>
          prev.map((t) => {
            if (t.term_id === existingUnclustered.term_id) {
              return {
                ...t,
                frequency: t.frequency + term.frequency,
                n_records: new Set([...t.record_ids, ...term.record_ids]).size,
                record_ids: [...new Set([...t.record_ids, ...term.record_ids])],
              };
            }
            return t;
          })
        );
      } else {
        setUnclusteredTerms((prev) => [...prev, term]);
      }
    } else {
      setClusters((prev) =>
        prev.map((c) => {
          if (c.id === targetClusterId) {
            // Check if a term with the same text already exists in this cluster
            const existingTerm = c.terms.find(
              (t) => t.text.toLowerCase() === term.text.toLowerCase() && t.term_id !== termId
            );
            let updated: ClusterData;
            if (existingTerm) {
              // Merge: update existing term's frequency and record_ids
              updated = {
                ...c,
                terms: c.terms.map((t) => {
                  if (t.term_id === existingTerm.term_id) {
                    return {
                      ...t,
                      frequency: t.frequency + term.frequency,
                      n_records: new Set([...t.record_ids, ...term.record_ids]).size,
                      record_ids: [...new Set([...t.record_ids, ...term.record_ids])],
                    };
                  }
                  return t;
                }),
              };
            } else {
              // No duplicate, just add the term
              updated = {
                ...c,
                terms: [...c.terms, term],
              };
            }
            return recalculateClusterStats(updated);
          }
          return c;
        })
      );
    }

    // API calls in background
    const apiCalls: Promise<unknown>[] = [];

    if (targetClusterId === null) {
      apiCalls.push(api.unassignTermFromCluster(termId));
    } else {
      apiCalls.push(api.assignTermToCluster(termId, targetClusterId));
    }

    // Delete source cluster if it became empty
    // if (sourceClusterWillBeEmpty && sourceClusterId !== null) {
    //   apiCalls.push(api.deleteCluster(sourceClusterId));
    // }

    Promise.all(apiCalls).catch((err) => {
      // Rollback on error
      setClusters(originalClusters);
      setUnclusteredTerms(originalUnclustered);
      setError(err instanceof Error ? err.message : "Failed to move term");
    });
  };

  const findTermById = (termId: number): ClusteredTerm | undefined => {
    for (const cluster of clusters) {
      const term = cluster.terms.find((t) => t.term_id === termId);
      if (term) return term;
    }
    return unclusteredTerms.find((t) => t.term_id === termId);
  };

  // Handle cluster rename
  const handleRename = async (clusterId: number, newTitle: string) => {
    // Optimistic update
    const originalClusters = clusters;
    setClusters((prev) => prev.map((c) => (c.id === clusterId ? { ...c, title: newTitle } : c)));

    // Scroll to the renamed cluster after React re-renders with the new sort order
    setTimeout(() => {
      const element = document.querySelector(`[data-cluster-id="${clusterId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);

    try {
      await api.renameCluster(clusterId, newTitle);
    } catch (err) {
      // Rollback on error
      setClusters(originalClusters);
      setError(err instanceof Error ? err.message : "Failed to rename cluster");
    }
  };

  // Handle cluster delete
  const handleDelete = async (clusterId: number) => {
    if (!confirm("Are you sure you want to delete this cluster? Terms will become unclustered.")) {
      return;
    }

    const originalClusters = clusters;
    const originalUnclustered = unclusteredTerms;

    // Find cluster and move its terms to unclustered
    const clusterToDelete = clusters.find((c) => c.id === clusterId);
    if (!clusterToDelete) return;

    // Optimistic update
    setClusters((prev) => prev.filter((c) => c.id !== clusterId));
    setUnclusteredTerms((prev) => [...prev, ...clusterToDelete.terms]);

    try {
      await api.deleteCluster(clusterId);
    } catch (err) {
      // Rollback on error
      setClusters(originalClusters);
      setUnclusteredTerms(originalUnclustered);
      setError(err instanceof Error ? err.message : "Failed to delete cluster");
    }
  };

  // Handle term removal from cluster
  const handleRemoveTerm = async (termId: number) => {
    const term = findTermById(termId);
    if (!term) return;

    // Find which cluster contains this term
    const sourceCluster = clusters.find((c) => c.terms.some((t) => t.term_id === termId));
    if (!sourceCluster) return;

    const originalClusters = clusters;
    const originalUnclustered = unclusteredTerms;

    // Check if cluster will be empty after removal
    const clusterWillBeEmpty = sourceCluster.terms.length === 1;

    // Optimistic update: remove term from cluster
    if (clusterWillBeEmpty) {
      setClusters((prev) => prev.filter((c) => c.id !== sourceCluster.id));
    } else {
      setClusters((prev) =>
        prev.map((c) => {
          if (c.id === sourceCluster.id) {
            const updated = {
              ...c,
              terms: c.terms.filter((t) => t.term_id !== termId),
            };
            return recalculateClusterStats(updated);
          }
          return c;
        })
      );
    }

    // Add term to unclustered
    setUnclusteredTerms((prev) => [...prev, term]);

    // API calls
    const apiCalls: Promise<unknown>[] = [api.unassignTermFromCluster(termId)];

    if (clusterWillBeEmpty) {
      apiCalls.push(api.deleteCluster(sourceCluster.id));
    }

    try {
      await Promise.all(apiCalls);
    } catch (err) {
      // Rollback on error
      setClusters(originalClusters);
      setUnclusteredTerms(originalUnclustered);
      setError(err instanceof Error ? err.message : "Failed to remove term");
    }
  };

  // Create new cluster
  const handleCreateCluster = async () => {
    if (!datasetId || !selectedLabel) return;

    const title = prompt("Enter cluster name:");
    if (!title) return;

    try {
      const newCluster = await api.createCluster(parseInt(datasetId), { label: selectedLabel, title });
      // Add new cluster to state immediately
      setClusters((prev) => [...prev, newCluster]);
      // Scroll to the new cluster after React re-renders
      setTimeout(() => {
        const element = document.querySelector(`[data-cluster-id="${newCluster.id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create cluster");
    }
  };

  // Filter and sort clusters by search
  const filteredClusters = useMemo(() => {
    let result = clusters;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = clusters.filter(
        (c) => c.title.toLowerCase().includes(query) || c.terms.some((t) => t.text.toLowerCase().includes(query))
      );
    }
    // Sort by cluster title (name) alphabetically
    return [...result].sort((a, b) => a.title.localeCompare(b.title));
  }, [clusters, searchQuery]);

  // Compute available letters from filtered clusters
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    filteredClusters.forEach((c) => {
      const firstChar = c.title.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar);
      } else {
        letters.add("#");
      }
    });
    return letters;
  }, [filteredClusters]);

  // Full alphabet for navigation
  const alphabet = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

  const scrollToLetter = (letter: string) => {
    const cluster = filteredClusters.find((c) => {
      const firstChar = c.title.charAt(0).toUpperCase();
      if (letter === "#") {
        return !/[A-Z]/.test(firstChar);
      }
      return firstChar === letter;
    });
    if (cluster) {
      const element = document.querySelector(`[data-cluster-id="${cluster.id}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Calculate stats
  const stats = useMemo(
    () => ({
      totalClusters: clusters.length,
      totalTerms: clusters.reduce((sum, c) => sum + c.total_terms, 0) + unclusteredTerms.length,
      avgTermsPerCluster:
        clusters.length > 0 ? (clusters.reduce((sum, c) => sum + c.total_terms, 0) / clusters.length).toFixed(1) : "0",
      unclusteredCount: unclusteredTerms.length,
    }),
    [clusters, unclusteredTerms]
  );

  if (!datasetId) {
    return (
      <Layout>
        <div>Invalid dataset ID</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={styles.page}>
          {/* Header with Navigation */}
          <div className={styles.header}>
            <Button
              variant="outline"
              onClick={() => navigate(`/datasets/${datasetId}/records`)}
              title="Back to Term Extraction"
            >
              ← Back to Extraction
            </Button>

            <div className={styles.pageInfo}>
              <h1 className={styles.pageTitle}>
                Term Clustering
                <span className={styles.infoTooltip}>
                  <FontAwesomeIcon icon={faCircleQuestion} className={styles.infoIcon} />
                  <span className={styles.tooltipContent}>
                    <p>Group similar terms together to simplify mapping to standard vocabularies in the next step.</p>
                    <strong>How to use:</strong>
                    <ul>
                      <li>Drag terms between clusters to reorganize them</li>
                      <li>Drag one cluster onto another to merge them</li>
                      <li>Click on a cluster name to rename it</li>
                      <li>Click Auto-Cluster to automatically group similar terms</li>
                    </ul>
                  </span>
                </span>
              </h1>
              <button
                className={styles.datasetLink}
                onClick={() => navigate(`/datasets/${datasetId}`)}
                title="Go to Dataset Overview"
              >
                Dataset: {datasetName || "Loading..."}
              </button>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate(`/datasets/${datasetId}/mapping`)}
              title="Go to Concept Mapping"
            >
              Mapping →
            </Button>
          </div>

          {/* Statistics and Actions */}
          <div className={styles.statsSection}>
            <div className={styles.statsGrid}>
              <StatCard label="Clusters" value={stats.totalClusters} />
              <StatCard label="Terms" value={stats.totalTerms} color="blue" />
              <StatCard label="Avg/Cluster" value={stats.avgTermsPerCluster} color="green" />
              <StatCard label="Unclustered" value={stats.unclusteredCount} color="orange" />
            </div>
            <div className={styles.pageActions}>
              <Button
                variant="primary"
                size="small"
                onClick={handleAutoClustering}
                disabled={isAutoClustering || !selectedLabel}
              >
                {isAutoClustering ? "Clustering..." : "Auto-Cluster"}
              </Button>
              <Button variant="outline" size="small" onClick={handleCreateCluster}>
                + New Cluster
              </Button>
            </div>
          </div>

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarControls}>
              <Select
                options={labels.map((l) => ({ value: l, label: l }))}
                value={selectedLabel}
                onValueChange={setSelectedLabel}
                fullWidth={false}
                className={styles.labelFilter}
              />

              <input
                type="text"
                placeholder="Search clusters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.alphabetNav}>
              {alphabet.map((letter) => {
                const isActive = availableLetters.has(letter);
                return (
                  <button
                    key={letter}
                    className={`${styles.alphabetButton} ${!isActive ? styles.alphabetButtonDisabled : ""}`}
                    onClick={() => scrollToLetter(letter)}
                    disabled={!isActive}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {isLoading ? (
            <div className={styles.loading}>Loading clusters...</div>
          ) : (
            <div>
              {filteredClusters.length === 0 && clusters.length === 0 ? (
                <div className={styles.emptyState}>
                  <h2>No clusters yet</h2>
                  <p>Get started by auto-clustering your terms for the selected label</p>
                  <Button variant="primary" size="large" onClick={handleAutoClustering} disabled={!selectedLabel}>
                    Auto-Cluster {selectedLabel || "Terms"}
                  </Button>
                </div>
              ) : (
                <div className={styles.clustersList}>
                  {filteredClusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onRename={(title) => handleRename(cluster.id, title)}
                      onDelete={() => handleDelete(cluster.id)}
                      onRemoveTerm={handleRemoveTerm}
                      isDraggingCluster={activeDragCluster !== null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {unclusteredTerms.length > 0 && <DroppableUnclusteredArea terms={unclusteredTerms} />}
          <DragOverlay>
            {activeDragTerm ? <TermOverlay term={activeDragTerm} /> : null}
            {activeDragCluster ? <ClusterOverlay cluster={activeDragCluster} /> : null}
          </DragOverlay>
          {showBackToTop && (
            <button className={styles.backToTop} onClick={scrollToTop} title="Back to top">
              <FontAwesomeIcon icon={faArrowUp} />
            </button>
          )}
        </div>
      </DndContext>
    </Layout>
  );
}
