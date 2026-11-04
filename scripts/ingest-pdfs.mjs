import fs from 'node:fs';
import path from 'node:path';
import { extractText } from 'unpdf';
import dotenv from 'dotenv';
import { NAMESPACE_DA_BASE, gerarEmbeddings } from '../src/lib/embeddings.mjs';
dotenv.config({ path: '.env.local' });

// Uso: node scripts/ingest-pdfs.mjs [pasta] [--namespace nome] [--corte frase] [--tamanho 800]
// Sem opções, grava na base que o chat usa (NAMESPACE_DA_BASE), com o corte por tamanho.
// --namespace grava em outro namespace do índice, para testar uma mudança sem tocar na base em
// uso (cada namespace tem o próprio arquivo de progresso). --corte frase termina cada trecho no
// fim de uma frase (ver chunkPorFrase).
const args = process.argv.slice(2);
const opcao = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const valoresDasOpcoes = new Set(['--namespace', '--corte', '--tamanho'].map(opcao).filter(Boolean));
const FOLDER_PATH = args.find((a) => !a.startsWith('--') && !valoresDasOpcoes.has(a)) || './docs-embrapa';
const NAMESPACE = opcao('--namespace') || NAMESPACE_DA_BASE;
const CORTE = opcao('--corte') || 'caracteres';
if (!['caracteres', 'frase'].includes(CORTE)) {
    console.error(`❌ --corte "${CORTE}" não existe: use "caracteres" (padrão) ou "frase".`);
    process.exit(1);
}
const STATE_FILE = NAMESPACE === NAMESPACE_DA_BASE ? '.ingest-state.json' : `.ingest-state-${NAMESPACE}.json`;
// --tamanho muda o tamanho máximo do trecho, para testes em outro namespace
const CHUNK_SIZE = Number(opcao('--tamanho')) || 800;
const CHUNK_OVERLAP = 100;

// Documentos cujo sentido depende de um cabeçalho que aparece uma única vez no
// texto. Numa tabela, os trechos do meio viram linhas soltas ("GNZ 7280PRO2
// Geneze S R S") sem nada que diga a qual nematoide cada letra se refere, e o
// modelo pode inverter as colunas. O prefixo repete esse contexto em todos os
// trechos do arquivo.
const PREFIXO_TABELA_NEMATOIDES =
    'Tabela de reação de genótipos (híbridos e cultivares) de milho aos nematoides, ' +
    'medida pelo fator de reprodução (FR). Em cada linha: nome do genótipo, empresa e, ' +
    'nesta ordem, a reação a Meloidogyne incognita (nematoide de galha), a Meloidogyne ' +
    'javanica (nematoide de galha) e a Pratylenchus brachyurus (nematoide das lesões ' +
    'radiculares). Legenda: R = resistente (FR abaixo de 10%); MR = moderadamente ' +
    'resistente (FR entre 10% e 30%); S = suscetível (FR igual ou acima de 30%).';

const PREFIXO_POR_ARQUIVO = {
    'manejo_nematoide_soja.pdf': PREFIXO_TABELA_NEMATOIDES,
    'milho_nematoides.pdf': PREFIXO_TABELA_NEMATOIDES,
};

