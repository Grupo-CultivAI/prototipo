/**
 * A safra do ano no estado, para comparar a colheita do produtor com a média e para dizer quando
 * o ano foi ruim no estado todo: estimativas do Levantamento Sistemático da Produção Agrícola do
 * IBGE (src/lib/dados/safra-estadual.json, gerado por scripts/gerar-safra-estadual.mjs).
 * Em "meu feijão tá dando pouco", a IA não tinha nenhum número de referência.
 */
// "with": o node, nos testes (tests/checagens.mjs), só importa JSON com o tipo declarado
import tabela from './dados/safra-estadual.json' with { type: 'json' };

type Tabela = { mes: string; ano: number; anoAnterior: number; produtos: string[]; ufs: Record<string, Record<string, (number | null)[]>> };
const { mes, ano, anoAnterior, produtos, ufs } = tabela as unknown as Tabela;

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‐-―−]/g, '-').toLowerCase();

// Palavra que, no perfil ou na pergunta, aponta para cada cultura da tabela (pelo começo do nome)
const PALAVRAS: [RegExp, RegExp][] = [
    [/\bfeij(ao|oes)\b|\bcaupi\b/, /^feijao/],
    [/\bmilho\b(?!\s*safrinha)/, /^milho \(1/],
    [/\bmilho\b|\bsafrinha\b/, /^milho \(2/],
    [/\bsoja\b/, /^soja/],
    [/\bmandioca|\baipim|\bmacaxeira/, /^mandioca/],
    [/\barroz\b/, /^arroz/],
    [/\btrigo\b/, /^trigo/],
    [/\bsorgo\b/, /^sorgo/],
    [/\baveia\b/, /^aveia/],
    [/\balgodao\b/, /^algodao/],
    [/\bamendoim\b/, /^amendoim/],
    [/\bcafe\b/, /^cafe/],
    [/\bcana\b/, /^cana/],
    [/\bbanana\b/, /^banana/],
    [/\blaranja\b/, /^laranja/],
    [/\bbatata\b(?![- ]doce)/, /^batata/],
    [/\bcebola\b/, /^cebola/],
    [/\btomate\b/, /^tomate/],
    [/\bfumo\b|\btabaco\b/, /^fumo/],
    [/\bcacau\b/, /^cacau/],
    [/\bgirassol\b/, /^girassol/],
];
// Grãos vendidos em sacas de 60 kg (o arroz, em sacas de 50 kg)
const SACA: [RegExp, number][] = [[/^(feijao|milho|soja|trigo|sorgo|cafe|aveia)/, 60], [/^arroz/, 50]];
// Para não encher o prompt: no máximo estas linhas
const MAXIMO_DE_LINHAS = 4;

const numero = (n: number) => n.toLocaleString('pt-BR');
const toneladas = (kg: number) => (kg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (atual: number, antes: number) => Math.round((100 * (atual - antes)) / antes);
// "12% a mais", "5% a menos", "igual" (o mesmo para "maior" e "menor")
const variacao = (atual: number, antes: number, [mais, menos]: [string, string]) => {
    const p = pct(atual, antes);
    return p > 0 ? `${p}% ${mais}` : p < 0 ? `${-p}% ${menos}` : 'igual';
};

function linha(uf: string, nome: string, [rendimento, rendimentoAntes, producao, producaoAntes]: (number | null)[]): string | null {
    if (!rendimento) return null;
    const chave = sem(nome);
    const saca = SACA.find(([r]) => r.test(chave))?.[1];
    // Mandioca, cana, laranja: em toneladas por hectare
    const emToneladas = rendimento >= 10_000;
    const valor = emToneladas ? `${toneladas(rendimento)} toneladas por hectare` : `${numero(rendimento)} quilos por hectare`;
    const sacas = saca ? ` (cerca de ${Math.round(rendimento / saca)} sacas de ${saca} quilos)` : '';
    const comparacao = rendimentoAntes
        ? `; em ${anoAnterior}, ${emToneladas ? toneladas(rendimentoAntes) : numero(rendimentoAntes)} (${variacao(rendimento, rendimentoAntes, ['a mais agora', 'a menos agora'])})`
        : '';
    const producaoDoEstado = producao && producaoAntes ? `; produção do estado: ${variacao(producao, producaoAntes, ['maior', 'menor'])} que em ${anoAnterior}` : '';
    return `- ${nome.replace('Safra', 'safra')} em ${uf}: rendimento médio estimado em ${ano} de ${valor}${sacas}${comparacao}${producaoDoEstado}.`;
}

/** As linhas da safra do estado para as culturas citadas no texto (perfil e pergunta), ou null. */
export function safraDoEstado(estado: string | null | undefined, texto: string): string | null {
    const uf = String(estado ?? '').trim().toUpperCase();
    const doEstado = ufs[uf];
    if (!doEstado) return null;
    const t = sem(texto);
    const linhas = produtos
        .map((nome, i) => [nome, i] as const)
        .filter(([nome]) => PALAVRAS.some(([noTexto, naTabela]) => noTexto.test(t) && naTabela.test(sem(nome))))
        .map(([nome, i]) => (doEstado[i] ? linha(uf, nome, doEstado[i]) : null))
        .filter((l): l is string => Boolean(l))
        .slice(0, MAXIMO_DE_LINHAS);
    return linhas.length ? linhas.join('\n') : null;
}

/** Ex.: "IBGE, levantamento de setembro 2026" */
export const FONTE_DA_SAFRA = `IBGE, levantamento de ${mes}`;
