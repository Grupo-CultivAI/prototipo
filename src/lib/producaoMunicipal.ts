/**
 * O que mais se planta no município: as culturas com mais área colhida na Produção Agrícola
 * Municipal do IBGE (src/lib/dados/producao-municipal.json, gerado por
 * scripts/gerar-producao-municipal.mjs). Entra no perfil enviado à IA, para a rotação sugerida
 * usar culturas que têm mercado e prática na região. Em perguntas sobre vender, vão junto o valor
 * bruto por hectare e o preço médio recebido pelo produtor no mesmo ano.
 */
// "with": o node, nos testes (tests/checagens.mjs), só importa JSON com o tipo declarado
import tabela from './dados/producao-municipal.json' with { type: 'json' };

type Tabela = { ano: string; produtos: string[]; perenes: number[]; municipios: Record<string, number[]> };
const { ano, produtos, perenes, municipios } = tabela as unknown as Tabela;

// Cada cultura ocupa 4 números: [índice do produto, hectares, reais por hectare, reais por tonelada]
const CAMPOS = 4;
// Grãos vendidos em sacas (quilos por saca)
const SACA: [RegExp, number][] = [[/^(Feijão|Milho|Soja|Sorgo|Trigo|Café|Aveia)$/, 60], [/^Arroz$/, 50]];
const reais = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;

function preco(nome: string, porTonelada: number): string {
    if (!porTonelada) return '';
    const saca = SACA.find(([r]) => r.test(nome))?.[1];
    return saca ? `; ${reais((porTonelada * saca) / 1000)} a saca de ${saca} quilos` : `; ${reais(porTonelada)} a tonelada`;
}

/**
 * Alerta que acompanha os valores: no teste de 05/11/2026, só com a regra do prompt, a IA chamou o
 * valor por hectare de "mais rentável" e "boa margem de lucro", sem dizer o ano nem os custos.
 */
export const ALERTA_DOS_VALORES = `- Valores de venda: ao citar valor por hectare ou preço da linha "Mais plantadas no município", diga na mesma frase que são de ${ano}, segundo o IBGE, e que o valor por hectare é o que se vendeu, sem descontar os custos. Não chame esses valores de lucro, margem ou rentabilidade, e não diga qual cultura "dá mais dinheiro": a que vale mais por hectare em geral custa mais para plantar.`;

/**
 * Ex.: "Mais plantadas no município (IBGE, área colhida em 2025): mandioca (839 ha), limão (788 ha, perene)".
 * Com valores: "... mandioca (839 ha; R$ 4.144 por hectare; R$ 798 a tonelada), feijão (175 ha; R$ 1.800 por
 * hectare; R$ 182 a saca de 60 quilos)".
 */
export function culturasDoMunicipio(codigo?: string | null, { comValores = false } = {}): string | null {
    const dados = municipios[String(codigo ?? '').trim()];
    if (!dados?.length) return null;
    const culturas: string[] = [];
    for (let i = 0; i < dados.length; i += CAMPOS) {
        const [produto, hectares, porHectare, porTonelada] = dados.slice(i, i + CAMPOS);
        const nome = produtos[produto];
        // Perene: pomar, café, cacau... não é cultura para "a próxima safra"
        const perene = perenes.includes(produto) ? ', perene' : '';
        const valores = comValores && porHectare ? `; ${reais(porHectare)} por hectare${preco(nome, porTonelada)}` : '';
        culturas.push(`${nome.toLowerCase()} (${hectares.toLocaleString('pt-BR')} ha${perene}${valores})`);
    }
    const titulo = comValores
        ? `Mais plantadas no município (IBGE, ${ano}: área colhida; valor da produção por hectare, sem descontar custos; preço médio recebido pelo produtor)`
        : `Mais plantadas no município (IBGE, área colhida em ${ano})`;
    return `${titulo}: ${culturas.join(', ')}`;
}
