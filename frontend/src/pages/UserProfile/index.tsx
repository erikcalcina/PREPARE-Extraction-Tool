import { useState, useEffect } from 'react';
import Layout from 'components/Layout';
import Button from 'components/Button';
import UserAvatar from 'components/UserAvatar';
import { useAuth } from 'hooks/useAuth';
import { getUserStats } from 'api';
import type { UserStats } from 'types';
import styles from './styles.module.css';

// ================================================
// Component
// ================================================

const UserProfile = () => {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getUserStats();
                setStats(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load statistics');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!user) {
        return null;
    }

    return (
        <Layout>
            <div className={styles.page}>
                <h1 className={styles.title}>User Profile</h1>

                {error && (
                    <div className={styles.error}>
                        {error}
                    </div>
                )}

                <div className={styles.content}>
                    {/* User Info Card */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <UserAvatar username={user.username} size="large" />
                            <div className={styles.userInfo}>
                                <h2 className={styles.username}>{user.username}</h2>
                                <span className={styles.badge}>
                                    {user.disabled ? 'Disabled' : 'Active'}
                                </span>
                            </div>
                        </div>

                        <div className={styles.details}>
                            <div className={styles.detailRow}>
                                <span className={styles.label}>Member since</span>
                                <span className={styles.value}>{formatDate(user.created_at)}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.label}>Last login</span>
                                <span className={styles.value}>
                                    {user.last_login ? formatDate(user.last_login) : 'Never'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Card */}
                    <div className={styles.card}>
                        <h3 className={styles.cardTitle}>Statistics</h3>

                        {isLoading ? (
                            <div className={styles.loading}>Loading statistics...</div>
                        ) : stats ? (
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{stats.dataset_count}</span>
                                    <span className={styles.statLabel}>Datasets Uploaded</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{stats.vocabulary_count}</span>
                                    <span className={styles.statLabel}>Vocabularies Uploaded</span>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Logout Section */}
                    <div className={styles.logoutSection}>
                        <Button
                            label="Logout"
                            onClick={logout}
                        />
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default UserProfile;

