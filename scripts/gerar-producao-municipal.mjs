// Gera src/lib/dados/producao-municipal.json: as culturas com mais área colhida em cada município,
// da Produção Agrícola Municipal do IBGE (PAM, tabela 5457 do SIDRA, lavouras temporárias e
// permanentes, último ano publicado). O chat mostra essas culturas no perfil enviado à IA, para a
// rotação sugerida usar o que já tem mercado e prática na região (src/lib/producaoMunicipal.ts).
// Para cada uma, também o valor bruto por hectare e o preço médio recebido pelo produtor, que
// ajudam em "o que plantar para vender" (a Conab não tem preços em arquivo aberto).
//
// Uso: node scripts/gerar-producao-municipal.mjs
// Rodar de novo uma vez por ano, quando o IBGE publicar a PAM nova (em geral em setembro).
//
// Formato, para o arquivo ficar pequeno:
//   produtos:   ["Mandioca", "Feijão", ...]
//   perenes:    [1, 7, ...]                       índices dos produtos de lavoura permanente
//   municipios: { "2909802": [0, 839, 4144, 798, ...] }
//               grupos de 4, do maior para o menor: [índice do produto, hectares,
//               valor da produção em reais por hectare, preço em reais por tonelada (0 se não houver)]
import fs from 'node:fs';

const UFS = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53];
// v/214: quantidade produzida; v/215: valor da produção (mil reais); v/216: área colhida (hectares);
// c782/allxt: todos os produtos, sem o total.
// n3 é o estado e n8, a mesorregião: o SIDRA recusa consultas com mais de 50 mil valores. Uma
// variável por vez, e o estado grande demais (Minas Gerais) baixado por mesorregião; com as três
// variáveis juntas, até uma mesorregião do Rio Grande do Sul passava do limite.
const VARIAVEIS = ['216', '215', '214'];
const url = (nivel, codigo, variavel) => `https://apisidra.ibge.gov.br/values/t/5457/n6/in%20${nivel}%20${codigo}/v/${variavel}/p/last/c782/allxt`;
const DESTINO = new URL('../src/lib/dados/producao-municipal.json', import.meta.url);
const { mesorregioes } = JSON.parse(fs.readFileSync(new URL('../src/lib/dados/mesorregioes.json', import.meta.url), 'utf8'));
const mesorregioesDaUF = (uf) => Object.keys(mesorregioes).filter((m) => m.startsWith(String(uf)));

async function baixar(nivel, codigo, variavel) {
    const resposta = await fetch(url(nivel, codigo, variavel), { signal: AbortSignal.timeout(180_000) });
    if (resposta.ok) return (await resposta.json()).slice(1);
    if (nivel === 'n3' && resposta.status === 400) {
        const partes = [];
        for (const meso of mesorregioesDaUF(codigo)) partes.push(...await baixar('n8', meso, variavel));
        return partes;
    }
    throw new Error(`SIDRA respondeu ${resposta.status} para ${nivel} ${codigo} (variável ${variavel})`);
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

// município → produto → { hectares, valor (mil reais), toneladas }
const porMunicipio = new Map();
let ano = null;
for (const uf of UFS) {
    const linhas = [];
    for (const variavel of VARIAVEIS) linhas.push(...await baixar('n3', uf, variavel));
    for (const l of linhas) {
        const valor = Number(l.V);
        // "-" (zero), "..." e "X" (sigilo) não são números
        if (!Number.isFinite(valor) || valor <= 0 || REPETIDOS.has(l.D4C)) continue;
        ano ??= l.D3N;
        const produtos = porMunicipio.get(l.D1C) ?? new Map();
        porMunicipio.set(l.D1C, produtos);
        const p = produtos.get(l.D4C) ?? { nome: nomeLimpo(l.D4N), perene: PERENE(l.D4C) };
        produtos.set(l.D4C, p);
        if (l.D2C === '216') p.hectares = valor;
        if (l.D2C === '215') p.valor = valor;
        // O preço só sai da quantidade em toneladas (o coco já foi contado em mil frutos)
        if (l.D2C === '214' && l.MN === 'Toneladas') p.toneladas = valor;
    }
    process.stdout.write(`${uf} `);
}

const produtos = [];
const perenes = [];
const indice = new Map();
const municipios = {};
for (const [codigo, lista] of porMunicipio) {
    municipios[codigo] = [...lista.values()]
        .filter((p) => p.hectares)
        .sort((a, b) => b.hectares - a.hectares)
        .slice(0, CULTURAS_POR_MUNICIPIO)
        .flatMap(({ nome, perene, hectares, valor, toneladas }) => {
            if (!indice.has(nome)) {
                indice.set(nome, produtos.length);
                if (perene) perenes.push(produtos.length);
                produtos.push(nome);
            }
            const porHectare = valor ? Math.round((valor * 1000) / hectares) : 0;
            const porTonelada = valor && toneladas ? Math.round((valor * 1000) / toneladas) : 0;
            return [indice.get(nome), hectares, porHectare, porTonelada];
        });
}

fs.writeFileSync(DESTINO, `${JSON.stringify({ fonte: 'IBGE, Produção Agrícola Municipal (SIDRA, tabela 5457): área colhida, valor e quantidade produzida', ano, geradoEm: new Date().toISOString().slice(0, 10), produtos, perenes, municipios })}\n`);
console.log(`\n${Object.keys(municipios).length} municípios, ${produtos.length} produtos, ano ${ano}.`);
