import fs from 'node:fs';
import path from 'node:path';
import { extractText } from 'unpdf';

const FOLDER_PATH = process.argv[2] || './docs-embrapa';
const CATALOGO = JSON.parse(fs.readFileSync(new URL('../src/lib/documentos.json', import.meta.url), 'utf-8'));
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

// Texto natural em português ou inglês repete palavras funcionais em alta
// frequência. Um PDF cuja fonte foi embutida sem o mapa de caracteres extrai
// texto de aparência normal, mas sem nenhuma delas — foi assim que um arquivo
// ilegível passou por uma checagem que só perguntava "tem texto?".
const PALAVRAS_FUNCIONAIS = [
    ' de ', ' da ', ' do ', ' em ', ' para ', ' com ', ' que ', ' os ', ' as ', ' e ',
    ' the ', ' of ', ' and ', ' in ', ' to ',
];
const DENSIDADE_MINIMA = 10;

function densidade(texto) {
    const t = ` ${texto.replace(/\s+/g, ' ').toLowerCase()} `;
    if (t.length < 3) return 0;
    let ocorrencias = 0;
    for (const palavra of PALAVRAS_FUNCIONAIS) {
        let i = 0;
        while ((i = t.indexOf(palavra, i)) !== -1) { ocorrencias++; i += 1; }
    }
    return (ocorrencias / t.length) * 1000;
}

function contarTrechos(texto) {
    let total = 0;
    for (let i = 0; i < texto.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        if (texto.slice(i, i + CHUNK_SIZE).trim()) total++;
    }
    return total;
}

if (!fs.existsSync(FOLDER_PATH)) {
    console.error(`❌ Pasta "${FOLDER_PATH}" não encontrada.`);
    process.exit(1);
}

const arquivos = fs.readdirSync(FOLDER_PATH).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
if (arquivos.length === 0) {
    console.error(`❌ Nenhum PDF em "${FOLDER_PATH}".`);
    process.exit(1);
}

const problemas = [];
let totalTrechos = 0;

console.log(`\n📋 Analisando ${arquivos.length} PDF(s) em "${FOLDER_PATH}" — sem consumir cota de API\n`);
console.log('arquivo'.padEnd(62) + 'págs'.padStart(6) + 'trechos'.padStart(9) + 'densidade'.padStart(11) + '  situação');
console.log('-'.repeat(100));

for (const arquivo of arquivos) {
    let paginas = 0;
    let trechos = 0;
    let dens = 0;
    let problema = null;
    let origem = 'pdf';

    try {
        // Um ".txt" de mesmo nome substitui a extração do PDF na ingestão, então
        // é ele que precisa ser avaliado aqui — ver lerAcompanhante em ingest-pdfs.mjs.
        const acompanhante = path.join(FOLDER_PATH, arquivo.replace(/\.pdf$/i, '.txt'));
        let partes;
        if (fs.existsSync(acompanhante)) {
            partes = fs.readFileSync(acompanhante, 'utf-8').replace(/^﻿/, '').split('\f');
            paginas = partes.length;
            origem = '.txt';
        } else {
            const { totalPages, text } = await extractText(new Uint8Array(fs.readFileSync(path.join(FOLDER_PATH, arquivo))));
            partes = (Array.isArray(text) ? text : [text]).map((p) => String(p ?? ''));
            paginas = totalPages ?? partes.length;
        }
        const completo = partes.join('\n');

        if (!completo.trim()) {
            problema = 'sem texto extraível (provável PDF escaneado sem OCR)';
        } else {
            trechos = contarTrechos(completo);
            dens = densidade(completo);
            if (dens < DENSIDADE_MINIMA) {
                problema = `texto ilegível (densidade ${dens.toFixed(1)}, mínimo ${DENSIDADE_MINIMA}) — provável fonte sem mapa de caracteres`;
            }
        }
    } catch (e) {
        problema = `falha ao ler: ${e.message}`;
    }

    totalTrechos += trechos;
    if (problema) problemas.push({ arquivo, problema });

    const nome = arquivo.length > 60 ? `${arquivo.slice(0, 57)}...` : arquivo;
    console.log(
        nome.padEnd(62) +
        String(paginas).padStart(6) +
        String(trechos).padStart(9) +
        dens.toFixed(1).padStart(11) +
        (problema ? '  <== PROBLEMA' : origem === '.txt' ? '  ok (via .txt)' : '  ok')
    );
}

console.log('-'.repeat(100));
console.log(`\nTrechos previstos: ${totalTrechos} (= chamadas de embedding que a ingestão fará)`);

// Sem título no catálogo a ingestão funciona, mas o produtor vê o nome do arquivo na lista de fontes.
const semTitulo = arquivos.filter((a) => !CATALOGO[a]);
if (semTitulo.length) {
    console.log(`\n📝 ${semTitulo.length} PDF(s) sem título em src/lib/documentos.json — acrescente antes de publicar:`);
    for (const a of semTitulo) console.log(`   • ${a}`);
}

if (problemas.length === 0) {
    console.log('\n✅ Nenhum problema encontrado. Pode rodar a ingestão.');
    process.exit(0);
}

console.log(`\n⚠️  ${problemas.length} PDF(s) com problema — reportar ao grupo antes de ingerir:`);
for (const p of problemas) console.log(`   • ${p.arquivo}\n     ${p.problema}`);
console.log('\nUm PDF com texto ilegível costuma abrir normalmente na tela: o defeito aparece só na extração.');
process.exit(1);
