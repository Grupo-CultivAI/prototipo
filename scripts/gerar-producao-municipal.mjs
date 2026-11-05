// Gera src/lib/dados/producao-municipal.json: as culturas com mais área colhida em cada município,
// da Produção Agrícola Municipal do IBGE (PAM, tabela 5457 do SIDRA, lavouras temporárias e
// permanentes, último ano publicado). O chat mostra essas culturas no perfil enviado à IA, para a
// rotação sugerida usar o que já tem mercado e prática na região (src/lib/producaoMunicipal.ts).
//
// Uso: node scripts/gerar-producao-municipal.mjs
// Rodar de novo uma vez por ano, quando o IBGE publicar a PAM nova (em geral em setembro).
//
// Formato, para o arquivo ficar pequeno:
//   produtos:   ["Mandioca", "Feijão", ...]
//   perenes:    [1, 7, ...]                       índices dos produtos de lavoura permanente
//   municipios: { "2909802": [0, 1200, 1, 800] }   pares [índice do produto, hectares], do maior para o menor
import fs from 'node:fs';

const UFS = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53];
// v/216: área colhida (hectares); c782/allxt: todos os produtos, sem o total.
// n3 é o estado e n8, a mesorregião: o SIDRA recusa consultas com mais de 50 mil valores
// (Minas Gerais passa disso), e aí o estado é baixado por mesorregião.
const url = (nivel, codigo) => `https://apisidra.ibge.gov.br/values/t/5457/n6/in%20${nivel}%20${codigo}/v/216/p/last/c782/allxt`;
const DESTINO = new URL('../src/lib/dados/producao-municipal.json', import.meta.url);
const { mesorregioes } = JSON.parse(fs.readFileSync(new URL('../src/lib/dados/mesorregioes.json', import.meta.url), 'utf8'));
const mesorregioesDaUF = (uf) => Object.keys(mesorregioes).filter((m) => m.startsWith(String(uf)));

async function baixar(nivel, codigo) {
    const resposta = await fetch(url(nivel, codigo), { signal: AbortSignal.timeout(180_000) });
    if (resposta.ok) return (await resposta.json()).slice(1);
    if (nivel === 'n3' && resposta.status === 400) {
        const partes = [];
        for (const meso of mesorregioesDaUF(codigo)) partes.push(...await baixar('n8', meso));
        return partes;
    }
    throw new Error(`SIDRA respondeu ${resposta.status} para ${nivel} ${codigo}`);
}
const CULTURAS_POR_MUNICIPIO = 5;
// Café: o IBGE dá o total e, de novo, por espécie; borracha: o látex coagulado e o líquido
const REPETIDOS = new Set(['40140', '40141', '40468']);
// Lavouras permanentes (pomares, café, cacau...): a tabela 5457 junta as temporárias e as
// permanentes, e os códigos das permanentes ficam nestas faixas. Sem a marca, a IA indicou limão
// e laranja como "próxima safra" para um sítio de 3 hectares (05/11/2026).
const PERENE = (codigo) => {
    const c = Number(codigo);
    return (c >= 40129 && c <= 40152) || (c >= 40260 && c <= 40274) || [40330, 45982, 83399, 83400, 83401].includes(c);
};

// "Feijão (em grão)" → "Feijão"; "Café (em grão) Total" → "Café"; "Abacaxi*" → "Abacaxi"
const nomeLimpo = (nome) => nome.replace(/\*/g, '').replace(/\s*\(.*?\)/g, '').replace(/\s+Total$/, '').trim();

const porMunicipio = new Map();
let ano = null;
for (const uf of UFS) {
    for (const l of await baixar('n3', uf)) {
        const hectares = Number(l.V);
        // "-" (zero), "..." e "X" (sigilo) não são números
        if (!Number.isFinite(hectares) || hectares <= 0 || REPETIDOS.has(l.D4C)) continue;
        ano ??= l.D3N;
        const lista = porMunicipio.get(l.D1C) ?? [];
        lista.push([nomeLimpo(l.D4N), hectares, PERENE(l.D4C)]);
        porMunicipio.set(l.D1C, lista);
    }
    process.stdout.write(`${uf} `);
}

const produtos = [];
const perenes = [];
const indice = new Map();
const municipios = {};
for (const [codigo, lista] of porMunicipio) {
    municipios[codigo] = lista
        .sort((a, b) => b[1] - a[1])
        .slice(0, CULTURAS_POR_MUNICIPIO)
        .flatMap(([nome, hectares, perene]) => {
            if (!indice.has(nome)) {
                indice.set(nome, produtos.length);
                if (perene) perenes.push(produtos.length);
                produtos.push(nome);
            }
            return [indice.get(nome), hectares];
        });
}

fs.writeFileSync(DESTINO, `${JSON.stringify({ fonte: 'IBGE, Produção Agrícola Municipal (SIDRA, tabela 5457), área colhida', ano, geradoEm: new Date().toISOString().slice(0, 10), produtos, perenes, municipios })}\n`);
console.log(`\n${Object.keys(municipios).length} municípios, ${produtos.length} produtos, ano ${ano}.`);
