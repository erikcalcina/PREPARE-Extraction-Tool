import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import Layout from 'components/Layout';
import { usePageTitle } from 'hooks/usePageTitle';
import type { ClusterData, ClusteredTerm } from 'types';
import * as api from 'api';
import ClusterDetailModal from './ClusterDetailModal';
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

// ================================================
// Draggable Term Component
// ================================================

interface DraggableTermProps {
    term: ClusteredTerm;
    clusterId: number | null;
}

function DraggableTerm({ term, clusterId }: DraggableTermProps) {
    return (
        <div
            className={styles.termItem}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify({ termId: term.term_id, sourceClusterId: clusterId }));
            }}
        >
            <span className={styles.termText}>{term.text}</span>
            <div className={styles.termStats}>
                <span className={styles.frequency}>{term.frequency}</span>
                <div className={styles.frequencyBar}>
                    <div className={styles.frequencyBarFill} style={{ width: `${Math.min(100, (term.frequency / 20) * 100)}%` }} />
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
    onView: () => void;
    onRename: (newTitle: string) => void;
    onDelete: () => void;
    onDrop: (e: React.DragEvent) => void;
}

function ClusterCard({ cluster, onView, onRename, onDelete, onDrop }: ClusterCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(cluster.title);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleRename = () => {
        if (editTitle.trim() && editTitle !== cluster.title) {
            onRename(editTitle.trim());
        }
        setIsEditing(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(e);
    };

    return (
        <div
            className={`${styles.clusterCard} ${isDragOver ? styles.dragOver : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-cluster-id={cluster.id}
        >
            <div className={styles.clusterHeader}>
                <div className={styles.clusterBadge}>{cluster.id}</div>
                <span className={`${styles.labelBadge} ${styles[getLabelColorClass(cluster.label)]}`}>
                    {cluster.label}
                </span>
            </div>

            <div className={styles.clusterTitle}>
                {isEditing ? (
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename();
                            if (e.key === 'Escape') {
                                setEditTitle(cluster.title);
                                setIsEditing(false);
                            }
                        }}
                        autoFocus
                        className={styles.titleInput}
                    />
                ) : (
                    <h3 onClick={() => setIsEditing(true)}>{cluster.title}</h3>
                )}
            </div>

            <div className={styles.clusterStats}>
                <span>{cluster.total_terms} terms</span>
                <span>{cluster.total_occurrences} occurrences</span>
                <span>{cluster.unique_records} records</span>
            </div>

            <div className={styles.termsList}>
                {cluster.terms.slice(0, 5).map((term) => (
                    <DraggableTerm key={term.term_id} term={term} clusterId={cluster.id} />
                ))}
                {cluster.terms.length > 5 && (
                    <div className={styles.moreTerms}>+{cluster.terms.length - 5} more</div>
                )}
            </div>

            <div className={styles.clusterActions}>
                <button onClick={onView} className={styles.btnView}>View</button>
                <button onClick={onDelete} className={styles.btnDelete}>Delete</button>
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
    const [selectedLabel, setSelectedLabel] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoClustering, setIsAutoClustering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null);
    const [datasetName, setDatasetName] = useState<string>('');

    usePageTitle(datasetName ? `Term Clustering - ${datasetName}` : 'Term Clustering');

    // Fetch dataset info
    useEffect(() => {
        const fetchDataset = async () => {
            if (!datasetId) return;
            try {
                const data = await api.getDataset(parseInt(datasetId));
                setDatasetName(data.dataset.name);
            } catch (err) {
                console.error('Failed to fetch dataset:', err);
            }
        };
        fetchDataset();
    }, [datasetId]);

    // Fetch clusters
    const fetchClusters = async () => {
        if (!datasetId) return;

        try {
            setIsLoading(true);
            setError(null);
            const data = await api.getClusters(parseInt(datasetId), selectedLabel || undefined);
            setClusters(data.clusters);
            setUnclusteredTerms(data.unclustered_terms);
            setLabels(data.labels);

            // Set default label if not set
            if (!selectedLabel && data.labels.length > 0) {
                setSelectedLabel(data.labels[0]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load clusters');
        } finally {
            setIsLoading(false);
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
            setError(err instanceof Error ? err.message : 'Auto-clustering failed');
        } finally {
            setIsAutoClustering(false);
        }
    };

    // Helper function to recalculate cluster stats
    const recalculateClusterStats = (cluster: ClusterData): ClusterData => {
        const totalTerms = cluster.terms.length;
        const totalOccurrences = cluster.terms.reduce((sum, t) => sum + t.frequency, 0);
        const uniqueRecordIds = new Set(cluster.terms.flatMap(t => t.record_ids));
        const uniqueRecords = uniqueRecordIds.size;

        return {
            ...cluster,
            total_terms: totalTerms,
            total_occurrences: totalOccurrences,
            unique_records: uniqueRecords,
        };
    };

    // Handle drag and drop
    const handleDrop = async (e: React.DragEvent, targetClusterId: number | null) => {
        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;

        try {
            const { termId, sourceClusterId } = JSON.parse(data);

            // Don't do anything if dropping in same cluster
            if (sourceClusterId === targetClusterId) return;

            // Optimistic update
            const term = findTermById(termId);
            if (!term) return;

            // Store original state for rollback
            const originalClusters = clusters;
            const originalUnclustered = unclusteredTerms;

            // Remove from source and add to target with stat recalculation
            if (sourceClusterId === null) {
                setUnclusteredTerms(prev => prev.filter(t => t.term_id !== termId));
            } else {
                setClusters(prev => prev.map(c => {
                    if (c.id === sourceClusterId) {
                        const updated = {
                            ...c,
                            terms: c.terms.filter(t => t.term_id !== termId)
                        };
                        return recalculateClusterStats(updated);
                    }
                    return c;
                }));
            }

            // Add to target
            if (targetClusterId === null) {
                setUnclusteredTerms(prev => [...prev, term]);
            } else {
                setClusters(prev => prev.map(c => {
                    if (c.id === targetClusterId) {
                        const updated = {
                            ...c,
                            terms: [...c.terms, term]
                        };
                        return recalculateClusterStats(updated);
                    }
                    return c;
                }));
            }

            // API call in background (no await for UI refresh)
            if (targetClusterId === null) {
                api.unassignTermFromCluster(termId).catch((err) => {
                    // Rollback on error
                    setClusters(originalClusters);
                    setUnclusteredTerms(originalUnclustered);
                    setError(err instanceof Error ? err.message : 'Failed to move term');
                });
            } else {
                api.assignTermToCluster(termId, targetClusterId).catch((err) => {
                    // Rollback on error
                    setClusters(originalClusters);
                    setUnclusteredTerms(originalUnclustered);
                    setError(err instanceof Error ? err.message : 'Failed to move term');
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to move term');
        }
    };

    const findTermById = (termId: number): ClusteredTerm | undefined => {
        for (const cluster of clusters) {
            const term = cluster.terms.find(t => t.term_id === termId);
            if (term) return term;
        }
        return unclusteredTerms.find(t => t.term_id === termId);
    };

    // Handle cluster rename
    const handleRename = async (clusterId: number, newTitle: string) => {
        // Optimistic update
        const originalClusters = clusters;
        setClusters(prev => prev.map(c =>
            c.id === clusterId ? { ...c, title: newTitle } : c
        ));

        try {
            await api.renameCluster(clusterId, newTitle);
        } catch (err) {
            // Rollback on error
            setClusters(originalClusters);
            setError(err instanceof Error ? err.message : 'Failed to rename cluster');
        }
    };

    // Handle cluster delete
    const handleDelete = async (clusterId: number) => {
        if (!confirm('Are you sure you want to delete this cluster? Terms will become unclustered.')) {
            return;
        }

        const originalClusters = clusters;
        const originalUnclustered = unclusteredTerms;

        // Find cluster and move its terms to unclustered
        const clusterToDelete = clusters.find(c => c.id === clusterId);
        if (!clusterToDelete) return;

        // Optimistic update
        setClusters(prev => prev.filter(c => c.id !== clusterId));
        setUnclusteredTerms(prev => [...prev, ...clusterToDelete.terms]);

        try {
            await api.deleteCluster(clusterId);
        } catch (err) {
            // Rollback on error
            setClusters(originalClusters);
            setUnclusteredTerms(originalUnclustered);
            setError(err instanceof Error ? err.message : 'Failed to delete cluster');
        }
    };

    // Create new cluster
    const handleCreateCluster = async () => {
        if (!datasetId || !selectedLabel) return;

        const title = prompt('Enter cluster name:');
        if (!title) return;

        try {
            const newCluster = await api.createCluster(parseInt(datasetId), { label: selectedLabel, title });
            // Add new cluster to state immediately
            setClusters(prev => [...prev, newCluster]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create cluster');
        }
    };

    // Filter clusters by search
    const filteredClusters = useMemo(() => {
        if (!searchQuery) return clusters;
        const query = searchQuery.toLowerCase();
        return clusters.filter(c =>
            c.title.toLowerCase().includes(query) ||
            c.terms.some(t => t.text.toLowerCase().includes(query))
        );
    }, [clusters, searchQuery]);

    // Calculate stats
    const stats = useMemo(() => ({
        totalClusters: clusters.length,
        totalTerms: clusters.reduce((sum, c) => sum + c.total_terms, 0) + unclusteredTerms.length,
        avgTermsPerCluster: clusters.length > 0 ? (clusters.reduce((sum, c) => sum + c.total_terms, 0) / clusters.length).toFixed(1) : '0',
        unclusteredCount: unclusteredTerms.length,
    }), [clusters, unclusteredTerms]);

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
                        onClick={() => navigate(`/datasets/${datasetId}/records`)}
                        title="Back to Term Extraction"
                    >
                        ← Back to Extraction
                    </button>

                    <div className={styles.pageInfo}>
                        <h1 className={styles.pageTitle}>Term Clustering</h1>
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
                        onClick={() => navigate(`/datasets/${datasetId}/mapping`)}
                        title="Go to Concept Mapping"
                    >
                        Mapping →
                    </button>
                </div>

                {/* Toolbar and Statistics */}
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

                        <input
                            type="text"
                            placeholder="Search clusters..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />

                        <button
                            onClick={handleAutoClustering}
                            disabled={isAutoClustering || !selectedLabel}
                            className={styles.btnAutoClustering}
                        >
                            {isAutoClustering ? 'Clustering...' : '🔮 Auto-Cluster'}
                        </button>

                        <button onClick={handleCreateCluster} className={styles.btnCreate}>
                            + New Cluster
                        </button>
                    </div>

                    <div className={styles.stats}>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.totalClusters}</div>
                            <div className={styles.statLabel}>Total Clusters</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.totalTerms}</div>
                            <div className={styles.statLabel}>Extracted Terms</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.avgTermsPerCluster}</div>
                            <div className={styles.statLabel}>Avg Terms/Cluster</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.unclusteredCount}</div>
                            <div className={styles.statLabel}>Unclustered</div>
                        </div>
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
                    <>
                        {filteredClusters.length === 0 && clusters.length === 0 ? (
                            <div className={styles.emptyState}>
                                <h2>No clusters yet</h2>
                                <p>Get started by auto-clustering your terms for the selected label</p>
                                <button onClick={handleAutoClustering} disabled={!selectedLabel} className={styles.btnAutoClusteringLarge}>
                                    🔮 Auto-Cluster {selectedLabel || 'Terms'}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.clustersGrid}>
                                {filteredClusters.map(cluster => (
                                    <ClusterCard
                                        key={cluster.id}
                                        cluster={cluster}
                                        onView={() => setSelectedCluster(cluster)}
                                        onRename={(title) => handleRename(cluster.id, title)}
                                        onDelete={() => handleDelete(cluster.id)}
                                        onDrop={(e) => handleDrop(e, cluster.id)}
                                    />
                                ))}
                            </div>
                        )}

                        {unclusteredTerms.length > 0 && (
                            <div className={styles.unclusteredSection}>
                                <h2>Unclustered Terms ({unclusteredTerms.length})</h2>
                                <div
                                    className={styles.unclusteredArea}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, null)}
                                >
                                    {unclusteredTerms.map(term => (
                                        <DraggableTerm key={term.term_id} term={term} clusterId={null} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {selectedCluster && (
                    <ClusterDetailModal
                        cluster={selectedCluster}
                        onClose={() => setSelectedCluster(null)}
                        onRefresh={fetchClusters}
                    />
                )}
            </div>
        </Layout>
    );
}

