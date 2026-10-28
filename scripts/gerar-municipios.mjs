// Gera public/municipios/<UF>.json com os municípios de cada estado, a partir da API de
// localidades do IBGE (gratuita, sem chave). O Meu Cultivo carrega o arquivo do estado
// escolhido para a busca de cidade; a tela não depende do IBGE estar no ar.
//
// Uso: node scripts/gerar-municipios.mjs
// Rodar de novo só se o IBGE criar ou renomear municípios (raro).
import fs from 'node:fs';
import path from 'node:path';

const URL_IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado';
const PASTA = path.join('public', 'municipios');

const res = await fetch(URL_IBGE);
if (!res.ok) throw new Error(`IBGE: HTTP ${res.status}`);
const lista = await res.json();

const porEstado = new Map();
for (const m of lista) {
    const uf = m['UF-sigla'];
    const codigo = String(m['municipio-id']);
    if (!/^[A-Z]{2}$/.test(uf) || !/^\d{7}$/.test(codigo)) throw new Error(`registro inesperado: ${JSON.stringify(m)}`);
    if (!porEstado.has(uf)) porEstado.set(uf, []);
    // c = código do IBGE (7 dígitos), n = nome
    porEstado.get(uf).push({ c: codigo, n: m['municipio-nome'] });
}

fs.mkdirSync(PASTA, { recursive: true });
for (const [uf, municipios] of porEstado) {
    municipios.sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
    fs.writeFileSync(path.join(PASTA, `${uf}.json`), JSON.stringify(municipios));
}
console.log(`${lista.length} municípios em ${porEstado.size} estados, em ${PASTA}/`);
