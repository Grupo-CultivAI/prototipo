// Avaliação das respostas da IA (Frentes 1 e 3), com a IA de verdade. Faz as perguntas do teste
// com personas e casos de época e região, cada uma com o perfil da persona, e confere:
//   - obrigatório: resposta HTTP 200, nenhum erro agronômico conhecido (src/lib/errosAgronomicos.ts),
//     nenhum agrotóxico com dose e o que cada caso espera (por exemplo, planta de inverno no Sul);
//   - observação: legibilidade (Flesch adaptado ao português), tamanho das respostas a perguntas
//     informais, aviso de "não conferido" e qual modelo respondeu.
// Roda toda semana na CI (.github/workflows/avaliacao-semanal.yml) e localmente:
//   MONGODB_URI=mongodb://127.0.0.1:27999/cultivai npm run dev                 (em outro terminal)
//   MONGODB_URI=mongodb://127.0.0.1:27999/cultivai npm run avaliar-respostas
// Opções: --pausa 40 (segundos entre perguntas; menos que isso estoura o limite por minuto da Groq
// e a resposta vem de um modelo pior), --caso josiane (só um caso).
// Consome ~10 perguntas da cota da IA. Cria usuários descartáveis e os apaga ao final.
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { problemaAgronomico } from '../src/lib/errosAgronomicos.ts';
import { frasesComAgrotoxico } from '../src/lib/agrotoxicos.ts';
import { descreverBanco, exigirBancoDeTeste } from '../scripts/banco.mjs';
dotenv.config({ path: '.env.local', quiet: true });
exigirBancoDeTeste(process.env.MONGODB_URI);

const args = process.argv.slice(2);
const opcao = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const valores = new Set(['--pausa', '--caso'].map(opcao).filter(Boolean));
const BASE = args.find((a) => !a.startsWith('--') && !valores.has(a)) || 'http://localhost:3000';
const PAUSA_MS = Number(opcao('--pausa') ?? 40) * 1000;
const SO = opcao('--caso');
const SENHA = 'senhaDeTeste123';
const sufixo = Date.now();
const j = { 'Content-Type': 'application/json' };

