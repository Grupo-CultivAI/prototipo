/**
 * Em que parte do estado fica o cultivo: a micro e a mesorregião do IBGE, pelo código do
 * município que o perfil já tem (src/lib/dados/mesorregioes.json, gerado por
 * scripts/gerar-mesorregioes.mjs). Sem chamar a API do IBGE a cada pergunta.
 * As regras de clima por mesorregião ficam em src/lib/estacao.ts.
 */
// "with": o node, nos testes (tests/checagens.mjs), só importa JSON com o tipo declarado
import tabela from './dados/mesorregioes.json' with { type: 'json' };

type Tabela = {
    municipios: Record<string, number>;
    microrregioes: Record<string, [string, number]>;
    mesorregioes: Record<string, [string, string]>;
    centros: Record<string, [number, number]>;
};
const { municipios, microrregioes, mesorregioes, centros } = tabela as unknown as Tabela;

/** O centro do município (IBGE), para quando o cultivo não tem o ponto marcado no mapa. */
export function centroDoMunicipio(codigo?: string | null): { lat: number; lng: number } | null {
    const centro = centros[String(codigo ?? '').trim()];
    return centro ? { lat: centro[0], lng: centro[1] } : null;
}

export type LocalDoCultivo = { mesorregiao: number; nomeDaMesorregiao: string; microrregiao: number; uf: string };

/** A mesorregião do município (geocódigo do IBGE, 7 dígitos), ou null. */
export function localDoMunicipio(codigo?: string | null): LocalDoCultivo | null {
    const micro = municipios[String(codigo ?? '').trim()];
    if (!micro) return null;
    const [, meso] = microrregioes[micro];
    const [nome, uf] = mesorregioes[meso];
    return { mesorregiao: meso, nomeDaMesorregiao: nome, microrregiao: micro, uf };
}
