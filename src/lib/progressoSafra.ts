/**
 * Como anda o plantio e a colheita no estado do produtor: o "Progresso de Safra" semanal da Conab
 * (src/lib/dados/progresso-safra.json, gerado por scripts/gerar-progresso-safra.mjs). Responde a
 * "já tá na hora de plantar?" e "tô atrasado?" com o que os produtores do estado estão fazendo,
 * ao lado do ZARC, que diz a época segura do município.
 */
// "with": o node, nos testes (tests/checagens.mjs), só importa JSON com o tipo declarado
import tabela from './dados/progresso-safra.json' with { type: 'json' };

type Etapa = { nome: string; safra: string; etapa: 'semeadura' | 'colheita'; ufs: Record<string, (number | null)[]> };
type Tabela = { semana: string; culturas: Etapa[] };
const { semana, culturas } = tabela as unknown as Tabela;

// Passado disso, os números já não dizem como anda a safra agora (a planilha sai toda semana)
export const VALIDADE_EM_DIAS = 21;
const MAXIMO_DE_LINHAS = 4;
// Diferença, em pontos percentuais, para dizer que o estado está adiantado ou atrasado
const DIFERENCA_DA_MEDIA = 5;

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Palavra do perfil ou da pergunta → nome da cultura na planilha da Conab
const PALAVRAS: [RegExp, RegExp][] = [
    [/\bfeij(ao|oes)\b|\bcaupi\b/, /^feijao/],
    [/\bmilho\b(?!\s*safrinha)/, /^milho 1/],
    [/\bmilho\b|\bsafrinha\b/, /^milho 2/],
    [/\bsoja\b/, /^soja/],
    [/\barroz\b/, /^arroz/],
    [/\btrigo\b/, /^trigo/],
    [/\balgodao\b/, /^algodao/],
];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const [ano, mes, dia] = semana.split('-');

function linha(c: Etapa, uf: string, [anoPassado, semanaAnterior, atual, media]: (number | null)[]): string | null {
    // Etapa que nem começou (a colheita do arroz em outubro): nada a dizer
    if (atual == null || (atual === 0 && !media)) return null;
    const feito = c.etapa === 'semeadura' ? 'semeada' : 'colhida (do que foi semeado)';
    const comparacoes = [
        semanaAnterior != null && `uma semana antes, ${pct(semanaAnterior)}`,
        anoPassado != null && `na mesma época do ano passado, ${pct(anoPassado)}`,
        media != null && `média de 5 anos, ${pct(media)}`,
    ].filter(Boolean).join('; ');
    const ritmo = media == null ? ''
        : (atual - media) * 100 >= DIFERENCA_DA_MEDIA ? ' Está adiantada em relação à média.'
            : (media - atual) * 100 >= DIFERENCA_DA_MEDIA ? ' Está atrasada em relação à média.' : ' Está perto da média.';
    const nome = c.nome.replace(/(\d)ª$/, '$1ª safra');
    return `- ${nome} ${c.safra} em ${uf}: ${pct(atual)} da área ${feito} até ${dia}/${mes}${comparacoes ? ` (${comparacoes})` : ''}.${ritmo}`;
}

/** As linhas do andamento da safra no estado para as culturas citadas no texto, ou null. */
export function progressoNoEstado(estado: string | null | undefined, texto: string, hoje = new Date()): string | null {
    const dias = (hoje.getTime() - Date.UTC(Number(ano), Number(mes) - 1, Number(dia))) / 86_400_000;
    if (dias > VALIDADE_EM_DIAS) return null;
    const uf = String(estado ?? '').trim().toUpperCase();
    const t = sem(texto);
    const linhas = culturas
        .filter((c) => c.ufs[uf] && PALAVRAS.some(([noTexto, naPlanilha]) => noTexto.test(t) && naPlanilha.test(sem(c.nome))))
        .map((c) => linha(c, uf, c.ufs[uf]))
        .filter((l): l is string => Boolean(l))
        .slice(0, MAXIMO_DE_LINHAS);
    return linhas.length ? linhas.join('\n') : null;
}

/** Data de referência dos números ("2026-10-30"), para os testes não dependerem do dia em que rodam */
export const SEMANA_DO_PROGRESSO = semana;

/** Ex.: "Conab, semana até 30/10/2026" */
export const FONTE_DO_PROGRESSO = `Conab, semana até ${dia}/${mes}/${ano}`;