// Índice de legibilidade de Flesch adaptado ao português (Martins et al., 1996): 75 a 100 muito
// fácil, 50 a 75 fácil, 25 a 50 difícil. Sílabas contadas por grupos de vogais (aproximado).
function legibilidade(texto) {
    const limpo = texto.replace(/\n> ⚠️[^\n]*/g, '').replace(/[*_#>`|]/g, ' ').replace(/\s+/g, ' ').trim();
    const frases = limpo.split(/[.!?:;]+\s|\n/).filter((f) => f.trim().split(' ').length > 2).length || 1;
    const palavras = limpo.match(/[A-Za-zÀ-ÿ]+/g) || [];
    const silabas = palavras.reduce((s, p) => s + Math.max(1, (p.toLowerCase().match(/[aeiouáéíóúâêôãõàü]+/g) || []).length), 0);
    return { ifl: Math.round(248.835 - 1.015 * (palavras.length / frases) - 84.6 * (silabas / (palavras.length || 1))), palavras: palavras.length };
}

const CIDA = { nome: 'Roça de casa', estado: 'MG', cidade: 'Patos de Minas', codigoMunicipio: '3148004', tamanho: '3', tipoSolo: 'nao_sei', culturasHistorico: ['Milho', 'Feijão'], proximaCultura: 'Feijão', objetivos: ['Aumentar produtividade'] };
const PLANTA_DE_INVERNO = /aveia|nabo|ervilhaca|centeio|tremo[cç]o|azev[eé]m/i;

// Documentos com a condição do experimento no catálogo (área irrigada, Cerrado, região...).
// Quando a resposta cita a Embrapa e a busca trouxe um deles, a condição deveria aparecer no
// texto (regra do prompt de 2026-11-04). Observação, e não falha: se o produtor está na mesma
// condição, não citá-la está certo.
const CATALOGO = JSON.parse(fs.readFileSync(new URL('../src/lib/documentos.json', import.meta.url), 'utf8'));
const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const GENERICAS = new Set(['regiao', 'area', 'sistema', 'producao', 'agricultura', 'reforma']);
// Raízes de 5 letras das palavras da condição: "irrigada por aspersão" casa com "irrigação"
const raizesDaCondicao = (condicao) => semAcento(condicao).match(/[a-z]{5,}/g).filter((p) => !GENERICAS.has(p)).map((p) => p.slice(0, 5));
function condicoesSemCitar(texto, fontes) {
    if (!texto.includes('📘')) return [];
    const normal = semAcento(texto);
    return (fontes || [])
        .map((f) => CATALOGO[f.fonte ?? f]?.condicao)
        .filter(Boolean)
        .filter((condicao) => !raizesDaCondicao(condicao).some((raiz) => normal.includes(raiz)));
}
// [descrição, teste, obrigatória]
const CASOS = [
    { id: 'cida-analise', persona: 'Dona Cida (MG, Cerrado, sem irrigação)', perfil: CIDA,
        pergunta: 'Com base no perfil da minha propriedade, que rotação de culturas você recomenda para as próximas safras?', informal: false, espera: [] },
    { id: 'cida-feijao', persona: 'Dona Cida (MG)', perfil: CIDA, pergunta: 'meu feijao ta dando pouco o que eu faço', informal: true, espera: [] },
    { id: 'antonio', persona: 'Seu Antônio (SP)', perfil: { nome: 'Sítio São José', estado: 'SP', cidade: 'Itapetininga', codigoMunicipio: '3522307', tamanho: '8', culturasHistorico: ['Feijão', 'Milho'], proximaCultura: 'Feijão' },
        pergunta: 'quando eu planto feijão aqui', informal: true,
        espera: [['dá a janela oficial do feijão (1º de agosto a 31 de dezembro)', (t) => /01\/08|1º? de agosto/.test(t) && /31\/12|31 de dezembro/.test(t), true]] },
    { id: 'josiane', persona: 'Josiane (PR, inverno com geada)', perfil: { nome: 'Lote 32', estado: 'PR', cidade: 'Rio Bonito do Iguaçu', codigoMunicipio: '4122156', culturasHistorico: ['Milho', 'Feijão'] },
        pergunta: 'depois do milho o que eu planto no inverno pra melhorar a terra?', informal: true,
        espera: [['indica planta de inverno (aveia, nabo, ervilhaca, centeio...)', (t) => PLANTA_DE_INVERNO.test(t), true]] },
    { id: 'rafael', persona: 'Rafael (ES, café irrigado)', perfil: { nome: 'Lavoura do pai', estado: 'ES', cidade: 'Venda Nova do Imigrante', codigoMunicipio: '3205069', tamanho: '12', tipoSolo: 'argiloso', phSolo: 5.4, materiaOrganica: 'Média', drenagem: 'Boa', analiseSolo: true, culturasHistorico: ['Café', 'Feijão', 'Milho'], sistemaPlantio: 'Plantio direto', irrigacao: 'Gotejamento', problemasRecentes: ['Pragas'], proximaCultura: 'Milho', objetivos: ['Recuperar solo', 'Diversificar produção'] },
        pergunta: 'Monte um plano de rotação para as próximas 3 safras nesta área, considerando que o café fica e quero recuperar o solo nas entrelinhas.', informal: false,
        espera: [['não põe milho nas entrelinhas do café', (t) => !/milho[^.\n]{0,40}entrelinha|entrelinha[^.\n]{0,40}milho/i.test(t), false]] },
    { id: 'ze', persona: 'Seu Zé (sem cultivo cadastrado)', perfil: null, pergunta: 'oque planta dps da mandioca pra terra nao fica fraca', informal: true,
        espera: [['sem a região, não indica só plantas de frio', (t) => !PLANTA_DE_INVERNO.test(t) || /regi[aã]o|depende|frio|sul/i.test(t), false]] },
    { id: 'inverno-rs', persona: 'Sul sem ZARC no banco (RS)', perfil: { nome: 'Chácara', estado: 'RS', cidade: 'Passo Fundo', culturasHistorico: ['Soja', 'Milho'] },
        pergunta: 'o que eu planto no inverno pra cobrir o solo depois da soja?', informal: true,
        espera: [['indica planta de inverno', (t) => PLANTA_DE_INVERNO.test(t), true]] },
    { id: 'inverno-seco-go', persona: 'Cerrado sem irrigação (GO)', perfil: { nome: 'Sítio Boa Vista', estado: 'GO', cidade: 'Rio Verde', irrigacao: 'Não irrigo', culturasHistorico: ['Soja', 'Milho'] },
        pergunta: 'posso plantar alguma cobertura no inverno pra proteger a terra?', informal: true, espera: [] },
].filter((c) => !SO || c.id === SO);

const emails = [];
const resultados = [];
await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cultivai' });
const db = mongoose.connection.db;
try {
    // O banco descartável da CI começa vazio: as janelas do ZARC dos municípios dos casos vêm
    // da amostra (dados abertos do MAPA).
    if (!(await db.collection('zarcmunicipios').estimatedDocumentCount())) {
        const amostra = JSON.parse(fs.readFileSync(new URL('./dados/zarc-amostra.json', import.meta.url), 'utf8'));
        await db.collection('zarcmunicipios').insertMany(amostra.municipios);
        console.log(`(ZARC: ${amostra.municipios.length} municípios da amostra carregados no banco ${descreverBanco(process.env.MONGODB_URI)})`);
    }

    for (const [i, c] of CASOS.entries()) {
        if (i) await new Promise((ok) => setTimeout(ok, PAUSA_MS));
        const email = `avaliacao-${c.id}-${sufixo}@exemplo.invalido`;
        emails.push(email);
        await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: j, body: JSON.stringify({ nome: c.persona, email, senha: SENHA, aceitouPrivacidade: true }) });
        const l = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: j, body: JSON.stringify({ email, senha: SENHA }) });
        const m = (l.headers.get('set-cookie') || '').match(/authToken=([^;]+)/);
        if (!m) throw new Error(`login do usuário de teste falhou (HTTP ${l.status})`);
        const Cookie = `authToken=${m[1]}`;
        if (i === 0 && !(await db.collection('users').findOne({ email }))) {
            throw new Error(`o servidor ${BASE} grava em outro banco, e não em ${descreverBanco(process.env.MONGODB_URI)}. Suba o servidor com o mesmo MONGODB_URI.`);
        }
        if (c.perfil) await fetch(`${BASE}/api/cultivos`, { method: 'POST', headers: { ...j, Cookie }, body: JSON.stringify(c.perfil) });

        const t0 = Date.now();
        const r = await fetch(`${BASE}/api/llm`, { method: 'POST', headers: { ...j, Cookie }, body: JSON.stringify({ question: c.pergunta }) });
        const d = await r.json().catch(() => ({}));
        const texto = d.parsedData?.resposta ?? d.message ?? '';
        const gravada = d.mensagemId ? await db.collection('chatmessages').findOne({ _id: new mongoose.Types.ObjectId(String(d.mensagemId)) }) : null;
        const leg = legibilidade(texto);
        const erroAgronomico = problemaAgronomico(texto, { pergunta: c.pergunta, estado: c.perfil?.estado, irrigacao: c.perfil?.irrigacao });
        const verificacoes = [
            ['responde (HTTP 200)', r.status === 200, true],
            ['nenhum erro agronômico conhecido', !erroAgronomico, true],
            ['nenhum agrotóxico com dose', frasesComAgrotoxico(texto).length === 0, true],
            // A IA usa espaço fino inseparável (U+202F) e hífen inseparável (U+2011): "1 de agosto"
            // vinha com U+202F e não batia com a expressão do caso
            ...c.espera.map(([nome, teste, obrigatoria]) => [nome, r.status === 200 && teste(texto.replace(/[^\S\n]/g, ' ').replace(/[‐-―−]/g, '-')), obrigatoria]),
            ['legibilidade fácil (50 ou mais)', leg.ifl >= 50, false],
            ...(c.informal ? [['pergunta informal: até 200 palavras', leg.palavras <= 200, false]] : []),
            ['sem aviso de "não pôde ser conferido"', !texto.includes('⚠️ Parte desta resposta'), false],
            ...condicoesSemCitar(texto, d.fontes).map((condicao) => [`usou um estudo em "${condicao}" sem dizer a condição`, false, false]),
        ];
        resultados.push({
            caso: c.id, persona: c.persona, pergunta: c.pergunta, status: r.status, segundos: Math.round((Date.now() - t0) / 1000),
            ...leg, modelo: gravada?.metadata?.geracao?.modelo ?? '—', versaoPrompt: gravada?.metadata?.geracao?.versaoPrompt ?? '—',
            revisada: Boolean(gravada?.metadata?.geracao?.revisada), erroAgronomico,
            falhas: verificacoes.filter(([, ok, obrig]) => !ok && obrig).map(([n]) => n),
            observacoes: verificacoes.filter(([, ok, obrig]) => !ok && !obrig).map(([n]) => n),
            texto,
        });
        const ultimo = resultados.at(-1);
        console.log(`${ultimo.falhas.length ? '❌' : '✅'} ${c.id} | HTTP ${r.status} | legibilidade ${leg.ifl} | ${leg.palavras} palavras | ${ultimo.modelo}${ultimo.revisada ? ' | reescrita' : ''}`);
    }
} finally {
    if (emails.length) {
        const ids = (await db.collection('users').find({ email: { $in: emails } }).project({ _id: 1 }).toArray()).map((u) => u._id);
        for (const colecao of ['chatmessages', 'conversas', 'propriedades']) await db.collection(colecao).deleteMany({ userId: { $in: ids } });
        await db.collection('users').deleteMany({ _id: { $in: ids } });
        console.log(`(${ids.length} usuário(s) de teste removido(s))`);
    }
    await mongoose.disconnect();
}

