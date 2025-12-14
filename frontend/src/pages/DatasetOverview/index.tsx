import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from 'components/Layout';
import { usePageTitle } from 'hooks/usePageTitle';
import type { DatasetOverviewOutput } from 'types';
import * as api from 'api';
import styles from './styles.module.css';

// ================================================
// Helper functions
// ================================================

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function getLabelColorClass(index: number): string {
    return `label${(index % 9) + 1}`;
}

// ================================================
// Stat Card Component
// ================================================

interface StatCardProps {
    label: string;
    value: number;
    variant?: 'default' | 'processed' | 'pending' | 'terms';
}

function StatCard({ label, value, variant = 'default' }: StatCardProps) {
    return (
        <div className={styles.statCard}>
            <div className={styles.statLabel}>{label}</div>
            <div className={`${styles.statValue} ${variant !== 'default' ? styles[variant] : ''}`}>
                {value.toLocaleString()}
            </div>
        </div>
    );
}

// ================================================
// Workflow Card Component
// ================================================

interface WorkflowCardProps {
    title: string;
    description: string;
    icon: string;
    stats: Array<{ label: string; value: string | number }>;
    progress?: { current: number; total: number };
    actions: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' }>;
}

function WorkflowCard({ title, description, icon, stats, progress, actions }: WorkflowCardProps) {
    const progressPercentage = progress ? (progress.current / progress.total) * 100 : 0;

    return (
        <div className={styles.workflowCard}>
            <div className={styles.workflowHeader}>
                <span className={styles.workflowIcon}>{icon}</span>
                <div>
                    <h3 className={styles.workflowTitle}>{title}</h3>
                    <p className={styles.workflowDescription}>{description}</p>
                </div>
            </div>

            <div className={styles.workflowStats}>
                {stats.map((stat, idx) => (
                    <div key={idx} className={styles.workflowStat}>
                        <span className={styles.workflowStatLabel}>{stat.label}</span>
                        <span className={styles.workflowStatValue}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {progress && (
                <div className={styles.progressSection}>
                    <div className={styles.progressHeader}>
                        <span className={styles.progressLabel}>Progress</span>
                        <span className={styles.progressText}>
                            {progress.current} / {progress.total} ({Math.round(progressPercentage)}%)
                        </span>
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${Math.min(100, progressPercentage)}%` }}
                        />
                    </div>
                </div>
            )}

            <div className={styles.workflowActions}>
                {actions.map((action, idx) => (
                    <button
                        key={idx}
                        onClick={action.onClick}
                        className={`${styles.workflowButton} ${action.variant === 'primary' ? styles.primary : styles.secondary}`}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ================================================
// Main Component
// ================================================

const DatasetOverview = () => {
    const { datasetId } = useParams<{ datasetId: string }>();
    const navigate = useNavigate();
    const [overview, setOverview] = useState<DatasetOverviewOutput | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const parsedDatasetId = datasetId ? parseInt(datasetId, 10) : 0;

    usePageTitle(overview?.dataset.name || 'Dataset Overview');

    useEffect(() => {
        const fetchOverview = async () => {
            if (!parsedDatasetId) return;

            try {
                setIsLoading(true);
                setError(null);
                const data = await api.getDatasetOverview(parsedDatasetId);
                setOverview(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load dataset overview');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOverview();
    }, [parsedDatasetId]);

    const handleExtractAll = async () => {
        if (!overview) return;

        const confirmed = window.confirm(
            `This will extract terms from all ${overview.stats.total_records} record${overview.stats.total_records !== 1 ? 's' : ''} in the dataset. This may take several minutes. Continue?`
        );

        if (!confirmed) return;

        try {
            await api.extractDatasetTerms(parsedDatasetId, overview.dataset.labels);
            alert('Term extraction started successfully');
            // Refresh overview
            const data = await api.getDatasetOverview(parsedDatasetId);
            setOverview(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to extract terms';
            alert(`Error: ${errorMessage}`);
        }
    };

    const handleAutoClustering = async () => {
        if (!overview || overview.dataset.labels.length === 0) return;

        const label = overview.dataset.labels[0]; // Use first label
        const confirmed = window.confirm(
            `This will automatically cluster all extracted terms for the label "${label}". Continue?`
        );

        if (!confirmed) return;

        try {
            await api.rebuildClusters(parsedDatasetId, label);
            alert('Auto-clustering completed successfully');
            // Refresh overview
            const data = await api.getDatasetOverview(parsedDatasetId);
            setOverview(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to auto-cluster';
            alert(`Error: ${errorMessage}`);
        }
    };

    if (!parsedDatasetId) {
        return (
            <Layout>
                <div className={styles.page}>
                    <div className={styles.error}>Invalid dataset ID</div>
                </div>
            </Layout>
        );
    }

    if (isLoading) {
        return (
            <Layout>
                <div className={styles.page}>
                    <div className={styles.loading}>Loading dataset overview...</div>
                </div>
            </Layout>
        );
    }

    if (error || !overview) {
        return (
            <Layout>
                <div className={styles.page}>
                    <div className={styles.error}>{error || 'Failed to load dataset'}</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.page}>
                {/* Header Section */}
                <div className={styles.header}>
                    <div className={styles.titleSection}>
                        <button
                            className={styles.backButton}
                            onClick={() => navigate('/datasets')}
                            title="Back to Datasets"
                        >
                            ←
                        </button>
                        <div>
                            <h1 className={styles.title}>{overview.dataset.name}</h1>
                            <p className={styles.subtitle}>
                                Dataset Overview and Statistics
                            </p>
                        </div>
                    </div>
                </div>

                {/* Labels Section */}
                {overview.dataset.labels.length > 0 && (
                    <div className={styles.labelsSection}>
                        <span className={styles.labelsTitle}>Labels:</span>
                        <div className={styles.labels}>
                            {overview.dataset.labels.map((label, idx) => (
                                <span
                                    key={idx}
                                    className={`${styles.labelBadge} ${styles[getLabelColorClass(idx)]}`}
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Metadata Section */}
                <div className={styles.metadata}>
                    <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Uploaded:</span>
                        <span className={styles.metadataValue}>
                            {formatDate(overview.dataset.uploaded)}
                        </span>
                    </div>
                    <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Last Modified:</span>
                        <span className={styles.metadataValue}>
                            {formatDate(overview.dataset.last_modified)}
                        </span>
                    </div>
                    <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Total Records:</span>
                        <span className={styles.metadataValue}>
                            {overview.dataset.record_count.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className={styles.statsGrid}>
                    <StatCard
                        label="Total Records"
                        value={overview.stats.total_records}
                    />
                    <StatCard
                        label="Records Processed"
                        value={overview.stats.processed_count}
                        variant="processed"
                    />
                    <StatCard
                        label="Total Terms"
                        value={overview.stats.extracted_terms_count}
                        variant="terms"
                    />
                    <StatCard
                        label="Pending Review"
                        value={overview.stats.pending_review_count}
                        variant="pending"
                    />
                </div>

                {/* Workflow Section */}
                <div className={styles.workflowSection}>
                    <h2 className={styles.sectionTitle}>Workflow Steps</h2>
                    <div className={styles.workflowGrid}>
                        {/* Term Extraction Card */}
                        <WorkflowCard
                            title="Term Extraction"
                            description="Extract medical entities from clinical text"
                            icon="📝"
                            stats={[
                                { label: 'Total Records', value: overview.stats.total_records },
                                { label: 'Terms Extracted', value: overview.stats.extracted_terms_count },
                            ]}
                            progress={{
                                current: overview.stats.processed_count,
                                total: overview.stats.total_records,
                            }}
                            actions={[
                                {
                                    label: 'View Records',
                                    onClick: () => navigate(`/datasets/${datasetId}/records`),
                                    variant: 'primary',
                                },
                                {
                                    label: 'Extract All',
                                    onClick: handleExtractAll,
                                    variant: 'secondary',
                                },
                            ]}
                        />

                        {/* Term Clustering Card */}
                        <WorkflowCard
                            title="Term Clustering"
                            description="Group similar terms for standardization"
                            icon="🔮"
                            stats={[
                                { label: 'Clusters Created', value: overview.clustering_stats.total_clusters },
                                { label: 'Clustered Terms', value: overview.clustering_stats.clustered_terms },
                                { label: 'Unclustered Terms', value: overview.clustering_stats.unclustered_terms },
                            ]}
                            actions={[
                                {
                                    label: 'View Clusters',
                                    onClick: () => navigate(`/datasets/${datasetId}/clusters`),
                                    variant: 'primary',
                                },
                                {
                                    label: 'Auto-Cluster',
                                    onClick: handleAutoClustering,
                                    variant: 'secondary',
                                },
                            ]}
                        />

                        {/* Concept Mapping Card */}
                        <WorkflowCard
                            title="Concept Mapping"
                            description="Map clusters to standard vocabulary concepts"
                            icon="🗺️"
                            stats={[
                                { label: 'Total Clusters', value: overview.mapping_stats.total_clusters },
                                { label: 'Mapped Clusters', value: overview.mapping_stats.mapped_clusters },
                                { label: 'Unmapped Clusters', value: overview.mapping_stats.unmapped_clusters },
                            ]}
                            progress={{
                                current: overview.mapping_stats.mapped_clusters,
                                total: overview.mapping_stats.total_clusters,
                            }}
                            actions={[
                                {
                                    label: 'View Mappings',
                                    onClick: () => alert('Concept mapping view coming soon!'),
                                    variant: 'primary',
                                },
                                {
                                    label: 'Start Mapping',
                                    onClick: () => alert('Automated mapping coming soon!'),
                                    variant: 'secondary',
                                },
                            ]}
                        />
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default DatasetOverview;
