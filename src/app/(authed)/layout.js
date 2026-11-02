import Sidebar from '@/components/Sidebar';
import styles from './paginas.module.css';

export default function AuthedLayout({ children }) {
    return (
        <div className={styles.shell} style={{ display: 'flex', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-text)' }}>
            <Sidebar />
            {/* minWidth: 0 impede o conteúdo de vazar para os lados. Era overflowY: 'auto', que fazia
                o mesmo, mas prendia o position: sticky (barra de salvar do formulário) dentro do main,
                que não rola: quem rola é a janela, e o chat rola na própria lista de mensagens. */}
            <main className={styles.conteudo} style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', height: '100%', animation: 'fadeIn 0.5s ease' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
