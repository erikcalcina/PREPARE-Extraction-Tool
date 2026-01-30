import Layout from 'components/Layout';
import { usePageTitle } from '@/hooks/usePageTitle';
import styles from './styles.module.css';

// ================================================
// Component
// ================================================

const Monitor = () => {
    usePageTitle('Monitor');
    return (
        <Layout>
            <div className={styles.page}>
                <h1 className={styles.title}>Monitor</h1>
                <div className={styles.placeholder}>
                    <p>This page is under construction.</p>
                    <p>Monitoring features will be available soon.</p>
                </div>
            </div>
        </Layout>
    );
};

export default Monitor;

