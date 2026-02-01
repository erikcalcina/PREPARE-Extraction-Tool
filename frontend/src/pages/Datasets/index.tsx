import { Link } from "react-router-dom";
import Layout from "components/Layout";
import Table from "components/Table";
import Button from "components/Button";
import { useDatasets } from "@/hooks/useDatasets";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Dataset } from "types";
import styles from "./styles.module.css";

// ================================================
// Component
// ================================================

const Datasets = () => {
  usePageTitle("Datasets");
  const { datasets, isLoading, error, removeDataset, downloadDataset } = useDatasets();

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleDelete = async (dataset: Dataset) => {
    if (window.confirm(`Are you sure you want to delete "${dataset.name}"?`)) {
      try {
        await removeDataset(dataset.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete dataset");
      }
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      width: "40%",
      render: (item: Dataset) => (
        <Link to={`/datasets/${item.id}`} title={item.name} className={styles.datasets__link} onClick={(e) => e.stopPropagation()}>
          {item.name}
        </Link>
      ),
    },
    {
      key: "record_count",
      header: "No. of records",
      width: "20%",
      render: (item: Dataset) => item.record_count.toLocaleString(),
    },
    {
      key: "uploaded",
      header: "Date uploaded",
      width: "25%",
      render: (item: Dataset) => formatDate(item.uploaded),
    },
    {
      key: "actions",
      header: "Actions",
      width: "15%",
      render: (item: Dataset) => (
        <div className={styles.datasets__actions}>
          <Button
            variant="ghost"
            size="small"
            title="Download dataset"
            className={styles["datasets__action-button"]}
            onClick={(e) => {
              e.stopPropagation();
              downloadDataset(item.id);
            }}
          >
            Download
          </Button>
          <Button
            variant="ghost"
            size="small"
            title="Delete dataset"
            colorScheme="danger"
            className={styles["datasets__action-button"]}
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
    <div className={styles.datasets__sidebar}>
      <Link to="/datasets/upload">
        <Button variant="primary" label="+ Upload dataset" />
      </Link>
    </div>
  );

  return (
    <Layout sidebar={sidebar}>
      <div className={styles.datasets}>
        <h1 className={styles.datasets__title}>Datasets</h1>

        {error && <div className={styles.datasets__error}>{error}</div>}

        {isLoading ? (
          <div className={styles.datasets__loading}>Loading datasets...</div>
        ) : (
          <Table
            columns={columns}
            data={datasets}
            keyExtractor={(item) => item.id}
            emptyMessage="No datasets uploaded yet"
          />
        )}
      </div>
    </Layout>
  );
};

export default Datasets;
