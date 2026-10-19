import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { extractText } from 'unpdf';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FOLDER_PATH = process.argv[2] || './docs-embrapa';
const STATE_FILE = '.ingest-state.json';
const CHUNK_SIZE = 800;
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
const namespace = process.env.PINECONE_NAMESPACE || 'embrapa';
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!host || !pineconeApiKey || !geminiApiKey) {
    console.error('❌ Erro: PINECONE_INDEX_HOST, PINECONE_API_KEY e GEMINI_API_KEY são obrigatórios no .env.local');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// Leitura do estado de progresso para retomada automática
let state = { processedFiles: [], failedFiles: [] };
if (fs.existsSync(STATE_FILE)) {
    try {
        // O replace remove o BOM que editores e o PowerShell costumam gravar;
        // JSON.parse rejeita esse caractere.
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8').replace(/^﻿/, ''));
    } catch (e) {
        // Recomeçar do zero aqui reprocessaria todos os PDFs e esgotaria a cota
        // diária do Gemini à toa. É mais seguro parar e deixar a decisão com quem roda.
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

// Função de embedding agora envelopada no withRetry e com taskType adicionado
async function getEmbedding(text) {
    return withRetry(async () => {
        const res = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: text,
            config: { 
                outputDimensionality: 768, 
                taskType: 'RETRIEVAL_DOCUMENT' // Especifica que é para RAG
            },
        });
        return res.embedding?.values || res.embeddings?.[0]?.values || res.values;
    }, 'Gemini embedContent');
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
        const buffer = fs.readFileSync(filePath);

        try {
            const pdfData = new Uint8Array(buffer);
            const { text } = await extractText(pdfData);

            const paginas = (Array.isArray(text) ? text : [text]).map((p) => String(p ?? ''));
            const fullText = paginas.join('\n');
            const offsets = offsetsDasPaginas(paginas);
            if (!fullText.trim()) {
                console.warn(`⚠️ Nenhum texto extraído de "${fileName}" — provável PDF escaneado sem OCR. Pulando...`);
                registrarFalha(fileName, 'sem texto extraível (provável PDF escaneado sem OCR)');
                state.processedFiles.push(fileName);
                saveState();
                continue;
            }

            const chunks = chunkText(fullText);
            console.log(`   └ ${paginas.length} página(s), ${chunks.length} trecho(s). Gerando embeddings...`);
            if (PREFIXO_POR_ARQUIVO[fileName]) {
                console.log('   └ prefixo de contexto aplicado a todos os trechos deste arquivo.');
            }

            const vectors = [];
            for (let j = 0; j < chunks.length; j++) {
                const chunk = chunks[j];
                const prefixo = PREFIXO_POR_ARQUIVO[fileName];
                const texto = prefixo ? `${prefixo}\n\n${chunk.texto}` : chunk.texto;
                const vector = await getEmbedding(texto);

                const id = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${j}`;
                vectors.push({
                    id,
                    values: vector,
                    metadata: {
                        fonte: fileName,
                        texto,
                        pagina: paginaDoOffset(offsets, chunk.inicio),
                    },
                });

                // Pequena pausa para respeitar cotas de requisições por minuto (mantida do código original)
                await new Promise((r) => setTimeout(r, 200));
            }

            // Envia para o Pinecone em lotes de 100
            for (let k = 0; k < vectors.length; k += 100) {
                const batch = vectors.slice(k, k + 100);
                await upsertPinecone(batch);
            }

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