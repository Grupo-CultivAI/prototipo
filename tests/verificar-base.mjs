import fs from 'node:fs';
import { LIMIAR_RELEVANCIA, MODELO_EMBEDDING, NAMESPACE_DA_BASE, gerarEmbeddings } from '../src/lib/embeddings.mjs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ARQUIVO_CASOS = new URL('./casos-verificacao.json', import.meta.url);
// O limiar vem do modelo de embedding (src/lib/embeddings.mjs): a escala muda de um modelo para outro.
const limiarScore = LIMIAR_RELEVANCIA;
const { topK, casos } = JSON.parse(fs.readFileSync(ARQUIVO_CASOS, 'utf-8'));

const host = process.env.PINECONE_INDEX_HOST?.replace(/^https?:\/\//, '');
const pineconeApiKey = process.env.PINECONE_API_KEY;
const namespace = NAMESPACE_DA_BASE;

if (!host || !pineconeApiKey) {
    console.error('❌ PINECONE_INDEX_HOST e PINECONE_API_KEY são obrigatórios no .env.local');
    process.exit(1);
}

async function buscar(pergunta) {
    const [vector] = await gerarEmbeddings([pergunta], { tipo: 'query', apiKey: pineconeApiKey, tentativas: 3 });

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
        if (/429/.test(e.message)) {
            console.error('   Limite por minuto do Pinecone Inference. Rode novamente em 1 minuto.');
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

console.log(`\nModelo: ${MODELO_EMBEDDING} | limiar: ${limiarScore} | topK: ${topK} | casos: ${casos.length}\n`);
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
