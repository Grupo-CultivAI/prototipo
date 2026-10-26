// Cenários de regressão do chat (Frente 1). Roda contra um servidor no ar:
//   npm run dev            (em outro terminal)
//   npm run cenarios-chat  (ou: node tests/cenarios-chat.mjs http://localhost:3000)
// Cria usuários descartáveis e os apaga ao final. Consome ~12 chamadas do Gemini e da Groq.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const BASE = process.argv[2] || 'http://localhost:3000';
const SENHA = 'senhaDeTeste123';
const sufixo = Date.now();
const emails = [];
const resultados = [];

async function novoUsuario(rotulo) {
    const email = `cenario-${rotulo}-${sufixo}@exemplo.invalido`;
    emails.push(email);
    await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: `Cenário ${rotulo}`, email, senha: SENHA }) });
    const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha: SENHA }) });
    const m = (r.headers.get('set-cookie') || '').match(/authToken=([^;]+)/);
    if (!m) throw new Error(`login do usuário de teste falhou (HTTP ${r.status})`);
    return `authToken=${m[1]}`;
}

async function perguntar(cookie, pergunta) {
    const r = await fetch(`${BASE}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ question: pergunta }) });
    const d = await r.json().catch(() => ({}));
    const texto = d.parsedData?.resposta || d.message || '';
    const campos = (d.parsedData?.campos_necessarios || []).map((c) => c.chave);
    return { status: r.status, texto, fontes: d.fontes || [], campos, citaEmbrapa: texto.includes('📘'), aviso: texto.includes('⚠️ Parte desta resposta') };
}

function registrar(cenario, verificacoes, r) {
    const falhas = verificacoes.filter(([, ok, obrigatoria]) => !ok && obrigatoria).map(([nome]) => nome);
    const observacoes = verificacoes.filter(([, ok, obrigatoria]) => !ok && !obrigatoria).map(([nome]) => nome);
    resultados.push({ cenario, falhas, observacoes, r });
}

try {
    // 1. Pergunta do tema, com perfil preenchido
    const a = await novoUsuario('tema');
    await fetch(`${BASE}/api/propriedade`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
        body: JSON.stringify({ estado: 'MS', cidade: 'Dourados', tipoSolo: 'arenoso', culturasHistorico: ['soja', 'milho'], problemasRecentes: ['Pragas'], objetivos: ['Recuperar solo'] }),
    });
    let r = await perguntar(a, 'O que plantar depois do milho na minha área?');
    registrar('1. Pergunta do tema', [
        ['responde (HTTP 200)', r.status === 200, true],
        ['lista fontes', r.fontes.length > 0, true],
        ['cita a Embrapa', r.citaEmbrapa, true],
        ['sem aviso de número sem respaldo', !r.aviso, false],
        ['menciona algo do perfil (arenoso/Dourados/MS)', /arenos|dourados|\bms\b|mato grosso do sul/i.test(r.texto), false],
        ['não pede dado que o perfil já tem', r.campos.length === 0, true],
    ], r);

    // 2. Fora do tema
    r = await perguntar(a, 'Me passa uma receita de bolo de chocolate?');
    registrar('2. Fora do tema', [
        ['responde (HTTP 200)', r.status === 200, true],
        ['nenhuma fonte', r.fontes.length === 0, true],
        ['não cita a Embrapa', !r.citaEmbrapa, true],
    ], r);

    // 3. Agricultura fora da base
    r = await perguntar(a, 'Como criar galinhas caipiras no quintal?');
    registrar('3. Agricultura não coberta pela base', [
        ['responde (HTTP 200)', r.status === 200, true],
        ['não cita a Embrapa sem fonte', !(r.citaEmbrapa && r.fontes.length === 0), true],
    ], r);

    // 4. Continuação de conversa
    const b = await novoUsuario('historico');
    await perguntar(b, 'O que plantar depois de milho?');
    r = await perguntar(b, 'E se o solo for arenoso?');
    registrar('4. Continuação ("e se o solo for arenoso?")', [
        ['responde (HTTP 200)', r.status === 200, true],
        ['mantém o assunto (menciona milho, rotação ou sucessão)', /milho|rota[cç][aã]o|sucess[aã]o/i.test(r.texto), true],
    ], r);

    // 5. Pedido de dado que falta no perfil. Pedir ou não é decisão do modelo; o que não pode
    // acontecer é a marca [PEDIR: ...] chegar ao produtor, pedir o que já está no perfil ou
    // insistir na pergunta seguinte.
    const e = await novoUsuario('pedido');
    await fetch(`${BASE}/api/propriedade`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: e },
        body: JSON.stringify({ tipoSolo: 'argiloso', culturasHistorico: ['milho'] }),
    });
    r = await perguntar(e, 'O que devo plantar depois do milho na minha propriedade?');
    const pediu = r.campos.length > 0;
    const seguinte = await perguntar(e, 'E depois da soja?');
    registrar('5. Pedido de dado que falta (só a localização)', [
        ['responde (HTTP 200)', r.status === 200, true],
        ['a marca [PEDIR] não aparece no texto', !/\[PEDIR/i.test(r.texto + seguinte.texto), true],
        ['só pede o que falta (estado/cidade)', r.campos.every((c) => c === 'estado' || c === 'cidade'), true],
        ['não pede de novo na pergunta seguinte', !pediu || seguinte.campos.length === 0, true],
        ['pediu a localização (decisão do modelo)', pediu, false],
    ], { ...r, texto: `[campos pedidos: ${r.campos.join(', ') || 'nenhum'}] ${r.texto}` });

    // 6. Limite de uso: 5 perguntas seguidas, a 5ª deve ser bloqueada pelo CultivAI.
    // A espera libera o limite por minuto da Groq, gasto pelos cenários anteriores; mesmo assim
    // as 4 primeiras podem falhar por ele, e isso é observação, não falha do limite do CultivAI.
    console.log('aguardando 60s para o limite por minuto da Groq se recompor...');
    await new Promise((r) => setTimeout(r, 60_000));
    const c = await novoUsuario('limite');
    const status = [];
    for (let i = 1; i <= 5; i++) status.push((await perguntar(c, `Pergunta rápida ${i}: o que é adubação verde?`)).status);
    registrar('6. Limite de 4 por minuto', [
        ['a 5ª é bloqueada pelo CultivAI (HTTP 429)', status[4] === 429, true],
        ['as 4 primeiras respondem (depende da folga da Groq)', status.slice(0, 4).every((s) => s === 200), false],
    ], { status: status.join(', '), texto: '', fontes: [] });

    // 7. Nova conversa e apagar conversa, com o usuário do cenário 6 (sem chamar a IA).
    const historico = async (cookie) => (await fetch(`${BASE}/api/chat/history`, { headers: { Cookie: cookie } })).json();
    const novaConversa = async (cookie) => (await fetch(`${BASE}/api/conversas`, { method: 'POST', headers: { Cookie: cookie } })).json();
    const antes = await historico(c);
    const nova = await novaConversa(c);
    const depois = await historico(c);
    const outraVez = await novaConversa(c);
    const apagada = await (await fetch(`${BASE}/api/chat/history?conversa=${antes.conversaId}`, { method: 'DELETE', headers: { Cookie: c } })).json();
    const final = await historico(c);
    registrar('7. Nova conversa', [
        ['a conversa anterior tinha mensagens', antes.history?.length > 0, true],
        ['a nova conversa começa vazia', depois.history?.length === 0 && depois.conversaId === nova.conversaId, true],
        ['o saldo de perguntas do dia não muda', depois.restantesHoje === antes.restantesHoje, true],
        ['clicar de novo sem perguntar não cria outra conversa', outraVez.conversaId === nova.conversaId, true],
        ['apagar a conversa antiga mantém o saldo de perguntas', apagada.success && final.restantesHoje === antes.restantesHoje, true],
    ], { status: `${antes.history?.length} mensagens → ${depois.history?.length}`, texto: '', fontes: [] });
} finally {
    if (emails.length) {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cultivai' });
        const db = mongoose.connection.db;
        const ids = (await db.collection('users').find({ email: { $in: emails } }).project({ _id: 1 }).toArray()).map((u) => u._id);
        await db.collection('chatmessages').deleteMany({ userId: { $in: ids } });
        await db.collection('conversas').deleteMany({ userId: { $in: ids } });
        await db.collection('propriedades').deleteMany({ userId: { $in: ids } });
        await db.collection('users').deleteMany({ _id: { $in: ids } });
        await mongoose.disconnect();
        console.log(`(${ids.length} usuário(s) de teste removido(s))`);
    }
}

let falhou = false;
for (const { cenario, falhas, observacoes, r } of resultados) {
    console.log(`\n${falhas.length ? '❌' : '✅'} ${cenario}`);
    falhas.forEach((f) => console.log(`   falhou: ${f}`));
    observacoes.forEach((o) => console.log(`   observação: ${o}`));
    if (r.fontes?.length) console.log(`   fontes: ${r.fontes.map((f) => f.fonte ?? f).join('; ')}`);
    if (r.texto) console.log(`   resposta: ${r.texto.replace(/\s+/g, ' ').slice(0, 220)}...`);
    if (typeof r.status === 'string') console.log(`   status: ${r.status}`);
    if (falhas.length) falhou = true;
}
process.exit(falhou ? 1 : 0);
