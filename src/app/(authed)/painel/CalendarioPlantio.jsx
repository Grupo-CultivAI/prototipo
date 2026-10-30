import { inicioDoDecendio, fimDoDecendio } from '@/lib/zarc-formato.mjs';
import { decendioDeHoje, situacaoDaJanela as situacao } from '@/lib/janelaDePlantio';
import styles from './painel.module.css';

// Faixa do ano de cada cultura do perfil, com as janelas de plantio do ZARC (36 decêndios,
// períodos de 10 dias) e a marca de hoje. Verde mais escuro = menor risco de perder a lavoura.
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const NIVEIS = [
    { risco: 20, classe: 'risco20', rotulo: 'Risco 20%' },
    { risco: 30, classe: 'risco30', rotulo: 'Risco 30%' },
    { risco: 40, classe: 'risco40', rotulo: 'Risco 40%' },
];
const classeDoRisco = (r) => styles[NIVEIS.find((n) => n.risco === r)?.classe ?? 'risco0'];

export default function CalendarioPlantio({ linhas }) {
    const hoje = decendioDeHoje();
    return (
        <div className={styles.calendario}>
            <div className={styles.calendarioLinha} aria-hidden="true">
                <span />
                <div className={styles.meses}>
                    {MESES.map((m) => <span key={m}>{m}</span>)}
                </div>
            </div>
            <ul className={styles.calendarioLista}>
                {linhas.map(({ cultura, manejo, riscos, proxima }) => {
                    const { agora, texto } = situacao(riscos, hoje);
                    return (
                        <li key={cultura} className={styles.calendarioLinha}>
                            <div className={styles.cultura}>
                                <strong>{cultura}</strong>
                                <span className={styles.detalhe}>
                                    {manejo}{proxima && <span className={styles.selo}>próxima</span>}
                                </span>
                            </div>
                            <div>
                                <div className={styles.faixa}>
                                    {Array.from({ length: 36 }, (_, i) => {
                                        const r = riscos?.[i] ?? 0;
                                        const periodo = `${inicioDoDecendio(i + 1)} a ${fimDoDecendio(i + 1)}`;
                                        return (
                                            <span key={i} className={`${styles.celula} ${classeDoRisco(r)} ${i === hoje ? styles.hoje : ''}`}
                                                title={`${periodo}: ${r ? `risco ${r}%` : 'plantio não indicado'}${i === hoje ? ' (hoje)' : ''}`} />
                                        );
                                    })}
                                </div>
                                <p className={`${styles.situacao} ${agora ? styles.situacaoAgora : ''}`}>{texto}</p>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className={styles.legenda}>
                {NIVEIS.map(({ classe, rotulo }) => (
                    <span key={classe}><i className={`${styles.amostra} ${styles[classe]}`} />{rotulo}</span>
                ))}
                <span><i className={`${styles.amostra} ${styles.risco0}`} />Não indicado</span>
                <span><i className={`${styles.amostra} ${styles.amostraHoje}`} />Hoje</span>
            </div>
        </div>
    );
}
