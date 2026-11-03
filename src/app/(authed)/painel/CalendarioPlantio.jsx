import { inicioDoDecendio, fimDoDecendio } from '@/lib/zarc-formato.mjs';
import { decendioDeHoje, situacaoDaJanela as situacao } from '@/lib/janelaDePlantio';
import styles from './painel.module.css';

// Faixa do ano de cada cultura do perfil, com as janelas de plantio do ZARC (36 decêndios,
// períodos de 10 dias) e a marca de hoje. Verde mais escuro = menor risco de perder a lavoura.
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const NIVEIS = [
    { risco: 20, classe: 'risco20', rotulo: 'Risco 20% (o menor)' },
    { risco: 30, classe: 'risco30', rotulo: 'Risco 30%' },
    { risco: 40, classe: 'risco40', rotulo: 'Risco 40% (o maior)' },
];
const classeDoRisco = (r) => styles[NIVEIS.find((n) => n.risco === r)?.classe ?? 'risco0'];

export default function CalendarioPlantio({ linhas }) {
    const hoje = decendioDeHoje();
    return (
        <div className={styles.calendario}>
            <div className={styles.calendarioLinha} aria-hidden="true">
                <span />
                <div className={styles.meses}>
                    {/* Inicial e nome: a coluna estreita mostra só a inicial (ver .mesInicial) */}
                    {MESES.map((m) => <span key={m}><span className={styles.mesNome}>{m}</span><span className={styles.mesInicial}>{m[0].toUpperCase()}</span></span>)}
                </div>
            </div>
            <ul className={styles.calendarioLista}>
                {linhas.map(({ cultura, manejo, riscos, proxima }) => {
                    const { agora, texto } = situacao(riscos);
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
                                                title={`${periodo}: ${r ? `${r}% de risco de perder a lavoura por clima${r === 20 ? ' (o menor)' : ''}` : 'plantio não indicado'}${i === hoje ? ' (hoje)' : ''}`} />
                                        );
                                    })}
                                </div>
                                <p className={`${styles.situacao} ${agora ? styles.situacaoAgora : ''}`}>{texto}</p>
                            </div>
                        </li>
                    );
                })}
            </ul>
            {/* Sem isto, "risco 20%" parecia coisa ruim para quem não conhece o ZARC */}
            <p className={styles.explicacaoRisco}>
                <strong>O que é o risco:</strong> a chance de perder a lavoura por causa do clima (seca, geada, chuva demais)
                se plantar naquele período. <strong>Quanto menor, melhor</strong>: 20% é o período mais seguro. Em cinza, o ZARC
                não indica o plantio, porque o risco passa de 40%.
            </p>
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
