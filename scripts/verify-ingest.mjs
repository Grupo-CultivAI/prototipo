import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const [pergunta, pdfEsperado] = process.argv.slice(2);
const TOP_K = 3;
const MIN_SCORE = Number(process.env.RAG_MIN_SCORE ?? 0.5);

if (!pergunta) {
    console.error('Uso: node scripts/verify-ingest.mjs "<pergunta>" [nome-do-pdf-esperado.pdf]');
    process.exit(1);
}

const host = process.env.PINECONE_INDEX_HOST?.replace(/^https?:\/\//, '');
const pineconeApiKey = process.env.PINECONE_API_KEY;
const namespace = process.env.PINECONE_NAMESPACE || 'embrapa';
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!host || !pineconeApiKey || !geminiApiKey) {
    console.error('❌ PINECONE_INDEX_HOST, PINECONE_API_KEY e GEMINI_API_KEY são obrigatórios no .env.local');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// RETRIEVAL_QUERY (e não RETRIEVAL_DOCUMENT, usado na ingestão): usar o taskType
// errado aqui derruba os scores e faz a verificação acusar falha onde não há.
const res = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: pergunta,
    config: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' },
});
const vector = res.embedding?.values || res.embeddings?.[0]?.values || res.values;

const qRes = await fetch(`https://${host}/query`, {
    method: 'POST',
    headers: {
        'Api-Key': pineconeApiKey,
        'Content-Type': 'application/json',
        'X-Pinecone-Api-Version': '2025-04',
    },
    body: JSON.stringify({ vector, topK: TOP_K, includeMetadata: true, namespace }),
});

if (!qRes.ok) {
    console.error(`❌ Pinecone HTTP ${qRes.status}: ${await qRes.text()}`);
    process.exit(1);
}

const matches = (await qRes.json()).matches || [];

console.log(`\n❓ Pergunta: "${pergunta}"`);
if (pdfEsperado) console.log(`🎯 PDF esperado: ${pdfEsperado}`);
console.log(`📐 Limiar de score: ${MIN_SCORE}\n`);

if (matches.length === 0) {
    console.log('❌ Nenhum resultado retornado. O namespace está vazio ou a pergunta não casou com nada.');
    process.exit(1);
}

let acimaDoLimiar = 0;
let doPdfEsperado = 0;

matches.forEach((m, i) => {
    const fonte = m.metadata?.fonte ?? '(sem fonte)';
    const texto = String(m.metadata?.texto ?? '');
    const okScore = m.score >= MIN_SCORE;
    const okFonte = !pdfEsperado || fonte === pdfEsperado;

    if (okScore) acimaDoLimiar++;
    if (okFonte) doPdfEsperado++;

    console.log(`${i + 1}. [${okScore && okFonte ? '✅' : '⚠️ '}] score ${m.score.toFixed(4)} — ${fonte}`);
    console.log(`   "${texto.slice(0, 160).replace(/\s+/g, ' ')}..."\n`);
});

console.log(`Resumo: ${acimaDoLimiar}/${matches.length} acima de ${MIN_SCORE}` +
    (pdfEsperado ? ` | ${doPdfEsperado}/${matches.length} vindos de ${pdfEsperado}` : ''));

const aprovado = acimaDoLimiar === TOP_K && (!pdfEsperado || doPdfEsperado === TOP_K);
console.log(aprovado ? '\n✅ APROVADO' : '\n❌ REPROVADO — revisar este PDF');
process.exit(aprovado ? 0 : 1);
