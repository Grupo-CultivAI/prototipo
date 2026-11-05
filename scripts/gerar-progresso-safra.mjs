// Gera src/lib/dados/progresso-safra.json: quanto da área de cada cultura já foi semeada ou colhida
// em cada estado, do "Progresso de Safra" da Conab (planilha "Plantio e Colheita", semanal):
// https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras/progresso-de-safra
// O chat usa para dizer como anda o plantio no estado do produtor (src/lib/progressoSafra.ts).
//
// Uso: node scripts/gerar-progresso-safra.mjs
// Rodar toda semana, depois que a Conab publicar a planilha nova (em geral na segunda ou terça).
// O chat deixa de usar os dados quando eles passam de 3 semanas.
//
// Formato:
//   semana: "2026-10-30"   (data de referência dos números)
//   culturas: [{ nome: "Feijão 1ª", safra: "2026/27", etapa: "semeadura",
//                ufs: { "MG": [anoPassado, semanaAnterior, atual, media5anos] } }]   (frações de 0 a 1)
import fs from 'node:fs';
import zlib from 'node:zlib';

const LISTAGEM = 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras/progresso-de-safra';
const DESTINO = new URL('../src/lib/dados/progresso-safra.json', import.meta.url);
const UF = {
    acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
    'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
    'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
    'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO',
    roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};
const sem = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

async function baixar(url, tipo) {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!resposta.ok) throw new Error(`gov.br respondeu ${resposta.status} para ${url}`);
    return tipo === 'texto' ? resposta.text() : Buffer.from(await resposta.arrayBuffer());
}

// Um .xlsx é um zip: lê o diretório central e descompacta cada parte (só "deflate" ou sem compressão)
function lerZip(buf) {
    let fim = buf.length - 22;
    while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
    if (fim < 0) throw new Error('a planilha não é um arquivo .xlsx válido');
    const partes = new Map();
    let p = buf.readUInt32LE(fim + 16);
    for (let i = buf.readUInt16LE(fim + 10); i > 0; i--) {
        const metodo = buf.readUInt16LE(p + 10);
        const tamanho = buf.readUInt32LE(p + 20);
        const [nome, extra, comentario] = [buf.readUInt16LE(p + 28), buf.readUInt16LE(p + 30), buf.readUInt16LE(p + 32)];
        const local = buf.readUInt32LE(p + 42);
        const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const dados = buf.subarray(inicio, inicio + tamanho);
        partes.set(buf.toString('utf8', p + 46, p + 46 + nome), metodo === 8 ? zlib.inflateRawSync(dados) : dados);
        p += 46 + nome + extra + comentario;
    }
    return partes;
}

// Linhas da primeira aba: { B: "Minas Gerais", C: 0.25, ... }
function linhasDaPlanilha(buf) {
    const zip = lerZip(buf);
    const xml = (nome) => zip.get(nome)?.toString('utf8') ?? '';
    const decodificar = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    const textos = [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
        .map((m) => decodificar([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join('')));
    return [...xml('xl/worksheets/sheet1.xml').matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((r) => Object.fromEntries(
        [...r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
            .map((c) => {
                const v = (c[3] || '').match(/<v>([^<]*)<\/v>/)?.[1];
                if (v == null) return null;
                return [c[1], /t="s"/.test(c[2]) ? textos[Number(v)] : Number(v)];
            })
            .filter(Boolean),
    ));
}

// Data do Excel (dias desde 30/12/1899) → "2026-10-30"
const dataDoExcel = (n) => new Date(Math.round((n - 25569) * 86_400_000)).toISOString().slice(0, 10);

// 1. A semana mais recente na listagem e, nela, a planilha "Plantio e Colheita"
const listagem = await baixar(LISTAGEM, 'texto');
const pagina = listagem.match(/href="([^"]*\/progresso-de-safra\/acompanhamento-das-lavouras-[^"]*)"/)?.[1];
if (!pagina) throw new Error('não achei a semana mais recente na listagem da Conab');
const planilha = (await baixar(pagina, 'texto')).match(/href="([^"]*plantio-e-colheita[^"]*\.xlsx)"/)?.[1];
if (!planilha) throw new Error(`não achei a planilha "Plantio e Colheita" em ${pagina}`);

// 2. Os blocos: "Feijão 1ª - Safra 2026/27", depois "Semeadura" ou "Colheita*", e uma linha por estado
const culturas = [];
let cultura = null;
let etapa = null;
let semana = null;
for (const linha of linhasDaPlanilha(await baixar(planilha))) {
    const texto = typeof linha.B === 'string' ? linha.B.trim() : '';
    const titulo = texto.match(/^(.+?)\s*-\s*Safra\s+(\d{4}(?:\/\d{2})?)$/i);
    if (titulo) { cultura = { nome: titulo[1].trim(), safra: titulo[2] }; etapa = null; continue; }
    if (/^semeadura/i.test(texto) || /^colheita/i.test(texto)) {
        if (!cultura) continue;
        etapa = { nome: cultura.nome, safra: cultura.safra, etapa: /^semeadura/i.test(texto) ? 'semeadura' : 'colheita', ufs: {} };
        culturas.push(etapa);
        continue;
    }
    // Linha das datas: ano passado, semana anterior e semana atual
    if (typeof linha.E === 'number' && linha.E > 40_000 && !texto) { semana ??= dataDoExcel(linha.E); continue; }
    const uf = UF[sem(texto)];
    if (etapa && uf && typeof linha.E === 'number') {
        etapa.ufs[uf] = [linha.C, linha.D, linha.E, linha.F].map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : null));
    }
}
const comDados = culturas.filter((c) => Object.keys(c.ufs).length);
if (!semana || !comDados.length) throw new Error('a planilha mudou de formato: nenhuma cultura ou data reconhecida');

fs.writeFileSync(DESTINO, `${JSON.stringify({ fonte: 'Conab, Progresso de Safra', planilha, semana, geradoEm: new Date().toISOString().slice(0, 10), culturas: comDados }, null, 1)}\n`);
console.log(`Semana até ${semana}: ${comDados.map((c) => `${c.nome} ${c.safra} (${c.etapa}, ${Object.keys(c.ufs).length} estados)`).join('; ')}`);
