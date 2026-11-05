// Gera src/lib/dados/mesorregioes.json: a micro e a mesorregião de cada município, da API de
// localidades do IBGE (https://servicodados.ibge.gov.br/api/docs/localidades). O chat usa a
// mesorregião para saber em que parte do estado fica o cultivo (src/lib/mesorregiao.ts): no
// Nordeste, a época das chuvas muda de uma para outra.
//
// Uso: node scripts/gerar-mesorregioes.mjs
// Rodar de novo só quando o IBGE criar municípios (o último foi Boa Esperança do Norte/MT, em 2023).
//
// Formato, para o arquivo ficar pequeno (~100 KB):
//   municipios:    { "2909802": 29020 }            geocódigo → microrregião
//   microrregioes: { "29020": ["Santo Antônio de Jesus", 2905] }
//   mesorregioes:  { "2905": ["Metropolitana de Salvador", "BA"] }
import fs from 'node:fs';

const URL_DO_IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
const DESTINO = new URL('../src/lib/dados/mesorregioes.json', import.meta.url);

const resposta = await fetch(URL_DO_IBGE, { signal: AbortSignal.timeout(60_000) });
if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status}`);
const lista = await resposta.json();

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

fs.writeFileSync(DESTINO, `${JSON.stringify({ fonte: URL_DO_IBGE, geradoEm: new Date().toISOString().slice(0, 10), municipios, microrregioes, mesorregioes })}\n`);
console.log(`${Object.keys(municipios).length} municípios, ${Object.keys(microrregioes).length} microrregiões, ${Object.keys(mesorregioes).length} mesorregiões.`);
if (semMicro.length) console.log(`Sem microrregião no IBGE (ficam sem mesorregião): ${semMicro.join(', ')}`);
