// Importa a época de plantio oficial (ZARC) dos dados abertos do Ministério da Agricultura
// para a coleção zarcmunicipios: um documento por município, com a janela de plantio de cada
// cultura por tipo de solo e manejo (sequeiro ou irrigado). Fonte: "Tábua de risco - ZARC",
// https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico
// (licença CC-BY: citar o Ministério da Agricultura).
//
// Uso:
//   node scripts/importar-zarc.mjs                 → baixa os arquivos e só mostra o resumo
//   node scripts/importar-zarc.mjs --confirmar     → baixa e grava no banco (substitui tudo)
//   node scripts/importar-zarc.mjs --arquivos a.csv,b.csv   → usa arquivos já baixados
//   node scripts/importar-zarc.mjs --ver "Campinas/SP"      → mostra como ficou um município
//   node scripts/importar-zarc.mjs --municipios 3509502,4204202 → só esses (geocódigo do IBGE), para testes
//
// O banco do .env.local é o mesmo da produção. São uns 600 MB de download (dois ou três
// minutos de processamento) e ~20 MB gravados.
//
// A cada safra nova, acrescente o arquivo dela no início de ARQUIVOS: cada cultura vem do
// arquivo mais novo que a tem (o de 2025/2026 continua na lista pelas culturas de inverno,
// como trigo e aveia, que ainda não estão no de 2026/2027).
import fs from 'node:fs';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { GRUPO_DO_SOLO, codificarFaixas, decodificarFaixas, janelasEmTexto, normalizar } from '../src/lib/zarc-formato.mjs';
dotenv.config({ path: '.env.local', quiet: true });

const BASE = 'https://dados.agricultura.gov.br/dataset/6d3d141c-885e-41a4-ab7f-dc8ff323b96f/resource';
const ARQUIVOS = [
    { nome: 'Safra 2026/2027', url: `${BASE}/139e5a60-1f43-4cc8-aeab-a35dbbf816c0/download/dados-abertos-tabua-de-risco-safra-2026-2027.csv` },
    { nome: 'Perene, olerícola e sem safra', url: `${BASE}/dae65d31-683f-4ac4-ab90-3abd0c1583ba/download/dados-abertos-tabua-de-risco-safra-perene-olericola-sem-safra.csv` },
    { nome: 'Safra 2025/2026', url: `${BASE}/f9d597f9-0fee-47eb-9344-8642274ca9da/download/dados-abertos-tabua-de-risco-safra-2025-2026.csv` },
];

const args = process.argv.slice(2);
const opcao = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : null; };
const confirmar = args.includes('--confirmar');
const locais = opcao('--arquivos')?.split(',');
const ver = opcao('--ver');
const soEstes = opcao('--municipios')?.split(',');
const fontes = locais ? locais.map((caminho) => ({ nome: caminho, caminho })) : ARQUIVOS;

async function linhasDe(fonte) {
    if (fonte.caminho) return readline.createInterface({ input: fs.createReadStream(fonte.caminho, { encoding: 'utf8' }), crlfDelay: Infinity });
    const res = await fetch(fonte.url);
    if (!res.ok) throw new Error(`${fonte.nome}: HTTP ${res.status}`);
    return readline.createInterface({ input: Readable.fromWeb(res.body).setEncoding('utf8'), crlfDelay: Infinity });
}

// municípios: geocódigo → { uf, nome, culturas: Map(cultura → Map("s:A" → riscos)) }
const municipios = new Map();
const culturasJaLidas = new Set();
const resumo = [];

for (const fonte of fontes) {
    process.stdout.write(`Lendo ${fonte.nome}... `);
    const novasNesteArquivo = new Set();
    let cabecalho = null, linhas = 0, usadas = 0;
    for await (const linha of await linhasDe(fonte)) {
        const c = linha.replace(/^﻿/, '').split(';');
        if (!cabecalho) {
            cabecalho = c;
            if (c[0] !== 'Nome_cultura' || c[6] !== 'geocodigo' || c[19] !== 'dec1' || c[54] !== 'dec36') {
                throw new Error(`${fonte.nome}: colunas diferentes do esperado (${c.slice(0, 8).join(';')}...). O formato da tábua mudou?`);
            }
            continue;
        }
        linhas++;
        const cultura = c[0].replace(/\s+/g, ' ').trim();
        if (culturasJaLidas.has(cultura)) continue; // já veio de um arquivo mais novo
        // Nas perenes, "Produção" é o risco do pomar já formado, não época de plantio (que é
        // a linha "Implantação"). Ficaria parecendo que se planta banana o ano todo.
        if (/produ[cç][aã]o/i.test(cultura)) continue;
        const grupo = GRUPO_DO_SOLO[c[5]];
        if (!cultura || !grupo || !/^\d{7}$/.test(c[6])) continue;
        novasNesteArquivo.add(cultura);
        usadas++;

        const m = municipios.get(c[6]) ?? { uf: c[7], nome: c[8], culturas: new Map() };
        municipios.set(c[6], m);
        const porSolo = m.culturas.get(cultura) ?? new Map();
        m.culturas.set(cultura, porSolo);
        // Manejo 1 = sequeiro; 2 e 3 = irrigado (com ou sem controle de geada)
        const chave = `${c[11] === '1' ? 's' : 'i'}:${grupo}`;
        const riscos = porSolo.get(chave) ?? new Uint8Array(36);
        // Vários ciclos de cultivar, níveis de manejo e climas por solo: fica o menor risco de
        // cada decêndio, ou seja, a janela da cultivar mais favorável.
        for (let d = 0; d < 36; d++) {
            const r = Number(c[19 + d]);
            if ((r === 20 || r === 30 || r === 40) && (!riscos[d] || r < riscos[d])) riscos[d] = r;
        }
        porSolo.set(chave, riscos);
    }
    novasNesteArquivo.forEach((x) => culturasJaLidas.add(x));
    resumo.push(`${fonte.nome}: ${linhas.toLocaleString('pt-BR')} linhas, ${usadas.toLocaleString('pt-BR')} usadas, ${novasNesteArquivo.size} culturas`);
    console.log('ok');
}

