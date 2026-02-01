import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "components/Layout";
import FileDropzone from "components/FileDropzone";
import Button from "components/Button";
import ProgressBar from "components/ProgressBar";
import TagInput from "components/TagInput";
import { useDatasets } from "@/hooks/useDatasets";
import { usePageTitle } from "@/hooks/usePageTitle";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

import styles from "./styles.module.css";

// Note: File parsing is handled by the backend

// ================================================
// Component
// ================================================

const DatasetUpload = () => {
  usePageTitle("Upload Dataset");

  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { uploadDataset } = useDatasets();
  const navigate = useNavigate();

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      setError(null);
      // Auto-fill dataset name from filename
      if (!datasetName) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setDatasetName(nameWithoutExt);
      }
    },
    [datasetName]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a file");
      return;
    }

    if (!datasetName.trim()) {
      setError("Please enter a dataset name");
      return;
    }

    if (labels.length === 0) {
      setError("Please enter at least one label");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Send file directly to backend with progress tracking
      await uploadDataset(
        {
          name: datasetName.trim(),
          labels: labels.join(","),
          file: file,
        },
        (progress) => {
          console.log("Upload progress:", progress.toFixed(2) + "%");
          setUploadProgress(progress);
        }
      );

      // Navigate back to datasets list
      navigate("/datasets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload dataset");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const sidebar = (
    <div className={styles.sidebarContent}>
      <Button variant="outline" onClick={() => navigate("/datasets")} title="Back to datasets">
        <FontAwesomeIcon icon={faArrowLeft} /> Datasets
      </Button>
    </div>
  );

  return (
    <Layout sidebar={sidebar}>
      <div className={styles.page}>
        <h1 className={styles.title}>Upload Dataset</h1>

        <div className={styles.content}>
          <div className={styles.uploadSection}>
            <form onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="datasetName" className={styles.label}>
                  Dataset name
                </label>
                <input
                  id="datasetName"
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className={styles.input}
                  placeholder="Enter dataset name"
                  disabled={isUploading}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="labels" className={styles.label}>
                  Labels
                </label>
                <TagInput
                  id="labels"
                  tags={labels}
                  onChange={setLabels}
                  placeholder="e.g., diagnosis, symptom, medication"
                  disabled={isUploading}
                />
              </div>

              <div className={styles.dropzoneWrapper}>
                <p className={styles.dropzoneLabel}>Upload dataset file</p>
                <FileDropzone
                  onFileSelect={handleFileSelect}
                  accept=".csv"
                  maxSize={2 * 1024 * 1024 * 1024}
                  disabled={isUploading}
                />
              </div>

              {isUploading && (
                <div className={styles.progressWrapper}>
                  <p className={styles.progressLabel}>Uploading...</p>
                  <ProgressBar progress={uploadProgress} />
                </div>
              )}

              {error && <div className={styles.error}>{error}</div>}

              <div className={styles.submitWrapper}>
                <Button
                  variant="primary"
                  type="submit"
                  label={isUploading ? "Uploading..." : "Upload Dataset"}
                  disabled={isUploading}
                />
              </div>
            </form>
          </div>

          <aside className={styles.instructions}>
            <h2 className={styles.instructionsTitle}>Instructions</h2>
            <div className={styles.instructionsContent}>
              <p>
                Upload your dataset file in CSV format. The file should contain the text records you want to process
                along with patient identifiers.
              </p>
              <p>
                <strong>Required columns:</strong> patient_id, text
              </p>
              <p>
                <strong>Labels:</strong> Type a label and press Enter to add it. These labels represent the data
                categories in your dataset (e.g., diagnosis, symptom, event, medication). You can also paste
                comma-separated values.
              </p>
              <p>Maximum file size: 2GB. Supported format: .csv</p>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
};

export default DatasetUpload;