// Validação de variáveis de ambiente
const host = process.env.PINECONE_INDEX_HOST?.replace(/^https?:\/\//, '');
const pineconeApiKey = process.env.PINECONE_API_KEY;
// O namespace acompanha o modelo de embedding (src/lib/embeddings.mjs). Os embeddings vêm do
// Pinecone Inference, com a mesma chave do índice; até 28/10/2026 eram do Gemini.
const namespace = NAMESPACE;
console.log(`Namespace: ${namespace}${namespace === NAMESPACE_DA_BASE ? ' (a base que o chat usa)' : ' (teste; o chat não usa)'} | corte: ${CORTE}, até ${CHUNK_SIZE} caracteres | progresso em ${STATE_FILE}`);

if (!host || !pineconeApiKey) {
    console.error('❌ Erro: PINECONE_INDEX_HOST e PINECONE_API_KEY são obrigatórios no .env.local');
    process.exit(1);
}

// Leitura do estado de progresso para retomada automática
let state = { processedFiles: [], failedFiles: [] };
if (fs.existsSync(STATE_FILE)) {
    try {
        // O replace remove o BOM que editores e o PowerShell costumam gravar;
        // JSON.parse rejeita esse caractere.
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8').replace(/^﻿/, ''));
    } catch (e) {
        // Recomeçar do zero aqui reprocessaria todos os PDFs e gastaria a cota
        // de embeddings à toa. É mais seguro parar e deixar a decisão com quem roda.
        console.error(`❌ "${STATE_FILE}" existe mas não pôde ser lido: ${e.message}`);
        console.error('   Para ignorar o progresso e reprocessar tudo, apague o arquivo manualmente.');
        process.exit(1);
    }
}
state.failedFiles ??= [];

function saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function registrarFalha(fileName, motivo) {
    if (!state.failedFiles.some((f) => f.arquivo === fileName)) {
        state.failedFiles.push({ arquivo: fileName, motivo });
    }
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = start + size;
        const bruto = text.slice(start, end);
        const texto = bruto.trim();
        // O trim pode descartar a quebra de linha que separa duas páginas; sem somar
        // esse deslocamento, um chunk que começa exatamente na virada seria atribuído
        // à página anterior.
        if (texto) chunks.push({ texto, inicio: start + (bruto.length - bruto.trimStart().length) });
        start += size - overlap;
    }
    return chunks;
}

