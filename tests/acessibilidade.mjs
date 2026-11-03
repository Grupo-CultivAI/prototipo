// Checagem automática de acessibilidade (axe-core) nas telas do CultivAI, em celular e
// computador. Roda no CI a cada PR e também à mão:
//
//   npm run build && npm start          (ou npm run dev; num banco de teste, nunca no de produção)
//   npm run acessibilidade              (outro terminal)
//
// Cria uma conta de teste (email @exemplo.invalido) e um cultivo nela. Por isso precisa de um
// banco de teste: no CI é um MongoDB descartável; à mão, aponte MONGODB_URI para um banco local.
//
// Reprova (código 1) com problema "grave" ou "crítico" das regras WCAG 2.2 A e AA. Os de impacto
// "moderado" ou "menor" aparecem no relatório, mas não reprovam.
//
// Navegador: no CI, o Chromium do Playwright (npx playwright install chromium). À mão, sem ele
// instalado, use o Edge ou o Chrome da máquina: NAVEGADOR=msedge ou NAVEGADOR=chrome.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const REGRAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const REPROVA = new Set(['serious', 'critical']);
const IMPACTO = { critical: 'crítico', serious: 'grave', moderate: 'moderado', minor: 'menor' };
const TELAS = {
    celular: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    computador: { viewport: { width: 1366, height: 900 } },
};
const json = { 'Content-Type': 'application/json' };

async function criarConta() {
    const email = `teste-acessibilidade-${Date.now()}@exemplo.invalido`;
    const senha = 'senhaDeTeste123';
    const cadastro = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST', headers: json,
        body: JSON.stringify({ nome: 'Teste Acessibilidade', email, senha, aceitouPrivacidade: true }),
    });
    if (!cadastro.ok) throw new Error(`Cadastro falhou (${cadastro.status}): ${await cadastro.text()}`);
    const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, senha }) });
    const token = login.headers.get('set-cookie')?.match(/authToken=([^;]+)/)?.[1];
    if (!token) throw new Error(`Login falhou (${login.status})`);
    const cultivo = await fetch(`${BASE}/api/cultivos`, {
        method: 'POST', headers: { ...json, Cookie: `authToken=${token}` },
        body: JSON.stringify({ nome: 'Sítio de teste', estado: 'MG', cidade: 'Uberlândia', codigoMunicipio: '3170206' }),
    });
    const dados = await cultivo.json().catch(() => ({}));
    const id = dados.cultivo?._id ?? dados._id ?? dados.id;
    if (!cultivo.ok || !id) throw new Error(`Cadastro do cultivo falhou (${cultivo.status})`);
    return { token, cultivoId: id };
}

// Cada tela: endereço, se precisa de login e os estados a conferir. Um estado é uma ação na
// página (abrir um bloco, uma lista); null é a página como ela abre.
function telas(cultivoId) {
    const blocos = ['localizacao', 'solo', 'historico', 'objetivo', 'plano'].map((bloco) => ({
        nome: `bloco ${bloco}`,
        acao: async (p) => {
            const botao = p.locator(`#secao-${bloco} button`);
            if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.click();
        },
    }));
    return [
        { url: '/', estados: [null] },
        { url: '/login', estados: [null] },
        { url: '/cadastro', estados: [null] },
        { url: '/esqueci-senha', estados: [null] },
        { url: '/redefinir-senha', estados: [null] },
        { url: '/privacidade', estados: [null] },
        { url: '/painel', logado: true, estados: [null] },
        {
            url: '/chatbot', logado: true, estados: [
                null,
                { nome: 'lista de conversas', acao: (p) => p.getByRole('button', { name: 'Conversas anteriores' }).click() },
            ],
        },
        { url: '/meus-cultivos', logado: true, estados: [null] },
        { url: '/meus-cultivos/novo', logado: true, estados: blocos },
        { url: `/meus-cultivos/${cultivoId}`, nomeCurto: '/meus-cultivos/[id]', logado: true, estados: [null] },
        { url: '/conta', logado: true, estados: [null] },
    ];
}

// Medido no meio de uma transição de cor (o link do menu leva 0,3 s para escurecer), o contraste
// sai errado. Espera as transições acabarem; as animações sem fim (pontos do "pensando",
// esboço da tela) ficam de fora.
async function transicoesTerminadas(pagina) {
    await pagina.waitForTimeout(100);
    await pagina.evaluate(() => Promise.all(document.getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {}))));
}

async function abrirNavegador() {
    const canal = process.env.NAVEGADOR;
    return chromium.launch(canal ? { channel: canal } : {});
}

