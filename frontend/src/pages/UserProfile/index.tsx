import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import Button from "@/components/Button";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getUserStats } from "@/api";
import type { UserStats } from "@/types";
import styles from "./styles.module.css";

const UserProfile = () => {
  usePageTitle("Profile");
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
        setError(err instanceof Error ? err.message : "Failed to load statistics");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className={styles.page}>
        <h1 className={styles["page__title"]}>User Profile</h1>

        {error && <div className={styles["page__error"]}>{error}</div>}

        <div className={styles["page__content"]}>
          {/* User Info Card */}
          <div className={styles.card}>
            <div className={styles["card__header"]}>
              <UserAvatar username={user.username} size="large" />
              <div className={styles["card__user-info"]}>
                <h2 className={styles["card__username"]}>{user.username}</h2>
                <span className={styles["card__badge"]}>{user.disabled ? "Disabled" : "Active"}</span>
              </div>
            </div>

            <div className={styles.details}>
              <div className={styles["details__row"]}>
                <span className={styles["details__label"]}>Member since</span>
                <span className={styles["details__value"]}>{formatDate(user.created_at)}</span>
              </div>
              <div className={styles["details__row"]}>
                <span className={styles["details__label"]}>Last login</span>
                <span className={styles["details__value"]}>
                  {user.last_login ? formatDate(user.last_login) : "Never"}
                </span>
              </div>
            </div>
          </div>

          {/* Statistics Card */}
          <div className={styles.card}>
            <h3 className={styles["card__title"]}>Statistics</h3>

            {isLoading ? (
              <div className={styles.loading}>Loading statistics...</div>
            ) : stats ? (
              <div className={styles.stats}>
                <div className={styles["stats__item"]}>
                  <span className={styles["stats__value"]}>{stats.dataset_count}</span>
                  <span className={styles["stats__label"]}>Datasets Uploaded</span>
                </div>
                <div className={styles["stats__item"]}>
                  <span className={styles["stats__value"]}>{stats.vocabulary_count}</span>
                  <span className={styles["stats__label"]}>Vocabularies Uploaded</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Logout Section */}
          <div className={styles.logout}>
            <Button label="Logout" onClick={logout} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;