// Corte por frase (--corte frase): o trecho junta frases inteiras até ~size caracteres e repete a
// última frase no começo do seguinte (a sobreposição). Os PDFs não têm parágrafos marcados (não
// há linha em branco; cada quebra de linha é o fim de uma linha visual), por isso a unidade é a
// frase. Uma "frase" sem ponto maior que o trecho (linhas de tabela) é cortada pelo tamanho.
function chunkPorFrase(text, size = CHUNK_SIZE) {
    // Fim de frase: . ! ou ? seguido de espaço ou quebra e de letra maiúscula, número ou aspas
    const frases = [];
    const FIM = /[.!?]["')\]]?(?=\s+["'(\[]?[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])/g;
    let inicio = 0;
    for (const m of text.matchAll(FIM)) {
        frases.push({ inicio, fim: m.index + m[0].length });
        inicio = m.index + m[0].length;
    }
    if (inicio < text.length) frases.push({ inicio, fim: text.length });
    // Frase maior que o trecho vira pedaços do tamanho do trecho
    const pedacos = frases.flatMap((f) => {
        if (f.fim - f.inicio <= size) return [f];
        const partes = [];
        for (let i = f.inicio; i < f.fim; i += size) partes.push({ inicio: i, fim: Math.min(f.fim, i + size) });
        return partes;
    });
    const chunks = [];
    let atual = [];
    const emitir = () => {
        const ini = atual[0].inicio;
        const bruto = text.slice(ini, atual.at(-1).fim);
        const texto = bruto.trim();
        if (texto) chunks.push({ texto, inicio: ini + (bruto.length - bruto.trimStart().length) });
    };
    for (const p of pedacos) {
        if (atual.length && p.fim - atual[0].inicio > size) {
            emitir();
            // Sobreposição: a última frase, se não for grande demais
            const ultima = atual.at(-1);
            atual = ultima.fim - ultima.inicio <= CHUNK_OVERLAP * 3 ? [ultima] : [];
        }
        atual.push(p);
    }
    if (atual.length) emitir();
    return chunks;
}

// O unpdf devolve uma posição por página; juntamos tudo num texto só (para os chunks
// poderem atravessar a virada de página) e guardamos onde cada página começa, de modo
// a traduzir o offset de um chunk de volta para o número da página.
function offsetsDasPaginas(paginas, separador = '\n') {
    const offsets = [];
    let pos = 0;
    for (const pagina of paginas) {
        offsets.push(pos);
        pos += pagina.length + separador.length;
    }
    return offsets;
}

// Alguns PDFs publicados trazem a camada de texto corrompida: a fonte foi
// embutida sem o mapa que associa cada glifo à sua letra, e a extração devolve
// caracteres trocados. Para esses, um arquivo ".txt" de mesmo nome ao lado do
// PDF substitui a extração — normalmente gerado por OCR. As páginas nele são
// separadas por form feed, para o número da página continuar correto.
function lerAcompanhante(fileName) {
    const caminho = path.join(FOLDER_PATH, fileName.replace(/\.pdf$/i, '.txt'));
    if (!fs.existsSync(caminho)) return null;
    const conteudo = fs.readFileSync(caminho, 'utf-8').replace(/^﻿/, '');
    if (!conteudo.trim()) return null;
    console.log('   └ usando o texto do arquivo acompanhante .txt no lugar da extração do PDF.');
    return conteudo.split('\f');
}

async function lerDoPdf(filePath) {
    const { text } = await extractText(new Uint8Array(fs.readFileSync(filePath)));
    return (Array.isArray(text) ? text : [text]).map((p) => String(p ?? ''));
}

function paginaDoOffset(offsets, offset) {
    for (let i = offsets.length - 1; i >= 0; i--) {
        if (offset >= offsets[i]) return i + 1;
    }
    return 1;
}

// Util de retry (backoff simples) para lidar com falhas temporárias (ex: Rate Limit 429)
async function withRetry(fn, label, tentativas = 5) {
    for (let i = 0; i < tentativas; i++) {
        try {
            return await fn();
        } catch (e) {
            const espera = Math.min(30000, 1000 * 2 ** i); // Máximo de 30s de espera
            console.warn(`  ⚠️ ${label} falhou (tentativa ${i + 1}/${tentativas}): ${e.message}. Aguardando ${espera / 1000}s...`);
            await new Promise((r) => setTimeout(r, espera));
        }
    }
    throw new Error(`${label}: esgotou as tentativas. Rode o script de novo depois — o progresso por arquivo foi salvo.`);
}

// Função de upsert envelopada no withRetry
async function upsertPinecone(vectors) {
    return withRetry(async () => {
        const res = await fetch(`https://${host}/vectors/upsert`, {
            method: 'POST',
            headers: {
                'Api-Key': pineconeApiKey,
                'Content-Type': 'application/json',
                'X-Pinecone-Api-Version': '2025-04',
            },
            body: JSON.stringify({
                vectors,
                namespace,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Pinecone Upsert Error ${res.status}: ${err}`);
        }
    }, 'Pinecone upsert');
}

const prefixoDoArquivo = (fileName) => `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_`;

// O upsert sobrescreve por id. Quando um arquivo reprocessado passa a gerar menos
// trechos, os ids acima da nova contagem não são tocados e ficam órfãos no índice
// com o conteúdo antigo — foi o que aconteceu com o PDF de trigo após o OCR.
async function removerTrechosExcedentes(fileName, total) {
    const prefixo = prefixoDoArquivo(fileName);
    const excedentes = [];
    let pagina;
    do {
        const url = new URL(`https://${host}/vectors/list`);
        url.searchParams.set('namespace', namespace);
        url.searchParams.set('prefix', prefixo);
        if (pagina) url.searchParams.set('paginationToken', pagina);
        const lista = await withRetry(async () => {
            const res = await fetch(url, { headers: { 'Api-Key': pineconeApiKey, 'X-Pinecone-Api-Version': '2025-04' } });
            if (!res.ok) throw new Error(`Pinecone List Error ${res.status}: ${await res.text()}`);
            return res.json();
        }, 'Pinecone list');
        for (const { id } of lista.vectors ?? []) {
            if (Number(id.slice(prefixo.length)) >= total) excedentes.push(id);
        }
        pagina = lista.pagination?.next;
    } while (pagina);

    if (excedentes.length === 0) return;
    await withRetry(async () => {
        const res = await fetch(`https://${host}/vectors/delete`, {
            method: 'POST',
            headers: { 'Api-Key': pineconeApiKey, 'Content-Type': 'application/json', 'X-Pinecone-Api-Version': '2025-04' },
            body: JSON.stringify({ ids: excedentes, namespace }),
        });
        if (!res.ok) throw new Error(`Pinecone Delete Error ${res.status}: ${await res.text()}`);
    }, 'Pinecone delete');
    console.log(`   └ removido(s) ${excedentes.length} trecho(s) antigo(s) que sobravam de uma versão anterior do arquivo.`);
}

async function main() {
    if (!fs.existsSync(FOLDER_PATH)) {
        console.error(`❌ Pasta "${FOLDER_PATH}" não encontrada.`);
        process.exit(1);
    }

    const files = fs.readdirSync(FOLDER_PATH).filter((f) => f.toLowerCase().endsWith('.pdf'));
    console.log(`\n📚 Encontrados ${files.length} arquivo(s) PDF em "${FOLDER_PATH}"`);

    for (let i = 0; i < files.length; i++) {
        const fileName = files[i];
        if (state.processedFiles.includes(fileName)) {
            console.log(`⏩ [${i + 1}/${files.length}] Ignorando "${fileName}" (já processado).`);
            continue;
        }

        console.log(`\n📄 [${i + 1}/${files.length}] Processando: "${fileName}"...`);
        const filePath = path.join(FOLDER_PATH, fileName);

        try {
            const paginas = lerAcompanhante(fileName) ?? (await lerDoPdf(filePath));
            const fullText = paginas.join('\n');
            const offsets = offsetsDasPaginas(paginas);
            if (!fullText.trim()) {
                console.warn(`⚠️ Nenhum texto extraído de "${fileName}" — provável PDF escaneado sem OCR. Pulando...`);
                registrarFalha(fileName, 'sem texto extraível (provável PDF escaneado sem OCR)');
                state.processedFiles.push(fileName);
                saveState();
                continue;
            }

            const chunks = CORTE === 'frase' ? chunkPorFrase(fullText) : chunkText(fullText);
            console.log(`   └ ${paginas.length} página(s), ${chunks.length} trecho(s). Gerando embeddings...`);
            if (PREFIXO_POR_ARQUIVO[fileName]) {
                console.log('   └ prefixo de contexto aplicado a todos os trechos deste arquivo.');
            }

            const prefixo = PREFIXO_POR_ARQUIVO[fileName];
            const textos = chunks.map((chunk) => (prefixo ? `${prefixo}\n\n${chunk.texto}` : chunk.texto));
            // Em lotes, com novas tentativas no limite por minuto do plano gratuito
            const valores = await gerarEmbeddings(textos, { tipo: 'passage', apiKey: pineconeApiKey, tentativas: 5 });
            const vectors = chunks.map((chunk, j) => ({
                id: `${prefixoDoArquivo(fileName)}${j}`,
                values: valores[j],
                metadata: {
                    fonte: fileName,
                    texto: textos[j],
                    pagina: paginaDoOffset(offsets, chunk.inicio),
                },
            }));

            // Envia para o Pinecone em lotes de 100
            for (let k = 0; k < vectors.length; k += 100) {
                const batch = vectors.slice(k, k + 100);
                await upsertPinecone(batch);
            }
            await removerTrechosExcedentes(fileName, vectors.length);

            console.log(`   ✅ Enviado(s) ${vectors.length} vetor(es) ao Pinecone!`);
            state.processedFiles.push(fileName);
            saveState();
        } catch (err) {
            console.error(`❌ Erro ao processar "${fileName}":`, err.message);
            // Cota esgotada não é defeito do arquivo. Registrar aqui faria um PDF
            // íntegro aparecer no relatório de problemáticos entregue ao grupo.
            if (/RESOURCE_EXHAUSTED|quota|429/i.test(err.message)) {
                console.log('   Cota da API esgotada — o PDF não tem defeito. Rode de novo quando a cota renovar.');
            } else {
                registrarFalha(fileName, err.message);
            }
            saveState();
            console.log('   O progresso até aqui foi salvo.');
            break;
        }
    }

    const pendentes = files.filter((f) => !state.processedFiles.includes(f));
    console.log(`\n📊 Concluídos: ${state.processedFiles.length}/${files.length} | Pendentes: ${pendentes.length}`);

    if (state.failedFiles.length > 0) {
        console.log(`\n⚠️  ${state.failedFiles.length} PDF(s) com problema — reportar ao grupo:`);
        for (const f of state.failedFiles) {
            console.log(`   • ${f.arquivo}: ${f.motivo}`);
        }
    }
}

main();