(async () => {
    const { token, cultivoId } = await criarConta();
    const navegador = await abrirNavegador();
    const achados = [];
    let conferidas = 0;
    try {
        for (const [tela, opcoes] of Object.entries(TELAS)) {
            const contexto = await navegador.newContext({ ...opcoes, locale: 'pt-BR' });
            await contexto.addCookies([{ name: 'authToken', value: token, url: BASE, httpOnly: true }]);
            const pagina = await contexto.newPage();
            for (const t of telas(cultivoId)) {
                for (const estado of t.estados) {
                    // O cookie vale para as duas; nas públicas, a pessoa estaria sem login.
                    if (!t.logado) await contexto.clearCookies();
                    else await contexto.addCookies([{ name: 'authToken', value: token, url: BASE, httpOnly: true }]);
                    await pagina.goto(`${BASE}${t.url}`, { waitUntil: 'networkidle', timeout: 90000 });
                    // Chat e Minha Conta mostram "carregando" até os dados chegarem
                    await pagina.waitForSelector('[aria-busy="true"]', { state: 'detached', timeout: 15000 }).catch(() => {});
                    await pagina.evaluate(() => document.querySelector('nextjs-portal')?.remove());
                    if (estado) await estado.acao(pagina);
                    // A barra de Salvar do formulário fica presa no pé da tela e, conforme a rolagem,
                    // passa por cima de botões do formulário, que o axe conta como alvos "cobertos".
                    // Acontecia ou não conforme a altura da tela e a fonte do sistema (no Linux do
                    // CI, sim). No fim da página a barra fica no seu lugar, depois do formulário.
                    await pagina.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
                    await transicoesTerminadas(pagina);
                    const resultado = await new AxeBuilder({ page: pagina }).withTags(REGRAS).analyze();
                    conferidas++;
                    const onde = `${tela} ${t.nomeCurto ?? t.url}${estado ? ` (${estado.nome})` : ''}`;
                    for (const v of resultado.violations) achados.push({ onde, ...v });
                }
            }
            await contexto.close();
        }
    } finally {
        await navegador.close();
    }

    // Mesmo problema em várias telas aparece uma vez, com a lista de onde ocorre
    const porRegra = new Map();
    for (const a of achados) {
        const atual = porRegra.get(a.id) ?? { ...a, ondes: [], alvos: new Map() };
        atual.ondes.push(a.onde);
        for (const n of a.nodes.slice(0, 3)) {
            // O motivo vem em inglês do axe; a 1ª linha útil diz o que medir (ex.: o contraste)
            const motivo = n.failureSummary?.split('\n').map((l) => l.trim()).filter(Boolean)[1] ?? '';
            atual.alvos.set(n.target.join(' '), motivo);
        }
        porRegra.set(a.id, atual);
    }
    const lista = [...porRegra.values()].sort((a, b) => Number(REPROVA.has(b.impact)) - Number(REPROVA.has(a.impact)));
    console.log(`\nAcessibilidade (axe-core, WCAG 2.2 A/AA): ${conferidas} telas e estados conferidos.\n`);
    for (const r of lista) {
        console.log(`${REPROVA.has(r.impact) ? 'REPROVA' : 'aviso  '} [${IMPACTO[r.impact] ?? r.impact}] ${r.id}: ${r.help}`);
        console.log(`        ${r.helpUrl}`);
        console.log(`        onde: ${[...new Set(r.ondes)].join('; ')}`);
        for (const [alvo, motivo] of [...r.alvos].slice(0, 5)) console.log(`        - ${alvo}${motivo ? `: ${motivo}` : ''}`);
        console.log('');
        // No GitHub Actions, cada problema vira também uma anotação, que aparece na página do PR
        if (process.env.GITHUB_ACTIONS) {
            const [alvo, motivo] = [...r.alvos][0] ?? ['', ''];
            const texto = `${r.help} | onde: ${[...new Set(r.ondes)].join('; ')} | ${alvo}: ${motivo}`.replace(/\r?\n/g, ' ');
            console.log(`::${REPROVA.has(r.impact) ? 'error' : 'warning'} title=Acessibilidade (${IMPACTO[r.impact] ?? r.impact}) ${r.id}::${texto}`);
        }
    }
    const reprovados = lista.filter((r) => REPROVA.has(r.impact));
    if (!lista.length) console.log('Nenhum problema encontrado.');
    console.log(reprovados.length ? `${reprovados.length} problema(s) grave(s) ou crítico(s).` : 'Nenhum problema grave ou crítico.');
    process.exit(reprovados.length ? 1 : 0);
})().catch((erro) => {
    console.error(erro);
    process.exit(2);
});