// Documento: { _id: geocódigo, uf, nome, busca, j: { cultura: { s, i } } }, em que s (sequeiro)
// e i (irrigado) são as faixas, num texto só quando os três grupos de solo têm a mesma janela,
// ou { A, M, G } quando diferem (um grupo ausente = plantio não indicado naquele solo).
const atualizadoEm = new Date();
const documentos = [];
for (const [geocodigo, m] of municipios) {
    if (soEstes && !soEstes.includes(geocodigo)) continue;
    const j = {};
    for (const [cultura, porSolo] of m.culturas) {
        const entrada = {};
        for (const manejo of ['s', 'i']) {
            const porGrupo = {};
            for (const g of ['A', 'M', 'G']) {
                const riscos = porSolo.get(`${manejo}:${g}`);
                const faixas = riscos ? codificarFaixas(riscos) : '';
                if (faixas) porGrupo[g] = faixas;
            }
            const valores = Object.values(porGrupo);
            if (!valores.length) continue;
            entrada[manejo] = valores.length === 3 && valores.every((v) => v === valores[0]) ? valores[0] : porGrupo;
        }
        if (Object.keys(entrada).length) j[cultura.replace(/\./g, '')] = entrada;
    }
    documentos.push({ _id: geocodigo, uf: m.uf, nome: m.nome, busca: normalizar(m.nome), j, atualizadoEm });
}

const bytes = documentos.reduce((t, d) => t + Buffer.byteLength(JSON.stringify(d)), 0);
console.log(`\n${resumo.join('\n')}`);
console.log(`\n${documentos.length.toLocaleString('pt-BR')} municípios, ${culturasJaLidas.size} culturas, ~${(bytes / 1e6).toFixed(1)} MB.`);

if (ver) {
    const [cidade, uf] = ver.split('/');
    const doc = documentos.find((d) => d.busca === normalizar(cidade) && (!uf || d.uf === uf.toUpperCase()));
    if (!doc) console.log(`\n"${ver}" não encontrado.`);
    else {
        console.log(`\n${doc.nome}/${doc.uf} (${doc._id}), ${Object.keys(doc.j).length} culturas:`);
        for (const [cultura, e] of Object.entries(doc.j)) {
            for (const [manejo, v] of Object.entries(e)) {
                const porSolo = typeof v === 'string' ? { todos: v } : v;
                for (const [g, faixas] of Object.entries(porSolo)) {
                    console.log(`  ${cultura} (${manejo === 's' ? 'sequeiro' : 'irrigado'}, solo ${g}): ${janelasEmTexto(decodificarFaixas(faixas))}`);
                }
            }
        }
    }
}

if (!confirmar) {
    console.log('\nNada foi gravado. Para gravar no banco, rode de novo com --confirmar.\n');
    process.exit(0);
}

await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cultivai' });
const colecao = mongoose.connection.db.collection('zarcmunicipios');
for (let i = 0; i < documentos.length; i += 500) {
    await colecao.bulkWrite(documentos.slice(i, i + 500).map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })));
    process.stdout.write(`\rGravando... ${Math.min(i + 500, documentos.length)}/${documentos.length}`);
}
// Município que saiu da tábua nesta importação (numa importação parcial, nada é removido)
const removidos = soEstes ? { deletedCount: 0 } : await colecao.deleteMany({ atualizadoEm: { $ne: atualizadoEm } });
await colecao.createIndex({ uf: 1, busca: 1 });
console.log(`\n${documentos.length} municípios gravados; ${removidos.deletedCount} antigos removidos.\n`);
await mongoose.disconnect();
