import Sidebar from '@/components/Sidebar';
import styles from './paginas.module.css';

export default function AuthedLayout({ children }) {
    return (
        <div className={styles.shell} style={{ display: 'flex', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-text)' }}>
            <Sidebar />
            <main className={styles.conteudo} style={{ flex: 1, overflowY: 'auto' }}>
                <div className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', height: '100%', animation: 'fadeIn 0.5s ease' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
