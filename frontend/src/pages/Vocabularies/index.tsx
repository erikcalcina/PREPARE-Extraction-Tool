import { Link } from "react-router-dom";
import Layout from "@components/Layout";
import Table from "@components/Table";
import Button from "@components/Button";
import ProcessingBadge from "@components/ProcessingBadge";
import { useVocabularies } from "@/hooks/useVocabularies";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Vocabulary } from "@/types";
import styles from "./styles.module.css";

const Vocabularies = () => {
  usePageTitle("Vocabularies");
  const { vocabularies, isLoading, isProcessing, error, removeVocabulary, downloadVocabulary } = useVocabularies();

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleDelete = async (vocabulary: Vocabulary) => {
    if (window.confirm(`Are you sure you want to delete "${vocabulary.name}"?`)) {
      try {
        await removeVocabulary(vocabulary.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete vocabulary");
      }
    }
  };

  const isReady = (item: Vocabulary) => item.status === "DONE" || item.status === "DELETED" || item.status === "FAILED";

  const columns = [
    {
      key: "name",
      header: "Name",
      width: "40%",
      render: (item: Vocabulary) => (
        <div className={styles.vocabularies__name}>
          {isReady(item) ? (
            <Link to={`/vocabularies/${item.id}`} className={styles.vocabularies__link}>
              {item.name}
            </Link>
          ) : (
            <span>{item.name}</span>
          )}
          <ProcessingBadge status={item.status} errorMessage={item.error_message} />
        </div>
      ),
    },
    {
      key: "concept_count",
      header: "Concepts",
      width: "20%",
      render: (item: Vocabulary) => item.concept_count.toLocaleString(),
    },
    {
      key: "uploaded",
      header: "Date uploaded",
      width: "25%",
      render: (item: Vocabulary) => formatDate(item.uploaded),
    },
    {
      key: "actions",
      header: "Actions",
      width: "15%",
      render: (item: Vocabulary) => (
        <div className={styles.vocabularies__actions}>
          <Button
            variant="ghost"
            size="small"
            title="Download vocabulary"
            className={styles["vocabularies__action-button"]}
            disabled={!isReady(item)}
            onClick={(e) => {
              e.stopPropagation();
              downloadVocabulary(item.id);
            }}
          >
            Download
          </Button>
          <Button
            variant="ghost"
            size="small"
            title="Delete vocabulary"
            colorScheme="danger"
            className={styles["vocabularies__action-button"]}
            disabled={!isReady(item)}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const sidebar = (
    <div className={styles.vocabularies__sidebar}>
      {isProcessing ? (
        <>
          <Button variant="primary" label="+ Upload vocabulary" disabled />
          <span className={styles["vocabularies__processing-note"]}>Upload in progress...</span>
        </>
      ) : (
        <Link to="/vocabularies/upload">
          <Button variant="primary" label="+ Upload vocabulary" />
        </Link>
      )}
    </div>
  );

  return (
    <Layout sidebar={sidebar}>
      <div className={styles.vocabularies}>
        <h1 className={styles.vocabularies__title}>Vocabularies</h1>

        {error && <div className={styles.vocabularies__error}>{error}</div>}

        {isLoading ? (
          <div className={styles.vocabularies__loading}>Loading vocabularies...</div>
        ) : (
          <Table
            columns={columns}
            data={vocabularies}
            keyExtractor={(item) => item.id}
            emptyMessage="No vocabularies uploaded yet"
          />
        )}
      </div>
    </Layout>
  );
};

export default Vocabularies;
