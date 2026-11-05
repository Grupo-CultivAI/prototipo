/**
 * O que mais se planta no município: as culturas com mais área colhida na Produção Agrícola
 * Municipal do IBGE (src/lib/dados/producao-municipal.json, gerado por
 * scripts/gerar-producao-municipal.mjs). Entra no perfil enviado à IA, para a rotação sugerida
 * usar culturas que têm mercado e prática na região.
 */
// "with": o node, nos testes (tests/checagens.mjs), só importa JSON com o tipo declarado
import tabela from './dados/producao-municipal.json' with { type: 'json' };

type Tabela = { ano: string; produtos: string[]; perenes: number[]; municipios: Record<string, number[]> };
const { ano, produtos, perenes, municipios } = tabela as unknown as Tabela;

/** Ex.: "Mais plantadas no município (IBGE, área colhida em 2025): mandioca (839 ha), limão (788 ha, perene)". */
export function culturasDoMunicipio(codigo?: string | null): string | null {
    const pares = municipios[String(codigo ?? '').trim()];
    if (!pares?.length) return null;
    const culturas: string[] = [];
    for (let i = 0; i < pares.length; i += 2) {
        // Perene: pomar, café, cacau... não é cultura para "a próxima safra"
        const perene = perenes.includes(pares[i]) ? ', perene' : '';
        culturas.push(`${produtos[pares[i]].toLowerCase()} (${pares[i + 1].toLocaleString('pt-BR')} ha${perene})`);
    }
    return `Mais plantadas no município (IBGE, área colhida em ${ano}): ${culturas.join(', ')}`;
}
