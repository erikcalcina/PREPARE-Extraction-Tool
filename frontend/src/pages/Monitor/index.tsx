import Layout from "@components/Layout";
import { usePageTitle } from "@hooks/usePageTitle";
import styles from "./styles.module.css";

const Monitor = () => {
  usePageTitle("Monitor");
  return (
    <Layout>
      <div className={styles.monitor}>
        <h1 className={styles.monitor__title}>Monitor</h1>
        <div className={styles.monitor__placeholder}>
          <p>This page is under construction.</p>
          <p>Monitoring features will be available soon.</p>
        </div>
      </div>
    </Layout>
  );
};

export default Monitor;
