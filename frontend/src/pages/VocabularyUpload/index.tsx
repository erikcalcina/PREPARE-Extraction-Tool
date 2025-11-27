import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from 'components/Layout';
import FileDropzone from 'components/FileDropzone';
import Button from 'components/Button';
import { useVocabularies } from 'hooks/useVocabularies';
import type { ConceptCreate } from 'types';
import styles from './styles.module.css';

// ================================================
// Helper functions
// ================================================

function parseCSV(text: string): ConceptCreate[] {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('CSV file must have a header and at least one data row');
    }

    // Parse header to find column indices
    const header = lines[0].toLowerCase();
    const hasIdColumn = header.includes('vocab_term_id') || header.includes('id');
    const hasNameColumn = header.includes('vocab_term_name') || header.includes('name');

    if (!hasIdColumn || !hasNameColumn) {
        throw new Error('CSV must have vocab_term_id and vocab_term_name columns');
    }

    // Parse data rows
    const dataLines = lines.slice(1);
    return dataLines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length < 2) {
            throw new Error(`Invalid row at line ${index + 2}`);
        }
        return {
            vocab_term_id: parts[0],
            vocab_term_name: parts[1],
        };
    }).filter(c => c.vocab_term_id && c.vocab_term_name);
}

function parseJSON(text: string): ConceptCreate[] {
    const data = JSON.parse(text);

    if (Array.isArray(data)) {
        return data.map(item => ({
            vocab_term_id: item.vocab_term_id || item.id || String(item),
            vocab_term_name: item.vocab_term_name || item.name || String(item),
        }));
    }

    if (data.concepts && Array.isArray(data.concepts)) {
        return data.concepts.map((c: { vocab_term_id?: string; id?: string; vocab_term_name?: string; name?: string }) => ({
            vocab_term_id: c.vocab_term_id || c.id || '',
            vocab_term_name: c.vocab_term_name || c.name || '',
        }));
    }

    throw new Error('Invalid JSON format');
}

// ================================================
// Component
// ================================================

const VocabularyUpload = () => {
    const [file, setFile] = useState<File | null>(null);
    const [vocabularyName, setVocabularyName] = useState('');
    const [version, setVersion] = useState('1.0');
    const [isUploading, setIsUploading] = useState(false);
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
        setError(null);

        try {
            // Read file content
            const text = await file.text();
            let concepts: ConceptCreate[];

            // Parse based on file type
            if (file.name.endsWith('.json')) {
                concepts = parseJSON(text);
            } else {
                concepts = parseCSV(text);
            }

            if (concepts.length === 0) {
                throw new Error('No concepts found in file');
            }

            // Create vocabulary
            await addVocabulary({
                name: vocabularyName.trim(),
                version: version.trim(),
                concepts,
            });

            // Navigate back to vocabularies list
            navigate('/vocabularies');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload vocabulary');
        } finally {
            setIsUploading(false);
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
                                    label={isUploading ? 'Uploading...' : 'Upload Vocabulary'}
                                    onClick={() => {}}
                                />
                            </div>
                        </form>
                    </div>

                    <aside className={styles.instructions}>
                        <h2 className={styles.instructionsTitle}>Instructions</h2>
                        <div className={styles.instructionsContent}>
                            <p>
                                Upload your vocabulary file in CSV or JSON format. The file should contain
                                the concepts with their IDs and names.
                            </p>
                            <p>
                                <strong>CSV format:</strong> The file should have a header row with
                                "vocab_term_id" and "vocab_term_name" columns.
                            </p>
                            <p>
                                <strong>JSON format:</strong> The file should contain an array of
                                objects with "vocab_term_id" and "vocab_term_name" fields.
                            </p>
                            <p>
                                The vocabulary will be indexed for semantic search after upload.
                                Maximum file size: 50MB.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </Layout>
    );
};

export default VocabularyUpload;

