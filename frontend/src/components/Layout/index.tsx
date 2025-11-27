import NavBar from 'components/NavBar';
import styles from './styles.module.css';

// ================================================
// Interface
// ================================================

export interface LayoutProps {
    children: React.ReactNode;
    sidebar?: React.ReactNode;
}

// ================================================
// Component
// ================================================

const Layout = ({ children, sidebar }: LayoutProps) => {
    return (
        <div className={styles.layout}>
            <NavBar />
            <div className={styles.container}>
                {sidebar && (
                    <aside className={styles.sidebar}>
                        {sidebar}
                    </aside>
                )}
                <main className={styles.main}>
                    {children}
                </main>
            </div>
            <footer className={styles.footer}>
                <span>© 2023-2027 PREPARE Project.</span>
            </footer>
        </div>
    );
};

export default Layout;

