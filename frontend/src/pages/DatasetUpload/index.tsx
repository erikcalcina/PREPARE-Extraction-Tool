import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from 'components/Layout';
import FileDropzone from 'components/FileDropzone';
import Button from 'components/Button';
import { useDatasets } from 'hooks/useDatasets';
import styles from './styles.module.css';

// ================================================
// Helper functions
// ================================================

function parseCSV(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim());
    // Skip header row if present
    const dataLines = lines.length > 1 && lines[0].toLowerCase().includes('text')
        ? lines.slice(1)
        : lines;
    return dataLines.map(line => line.trim()).filter(Boolean);
}

function parseJSON(text: string): string[] {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
        return data.map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item.text) return item.text;
            return JSON.stringify(item);
        });
    }
    if (data.records && Array.isArray(data.records)) {
        return data.records.map((r: { text: string }) => r.text);
    }
    throw new Error('Invalid JSON format');
}

// ================================================
// Component
// ================================================

const DatasetUpload = () => {
    const [file, setFile] = useState<File | null>(null);
    const [datasetName, setDatasetName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { addDataset } = useDatasets();
    const navigate = useNavigate();

    const handleFileSelect = useCallback((selectedFile: File) => {
        setFile(selectedFile);
        setError(null);
        // Auto-fill dataset name from filename
        if (!datasetName) {
            const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
            setDatasetName(nameWithoutExt);
        }
    }, [datasetName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a file');
            return;
        }

        if (!datasetName.trim()) {
            setError('Please enter a dataset name');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            // Read file content
            const text = await file.text();
            let records: string[];

            // Parse based on file type
            if (file.name.endsWith('.json')) {
                records = parseJSON(text);
            } else {
                records = parseCSV(text);
            }

            if (records.length === 0) {
                throw new Error('No records found in file');
            }

            // Create dataset
            await addDataset({
                name: datasetName.trim(),
                records: records.map(text => ({ text })),
            });

            // Navigate back to datasets list
            navigate('/datasets');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload dataset');
        } finally {
            setIsUploading(false);
        }
    };

    const sidebar = (
        <div className={styles.sidebarContent}>
            <Link to="/datasets" className={styles.backLink}>
                ← Back to datasets
            </Link>
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

                            <div className={styles.dropzoneWrapper}>
                                <p className={styles.dropzoneLabel}>Upload dataset file</p>
                                <FileDropzone
                                    onFileSelect={handleFileSelect}
                                    accept=".csv,.json"
                                    disabled={isUploading}
                                />
                            </div>

                            {error && (
                                <div className={styles.error}>
                                    {error}
                                </div>
                            )}

                            <div className={styles.submitWrapper}>
                                <Button
                                    primary
                                    label={isUploading ? 'Uploading...' : 'Upload Dataset'}
                                    onClick={() => {}}
                                />
                            </div>
                        </form>
                    </div>

                    <aside className={styles.instructions}>
                        <h2 className={styles.instructionsTitle}>Instructions</h2>
                        <div className={styles.instructionsContent}>
                            <p>
                                Upload your dataset file in CSV or JSON format. The file should contain
                                the text records you want to process.
                            </p>
                            <p>
                                <strong>CSV format:</strong> The file should have a header row with a
                                "text" column, followed by your data rows.
                            </p>
                            <p>
                                <strong>JSON format:</strong> The file should contain an array of
                                objects with a "text" field, or an array of strings.
                            </p>
                            <p>
                                Maximum file size: 50MB. Supported formats: .csv, .json
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </Layout>
    );
};

export default DatasetUpload;