// Resumo: no terminal, no resumo da execução na CI (GITHUB_STEP_SUMMARY) e em JSON
const media = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const linhas = resultados.map((r) => `| ${r.falhas.length ? '❌' : '✅'} ${r.caso} | ${r.status} | ${r.ifl} | ${r.palavras} | ${r.modelo}${r.revisada ? ' (reescrita)' : ''} | ${[...r.falhas.map((f) => `**${f}**`), ...r.observacoes].join('; ') || '—'} |`);
const resumo = [
    `## Avaliação das respostas da IA (${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
    '',
    `${resultados.filter((r) => !r.falhas.length).length} de ${resultados.length} casos sem falha obrigatória. Legibilidade média: ${media(resultados.map((r) => r.ifl))}. Versão do prompt: ${[...new Set(resultados.map((r) => r.versaoPrompt))].join(', ')}.`,
    '',
    '| Caso | HTTP | Legibilidade | Palavras | Modelo | Falhas (negrito) e observações |',
    '|---|---|---|---|---|---|',
    ...linhas,
].join('\n');
console.log(`\n${resumo}\n`);
for (const r of resultados.filter((x) => x.falhas.length || x.erroAgronomico)) {
    console.log(`--- ${r.caso}: ${r.pergunta}\n${r.erroAgronomico ? `Erro agronômico: ${r.erroAgronomico}\n` : ''}${r.texto}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${resumo}\n`);
// Fora do repositório: na CI, na pasta temporária do runner (o fluxo guarda o arquivo)
const saida = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'avaliacao-respostas.json');
fs.writeFileSync(saida, JSON.stringify(resultados, null, 2));
console.log(`(resultados completos em ${saida})`);
process.exit(resultados.some((r) => r.falhas.length) ? 1 : 0);
