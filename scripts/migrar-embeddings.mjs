// Copia a base de um namespace do Pinecone para o namespace do modelo de embedding atual
// (src/lib/embeddings.mjs), gerando os vetores de novo a partir do texto de cada trecho.
// Os ids e os metadados (texto, fonte, página) ficam iguais; o namespace de origem não é
// alterado, então dá para comparar e voltar atrás.
//
// Feito para a troca do Gemini pelo Pinecone Inference em 28/10/2026. Parte da base e não
// dos PDFs: documentos retirados da base (duplicatas, versões antigas) não voltam.
//
// Uso:
//   node scripts/migrar-embeddings.mjs                    → conta os trechos, não grava nada
//   node scripts/migrar-embeddings.mjs --confirmar        → gera os vetores e grava
//   node scripts/migrar-embeddings.mjs --origem embrapa   → namespace de origem (padrão: embrapa)
import dotenv from 'dotenv';
import { DIMENSOES, MODELO_EMBEDDING, NAMESPACE_DA_BASE, gerarEmbeddings } from '../src/lib/embeddings.mjs';
dotenv.config({ path: '.env.local', quiet: true });

const args = process.argv.slice(2);
const confirmar = args.includes('--confirmar');
const origem = args.includes('--origem') ? args[args.indexOf('--origem') + 1] : 'embrapa';
const destino = NAMESPACE_DA_BASE;
const host = process.env.PINECONE_INDEX_HOST?.replace(/^https?:\/\//, '');
const apiKey = process.env.PINECONE_API_KEY;
if (!host || !apiKey) {
    console.error('❌ PINECONE_INDEX_HOST e PINECONE_API_KEY são obrigatórios no .env.local');
    process.exit(1);
}
if (origem === destino) {
    console.error('❌ Origem e destino são o mesmo namespace.');
    process.exit(1);
}
const cabecalhos = { 'Api-Key': apiKey, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2025-04' };

async function pinecone(caminho, opcoes = {}) {
    const res = await fetch(`https://${host}${caminho}`, { headers: cabecalhos, ...opcoes });
    if (!res.ok) throw new Error(`Pinecone ${caminho.split('?')[0]} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
}

// 1. Todos os ids da origem
const ids = [];
let pagina;
do {
    const url = new URLSearchParams({ namespace: origem, limit: '100', ...(pagina ? { paginationToken: pagina } : {}) });
    const lista = await pinecone(`/vectors/list?${url}`);
    ids.push(...(lista.vectors ?? []).map((v) => v.id));
    pagina = lista.pagination?.next;
} while (pagina);

// 2. Metadados (texto, fonte, página) de cada trecho
const trechos = [];
for (let i = 0; i < ids.length; i += 100) {
    const url = new URLSearchParams({ namespace: origem });
    ids.slice(i, i + 100).forEach((id) => url.append('ids', id));
    const { vectors } = await pinecone(`/vectors/fetch?${url}`);
    for (const id of ids.slice(i, i + 100)) {
        const metadata = vectors?.[id]?.metadata;
        if (typeof metadata?.texto !== 'string' || !metadata.texto.trim()) throw new Error(`trecho sem texto nos metadados: ${id}`);
        trechos.push({ id, metadata });
    }
}

const documentos = new Set(trechos.map((t) => t.metadata.fonte));
const caracteres = trechos.reduce((s, t) => s + t.metadata.texto.length, 0);
console.log(`\nOrigem "${origem}": ${trechos.length} trechos de ${documentos.size} documentos (~${Math.round(caracteres / 4).toLocaleString('pt-BR')} tokens).`);
console.log(`Destino "${destino}": modelo ${MODELO_EMBEDDING}, ${DIMENSOES} dimensões.`);

if (!confirmar) {
    console.log('\nNada foi gravado. Para gerar os vetores e gravar, rode de novo com --confirmar.\n');
    process.exit(0);
}

// 3. Vetores novos e gravação, em lotes
for (let i = 0; i < trechos.length; i += 90) {
    const lote = trechos.slice(i, i + 90);
    const vetores = await gerarEmbeddings(lote.map((t) => t.metadata.texto), { tipo: 'passage', apiKey, tentativas: 5 });
    await pinecone('/vectors/upsert', {
        method: 'POST',
        body: JSON.stringify({ namespace: destino, vectors: lote.map((t, j) => ({ id: t.id, values: vetores[j], metadata: t.metadata })) }),
    });
    process.stdout.write(`\rGravando... ${Math.min(i + 90, trechos.length)}/${trechos.length}`);
}

// 4. Conferência: o índice demora alguns segundos para atualizar a contagem
await new Promise((r) => setTimeout(r, 10_000));
const stats = await pinecone('/describe_index_stats', { method: 'POST', body: '{}' });
console.log(`\n\nNo índice: "${origem}" = ${stats.namespaces?.[origem]?.vectorCount ?? 0} vetores; "${destino}" = ${stats.namespaces?.[destino]?.vectorCount ?? 0} vetores.\n`);
