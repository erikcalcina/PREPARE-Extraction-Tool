import { Link } from 'react-router-dom';
import Layout from 'components/Layout';
import Table from 'components/Table';
import Button from 'components/Button';
import { useVocabularies } from 'hooks/useVocabularies';
import { usePageTitle } from 'hooks/usePageTitle';
import type { Vocabulary } from 'types';
import styles from './styles.module.css';

// ================================================
// Component
// ================================================

const Vocabularies = () => {
    usePageTitle('Vocabularies');
    const { vocabularies, isLoading, error, removeVocabulary, downloadVocabulary } = useVocabularies();

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const handleDelete = async (vocabulary: Vocabulary) => {
        if (window.confirm(`Are you sure you want to delete "${vocabulary.name}"?`)) {
            try {
                await removeVocabulary(vocabulary.id);
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to delete vocabulary');
            }
        }
    };

    const columns = [
        {
            key: 'name',
            header: 'Name',
            width: '35%',
        },
        {
            key: 'version',
            header: 'Version',
            width: '15%',
        },
        {
            key: 'concept_count',
            header: 'Concepts',
            width: '15%',
            render: (item: Vocabulary) => item.concept_count.toLocaleString(),
        },
        {
            key: 'uploaded',
            header: 'Date uploaded',
            width: '20%',
            render: (item: Vocabulary) => formatDate(item.uploaded),
        },
        {
            key: 'actions',
            header: 'Actions',
            width: '15%',
            render: (item: Vocabulary) => (
                <div className={styles.actions}>
                    <button
                        className={styles.actionLink}
                        onClick={(e) => {
                            e.stopPropagation();
                            downloadVocabulary(item.id);
                        }}
                    >
                        Download
                    </button>
                    <button
                        className={`${styles.actionLink} ${styles.delete}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                        }}
                    >
                        Delete
                    </button>
                </div>
            ),
        },
    ];

    const sidebar = (
        <div className={styles.sidebarContent}>
            <Link to="/vocabularies/upload">
                <Button primary label="+ Upload vocabulary" />
            </Link>
        </div>
    );

    return (
        <Layout sidebar={sidebar}>
            <div className={styles.page}>
                <h1 className={styles.title}>Vocabularies</h1>

                {error && (
                    <div className={styles.error}>
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className={styles.loading}>Loading vocabularies...</div>
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

