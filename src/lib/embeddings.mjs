// Embeddings da base da Embrapa, usados pelo chat (src/app/api/llm/route.ts) e pelos scripts
// de ingestão e verificação. Gerados pelo Pinecone Inference, com a mesma PINECONE_API_KEY
// do índice e dentro do plano gratuito do Pinecone.
//
// Até 28/10/2026 eram do Gemini (gemini-embedding-001). Naquele dia o Google recusou o plano
// gratuito para o projeto (403 "free tier is not available for this project"), e o chat
// ficou sem busca na base. A base foi migrada com scripts/migrar-embeddings.mjs.
//
// Vetores de modelos diferentes não se comparam: uma pergunta do Llama contra trechos do
// Gemini traz resultados sem sentido, sem dar erro. Por isso o namespace acompanha o modelo
// aqui no código, e não numa variável de ambiente que pode ficar com o valor antigo.
export const MODELO_EMBEDDING = 'llama-text-embed-v2';
export const DIMENSOES = 768;
export const NAMESPACE_DA_BASE = 'embrapa-llama';

// A escala dos scores também muda com o modelo. Medido em 28/10/2026 com o Llama: perguntas
// do tema de 0,37 a 0,57 (as vagas, como "O que plantar depois do milho?", perto de 0,40);
// fora da base ou do tema até 0,30 ("galinhas caipiras" 0,30, "receita de bolo" 0,16).
// Com o Gemini eram 0,65 de limiar e faixas de 0,62 e 0,72 no relatório.
export const LIMIAR_RELEVANCIA = 0.35;
// Faixas do relatório do chat (npm run relatorio-chat), na escala deste modelo
export const FAIXA_FORA_DO_TEMA = 0.32;
export const FAIXA_POUCA_COBERTURA = 0.42;

const LOTE = 90; // o Pinecone aceita até 96 textos por chamada

/**
 * @param {string[]} textos
 * @param {{ tipo: 'query' | 'passage', apiKey: string, tentativas?: number }} opcoes
 *   tipo "query" para a pergunta, "passage" para os trechos da base.
 * @returns {Promise<number[][]>}
 */
export async function gerarEmbeddings(textos, { tipo, apiKey, tentativas = 1 }) {
    const vetores = [];
    for (let i = 0; i < textos.length; i += LOTE) {
        const lote = textos.slice(i, i + LOTE);
        for (let t = 1; ; t++) {
            const res = await fetch('https://api.pinecone.io/embed', {
                method: 'POST',
                headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2025-04' },
                body: JSON.stringify({
                    model: MODELO_EMBEDDING,
                    parameters: { input_type: tipo, dimension: DIMENSOES, truncate: 'END' },
                    inputs: lote.map((text) => ({ text })),
                }),
            });
            if (res.ok) {
                const dados = (await res.json()).data ?? [];
                const valores = dados.map((d) => d.values);
                if (valores.length !== lote.length || valores.some((v) => !Array.isArray(v) || v.length !== DIMENSOES)) {
                    throw new Error('Pinecone Inference devolveu vetores inválidos');
                }
                vetores.push(...valores);
                break;
            }
            const erro = `Pinecone Inference ${res.status}: ${(await res.text()).slice(0, 300)}`;
            // 429 = limite por minuto do plano gratuito: espera e tenta de novo
            if (t >= tentativas || (res.status !== 429 && res.status < 500)) throw new Error(erro);
            await new Promise((r) => setTimeout(r, Math.min(60_000, 5_000 * 2 ** (t - 1))));
        }
    }
    return vetores;
}
