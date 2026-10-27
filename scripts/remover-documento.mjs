// Tira um documento da base: apaga os trechos dele no Pinecone, tira do .ingest-state.json e
// move o PDF (e o .txt acompanhante, se houver) para docs-embrapa/_removidos/, para a
// próxima ingestão não o colocar de volta.
//
// Uso:
//   node scripts/remover-documento.mjs arquivo.pdf              → só mostra o que seria apagado
//   node scripts/remover-documento.mjs arquivo.pdf --confirmar  → apaga
//
// O índice é o mesmo da produção: o documento some das respostas na hora.
// Não consome cota do Gemini. Lembre de tirar a linha dele de src/lib/documentos.json.
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const [arquivo] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const confirmar = process.argv.includes('--confirmar');
const PASTA = './docs-embrapa';
const ESTADO = './.ingest-state.json';
const host = (process.env.PINECONE_INDEX_HOST || '').replace(/^https?:\/\//, '');
const namespace = process.env.PINECONE_NAMESPACE || 'embrapa';
const cabecalhos = { 'Api-Key': process.env.PINECONE_API_KEY, 'X-Pinecone-Api-Version': '2025-04', 'Content-Type': 'application/json' };

if (!arquivo) {
    console.error('Uso: node scripts/remover-documento.mjs arquivo.pdf [--confirmar]');
    process.exit(1);
}
if (!host || !process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_INDEX_HOST e PINECONE_API_KEY são obrigatórios no .env.local');
    process.exit(1);
}

// Mesmo formato de id de scripts/ingest-pdfs.mjs.
const prefixo = `${arquivo.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_`;

const ids = [];
let token;
do {
    const url = new URL(`https://${host}/vectors/list`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('prefix', prefixo);
    if (token) url.searchParams.set('paginationToken', token);
    const res = await fetch(url, { headers: cabecalhos });
    if (!res.ok) throw new Error(`Pinecone ${res.status}: ${await res.text()}`);
    const dados = await res.json();
    ids.push(...(dados.vectors || []).map((v) => v.id));
    token = dados.pagination?.next;
} while (token);

console.log(`\n📄 ${arquivo}: ${ids.length} trecho(s) no índice (namespace "${namespace}")`);
if (!confirmar) {
    console.log('   Nada foi apagado. Para apagar, rode de novo com --confirmar.\n');
    process.exit(0);
}

for (let i = 0; i < ids.length; i += 1000) {
    const res = await fetch(`https://${host}/vectors/delete`, {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify({ ids: ids.slice(i, i + 1000), namespace }),
    });
    if (!res.ok) throw new Error(`Pinecone ${res.status}: ${await res.text()}`);
}
console.log(`   🗑️  ${ids.length} trecho(s) apagado(s) do Pinecone.`);

if (fs.existsSync(ESTADO)) {
    const estado = JSON.parse(fs.readFileSync(ESTADO, 'utf-8'));
    const antes = estado.processedFiles?.length ?? 0;
    estado.processedFiles = (estado.processedFiles || []).filter((f) => f !== arquivo);
    estado.failedFiles = (estado.failedFiles || []).filter((f) => (f.file ?? f) !== arquivo);
    fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2));
    console.log(`   .ingest-state.json: ${antes} → ${estado.processedFiles.length} arquivo(s) processado(s).`);
}

const destino = path.join(PASTA, '_removidos');
for (const nome of new Set([arquivo, arquivo.replace(/\.pdf$/i, '.txt')])) {
    const origem = path.join(PASTA, nome);
    if (fs.existsSync(origem)) {
        fs.mkdirSync(destino, { recursive: true });
        fs.renameSync(origem, path.join(destino, nome));
        console.log(`   📁 ${nome} movido para ${destino}/`);
    }
}
console.log(`\n   Falta: tirar a linha de "${arquivo}" de src/lib/documentos.json.\n`);
