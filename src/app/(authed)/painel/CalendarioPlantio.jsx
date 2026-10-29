import { inicioDoDecendio, fimDoDecendio } from '@/lib/zarc-formato.mjs';
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

// Decêndio de hoje (0 a 35), no horário de Brasília.
function decendioDeHoje() {
    const [dia, mes] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'numeric' })
        .format(new Date()).split('/').map(Number);
    return (mes - 1) * 3 + (dia <= 10 ? 0 : dia <= 20 ? 1 : 2);
}

// Em frase: dentro da janela (até quando) ou quando ela abre.
function situacao(riscos, hoje) {
    if (!riscos) return { agora: false, texto: 'Não indicado para o seu tipo de solo' };
    if (!riscos.some(Boolean)) return { agora: false, texto: 'Plantio não indicado no município' };
    if (riscos[hoje]) {
        let fim = hoje;
        while (fim - hoje < 35 && riscos[(fim + 1) % 36]) fim++;
        return { agora: true, texto: `Época de plantio agora, até ${fimDoDecendio((fim % 36) + 1)} (risco ${riscos[hoje]}%)` };
    }
    for (let k = 1; k < 36; k++) {
        const i = (hoje + k) % 36;
        if (riscos[i]) return { agora: false, texto: `A janela abre em ${inicioDoDecendio(i + 1)}` };
    }
    return { agora: false, texto: '' };
}

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
