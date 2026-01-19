import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from 'components/Layout';
import FileDropzone from 'components/FileDropzone';
import Button from 'components/Button';
import ProgressBar from 'components/ProgressBar';
import { useVocabularies } from 'hooks/useVocabularies';
import { usePageTitle } from 'hooks/usePageTitle';
import styles from './styles.module.css';

// Note: File parsing is handled by the backend

// ================================================
// Component
// ================================================

const VocabularyUpload = () => {
    usePageTitle('Upload Vocabulary');

    const [file, setFile] = useState<File | null>(null);
    const [vocabularyName, setVocabularyName] = useState('');
    const [version, setVersion] = useState('1.0');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const { addVocabulary } = useVocabularies();
    const navigate = useNavigate();

    const handleFileSelect = useCallback((selectedFile: File) => {
        setFile(selectedFile);
        setError(null);
        // Auto-fill vocabulary name from filename
        if (!vocabularyName) {
            const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
            setVocabularyName(nameWithoutExt);
        }
    }, [vocabularyName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a file');
            return;
        }

        if (!vocabularyName.trim()) {
            setError('Please enter a vocabulary name');
            return;
        }

        if (!version.trim()) {
            setError('Please enter a version');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            // Send file directly to backend with progress tracking
            await addVocabulary(
                {
                    name: vocabularyName.trim(),
                    version: version.trim(),
                    file: file,
                },
                (progress) => {
                    console.log('Upload progress:', progress.toFixed(2) + '%');
                    setUploadProgress(progress);
                }
            );

            // Navigate back to vocabularies list
            navigate('/vocabularies');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload vocabulary');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const sidebar = (
        <div className={styles.sidebarContent}>
            <Link to="/vocabularies" className={styles.backLink}>
                ← Back to vocabularies
            </Link>
        </div>
    );

    return (
        <Layout sidebar={sidebar}>
            <div className={styles.page}>
                <h1 className={styles.title}>Upload Vocabulary</h1>

                <div className={styles.content}>
                    <div className={styles.uploadSection}>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.fieldRow}>
                                <div className={styles.field}>
                                    <label htmlFor="vocabularyName" className={styles.label}>
                                        Vocabulary name
                                    </label>
                                    <input
                                        id="vocabularyName"
                                        type="text"
                                        value={vocabularyName}
                                        onChange={(e) => setVocabularyName(e.target.value)}
                                        className={styles.input}
                                        placeholder="Enter vocabulary name"
                                        disabled={isUploading}
                                    />
                                </div>

                                <div className={styles.fieldSmall}>
                                    <label htmlFor="version" className={styles.label}>
                                        Version
                                    </label>
                                    <input
                                        id="version"
                                        type="text"
                                        value={version}
                                        onChange={(e) => setVersion(e.target.value)}
                                        className={styles.input}
                                        placeholder="e.g., 1.0"
                                        disabled={isUploading}
                                    />
                                </div>
                            </div>

                            <div className={styles.dropzoneWrapper}>
                                <p className={styles.dropzoneLabel}>Upload vocabulary file</p>
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

                            {error && (
                                <div className={styles.error}>
                                    {error}
                                </div>
                            )}

                            <div className={styles.submitWrapper}>
                                <Button
                                    primary
                                    type="submit"
                                    label={isUploading ? 'Uploading...' : 'Upload Vocabulary'}
                                    disabled={isUploading}
                                />
                            </div>
                        </form>
                    </div>

                    <aside className={styles.instructions}>
                        <h2 className={styles.instructionsTitle}>Instructions</h2>
                        <div className={styles.instructionsContent}>
                            <p>
                                Upload your vocabulary file as a tab-delimited CSV file. The file should contain
                                the concepts with all required OMOP CDM vocabulary fields.
                            </p>
                            <p>
                                <strong>Required columns:</strong> concept_id, concept_name, domain_id,
                                concept_class_id, standard_concept, concept_code, valid_start_date,
                                valid_end_date, invalid_reason
                            </p>
                            <p>
                                <strong>Date format:</strong> Dates must be in YYYYMMDD format
                                (e.g., 20240101 for January 1, 2024).
                            </p>
                            <p>
                                The vocabulary will be indexed for semantic search after upload.
                                Maximum file size: 2GB. Supported format: .csv (tab-delimited)
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </Layout>
    );
};

export default VocabularyUpload;

