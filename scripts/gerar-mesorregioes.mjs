// Gera src/lib/dados/mesorregioes.json: a micro e a mesorregião de cada município, da API de
// localidades do IBGE (https://servicodados.ibge.gov.br/api/docs/localidades). O chat usa a
// mesorregião para saber em que parte do estado fica o cultivo (src/lib/mesorregiao.ts): no
// Nordeste, a época das chuvas muda de uma para outra.
//
// Uso: node scripts/gerar-mesorregioes.mjs
// Rodar de novo só quando o IBGE criar municípios (o último foi Boa Esperança do Norte/MT, em 2023).
//
// Também guarda o centro de cada município (API de malhas do IBGE), para a chuva dos últimos dias
// (src/lib/weather.ts, Open-Meteo) nos cultivos sem o ponto marcado no mapa.
//
// Formato, para o arquivo ficar pequeno (~230 KB):
//   municipios:    { "2909802": 29020 }            geocódigo → microrregião
//   microrregioes: { "29020": ["Santo Antônio de Jesus", 2905] }
//   mesorregioes:  { "2905": ["Metropolitana de Salvador", "BA"] }
//   centros:       { "2909802": [-12.683, -39.1179] } geocódigo → [latitude, longitude]
import fs from 'node:fs';

const URL_DO_IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
const URL_DOS_CENTROS = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR/metadados?intrarregiao=municipio';
const DESTINO = new URL('../src/lib/dados/mesorregioes.json', import.meta.url);

async function baixar(url) {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status} em ${url}`);
    return resposta.json();
}
const [lista, malhas] = await Promise.all([baixar(URL_DO_IBGE), baixar(URL_DOS_CENTROS)]);
const centros = Object.fromEntries(malhas
    .filter((m) => m.centroide)
    .map((m) => [m.id, [m.centroide.latitude, m.centroide.longitude]]));

const municipios = {};
const microrregioes = {};
const mesorregioes = {};
const semMicro = [];
for (const m of lista) {
    const micro = m.microrregiao;
    // Municípios criados depois de 2017 podem vir sem microrregião
    if (!micro) { semMicro.push(`${m.nome} (${m.id})`); continue; }
    const meso = micro.mesorregiao;
    municipios[m.id] = micro.id;
    microrregioes[micro.id] = [micro.nome, meso.id];
    mesorregioes[meso.id] = [meso.nome, meso.UF.sigla];
}

fs.writeFileSync(DESTINO, `${JSON.stringify({ fonte: [URL_DO_IBGE, URL_DOS_CENTROS], geradoEm: new Date().toISOString().slice(0, 10), municipios, microrregioes, mesorregioes, centros })}\n`);
console.log(`${Object.keys(municipios).length} municípios, ${Object.keys(microrregioes).length} microrregiões, ${Object.keys(mesorregioes).length} mesorregiões, ${Object.keys(centros).length} centros.`);
if (semMicro.length) console.log(`Sem microrregião no IBGE (ficam sem mesorregião): ${semMicro.join(', ')}`);
