import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ARQUIVO_CASOS = new URL('./casos-verificacao.json', import.meta.url);
const { limiarScore, topK, casos } = JSON.parse(fs.readFileSync(ARQUIVO_CASOS, 'utf-8'));

const host = process.env.PINECONE_INDEX_HOST?.replace(/^https?:\/\//, '');
const pineconeApiKey = process.env.PINECONE_API_KEY;
const namespace = process.env.PINECONE_NAMESPACE || 'embrapa';
// Usa a chave dos scripts, se houver, para não gastar a cota do chat (ver ingest-pdfs.mjs).
const geminiApiKey = process.env.GEMINI_API_KEY_INGESTAO || process.env.GEMINI_API_KEY;

if (!host || !pineconeApiKey || !geminiApiKey) {
    console.error('❌ PINECONE_INDEX_HOST, PINECONE_API_KEY e GEMINI_API_KEY são obrigatórios no .env.local');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function buscar(pergunta) {
    // Medido em 25/10/2026: com ou sem taskType os scores saem idênticos; mantido por ser o uso documentado.
    const res = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: pergunta,
        config: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' },
    });
    const vector = res.embedding?.values || res.embeddings?.[0]?.values || res.values;

    const resp = await fetch(`https://${host}/query`, {
        method: 'POST',
        headers: {
            'Api-Key': pineconeApiKey,
            'Content-Type': 'application/json',
            'X-Pinecone-Api-Version': '2025-04',
        },
        body: JSON.stringify({ vector, topK, includeMetadata: true, namespace }),
    });
    if (!resp.ok) throw new Error(`Pinecone HTTP ${resp.status}: ${await resp.text()}`);
    return (await resp.json()).matches || [];
}

const resultados = [];
let passaram = 0;
let falharam = 0;
let conhecidas = 0;

for (const caso of casos) {
    let matches;
    try {
        matches = await buscar(caso.pergunta);
    } catch (e) {
        console.error(`\n❌ Não foi possível consultar: ${e.message.slice(0, 200)}`);
        if (/RESOURCE_EXHAUSTED|quota|429/i.test(e.message)) {
            console.error('   A cota diária do Gemini está esgotada. Rode novamente quando ela renovar.');
        }
        process.exit(2);
    }

    const noAlvo = matches.filter((m) => caso.fontesAceitas.includes(String(m.metadata?.fonte))).length;
    const acimaDoLimiar = matches.filter((m) => m.score >= limiarScore).length;
    const melhor = matches.length ? Math.max(...matches.map((m) => m.score)) : 0;
    const ok = noAlvo === matches.length && acimaDoLimiar === matches.length && matches.length === topK;

    let situacao;
    if (ok) { situacao = 'passou'; passaram++; }
    else if (caso.falhaConhecida) { situacao = 'falha conhecida'; conhecidas++; }
    else { situacao = 'FALHOU'; falharam++; }

    resultados.push({ caso, situacao, melhor, noAlvo, total: matches.length, matches });
}

console.log(`\nLimiar: ${limiarScore} | topK: ${topK} | casos: ${casos.length}\n`);
console.log('situação'.padEnd(17) + 'melhor'.padStart(8) + '  no alvo  ' + 'fonte esperada');
console.log('-'.repeat(96));
for (const r of resultados) {
    console.log(
        r.situacao.padEnd(17) +
        r.melhor.toFixed(4).padStart(8) +
        `   ${r.noAlvo}/${r.total}     ` +
        r.caso.fontesAceitas.join(' ou ').slice(0, 58)
    );
}
console.log('-'.repeat(96));
console.log(`\npassaram: ${passaram} | falharam: ${falharam} | falhas conhecidas: ${conhecidas}`);

for (const r of resultados.filter((x) => x.situacao !== 'passou')) {
    console.log(`\n• ${r.caso.pergunta}`);
    console.log(`  esperado: ${r.caso.fontesAceitas.join(' ou ')}`);
    for (const m of r.matches) {
        const marca = r.caso.fontesAceitas.includes(String(m.metadata?.fonte)) ? '  ok ' : '  !! ';
        console.log(`${marca}${m.score.toFixed(4)}  ${m.metadata?.fonte}  (p. ${m.metadata?.pagina ?? '?'})`);
    }
    if (r.caso.falhaConhecida) console.log(`  falha conhecida: ${r.caso.falhaConhecida}`);
}

// Falha conhecida não derruba a suíte: ela já está documentada e aguarda ação externa.
process.exit(falharam > 0 ? 1 : 0);
