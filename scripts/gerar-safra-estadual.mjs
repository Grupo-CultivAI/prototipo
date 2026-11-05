// Gera src/lib/dados/safra-estadual.json: a estimativa da safra do ano em cada estado, do
// Levantamento Sistemático da Produção Agrícola do IBGE (LSPA, tabela 6588 do SIDRA, mensal).
// Para cada cultura: rendimento médio e produção do último levantamento publicado e da safra do
// ano anterior (o levantamento de dezembro). O chat usa para comparar a colheita do produtor com a
// média do estado e para dizer quando o ano foi ruim no estado todo (src/lib/safraEstadual.ts).
//
// Uso: node scripts/gerar-safra-estadual.mjs
// Rodar de novo todo mês, depois que o IBGE publicar o levantamento novo (em geral no meio do mês).
//
// Formato:
//   produtos: ["Feijão (1ª Safra)", ...]
//   ufs:      { "MG": { "0": [rendimento, rendimentoAnterior, producao, producaoAnterior] } }
//             rendimento em quilos por hectare, produção em toneladas; null quando o IBGE não tem
import fs from 'node:fs';

const SIDRA = 'https://apisidra.ibge.gov.br/values/t/6588/n3/all';
const DESTINO = new URL('../src/lib/dados/safra-estadual.json', import.meta.url);
// Grupos, não culturas: "Total", "1 Cereais, leguminosas e oleaginosas" e "9/10 Café total", que
// vem vazio (o café tem os valores por espécie: arábica e canephora)
const FORA = new Set(['0', '39428', '40527']);
const UF_DO_CODIGO = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' };

async function baixar(caminho) {
    const resposta = await fetch(`${SIDRA}${caminho}`, { signal: AbortSignal.timeout(120_000) });
    if (!resposta.ok) throw new Error(`SIDRA respondeu ${resposta.status} para ${caminho}`);
    return (await resposta.json()).slice(1);
}

// O último levantamento publicado (ex.: 202609) e o de dezembro do ano anterior
const [ultima] = await baixar('/v/36/p/last%201/c48/39443');
const periodo = ultima.D3C;
const ano = Number(periodo.slice(0, 4));
const anterior = `${ano - 1}12`;
const linhas = await baixar(`/v/35,36/p/${anterior},${periodo}/c48/allxt`);

// "1.9 Feijão (1ª Safra)" → "Feijão (1ª Safra)"; "9 Café arábica" → "Café arábica"
const nomeLimpo = (nome) => nome.replace(/^[\d./]+\s+/, '').trim();
const produtos = [];
const indice = new Map();
const ufs = {};
for (const l of linhas) {
    if (FORA.has(l.D4C)) continue;
    const valor = Number(l.V);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const nome = nomeLimpo(l.D4N);
    if (!indice.has(nome)) { indice.set(nome, produtos.length); produtos.push(nome); }
    const uf = UF_DO_CODIGO[l.D1C];
    const dados = (ufs[uf] ??= {})[indice.get(nome)] ??= [null, null, null, null];
    // Posição: rendimento (36) ou produção (35), deste ano ou do anterior
    const posicao = (l.D2C === '36' ? 0 : 2) + (l.D3C === periodo ? 0 : 1);
    dados[posicao] = Math.round(valor);
}

const mes = ultima.D3N; // "setembro 2026"
fs.writeFileSync(DESTINO, `${JSON.stringify({ fonte: 'IBGE, Levantamento Sistemático da Produção Agrícola (SIDRA, tabela 6588)', periodo, mes, ano, anoAnterior: ano - 1, geradoEm: new Date().toISOString().slice(0, 10), produtos, ufs })}\n`);
console.log(`Levantamento de ${mes}, comparado com dezembro de ${ano - 1}: ${produtos.length} culturas, ${Object.keys(ufs).length} estados.`);
