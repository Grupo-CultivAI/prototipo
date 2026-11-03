import { NextResponse } from 'next/server';
import { LIMIAR_RELEVANCIA, MODELO_EMBEDDING, NAMESPACE_DA_BASE, gerarEmbeddings } from '@/lib/embeddings.mjs';
import dbConnect from '@/lib/mongodb';
import ChatMessage from '@/models/ChatMessage';
import Conversa from '@/models/Conversa';
import { conversaDoUsuario, tituloDe } from '@/lib/conversas';
import { cultivoDaConversa, nomeDoCultivo } from '@/lib/cultivos';
import { ordenarSafras, rotuloDaSafra } from '@/lib/perfil';
import { getUserIdFromToken } from '@/lib/auth';
import { gerarResposta, type MensagemGroq } from '@/lib/modelos';
import { getForecastSummary, getWeatherSummary } from '@/lib/weather';
import { epocaDePlantio, perguntaDeQuandoPlantar } from '@/lib/zarc';
import { problemaDeAgrotoxico, semAgrotoxico } from '@/lib/agrotoxicos';
import { AVISO_AGRONOMICO, problemaAgronomico } from '@/lib/errosAgronomicos';
import { problemaDeAtribuicao } from '@/lib/atribuicao';
import { FIM_DA_REVISAO, INICIO_DA_REVISAO, semDesculpaNoInicio } from '@/lib/revisao';
import { estacaoERegiao, regrasDoClima } from '@/lib/estacao';
import { VERSAO_DO_PROMPT, montarPrompt, temLavouraPerene } from '@/lib/prompt';
import { comTitulos, tituloDoDocumento } from '@/lib/documentos';
import { LIMITE_POR_DIA, LIMITE_POR_MINUTO, perguntasDeHoje, perguntasDesde, segundosAteMeiaNoite } from '@/lib/limites';


// O limiar de relevância (LIMIAR_RELEVANCIA) vem de src/lib/embeddings.mjs, junto com o modelo:
// a escala dos scores muda de um modelo para outro.
const TRECHOS_NO_CONTEXTO = 3;
// Cada etapa da busca na base (embedding da pergunta e consulta ao índice). Normalmente leva
// menos de 1 s; passado o prazo, a resposta sai sem a base, com o aviso na tela.
const PRAZO_DA_BUSCA_MS = 8_000;
const MENSAGENS_DE_HISTORICO = 4;
const CARACTERES_POR_MENSAGEM_DO_HISTORICO = 500;
// A previsão só entra no prompt em perguntas sobre o trabalho no campo. Em 27/10/2026, com
// ela sempre presente, a IA comentou a chuva numa pergunta sobre nematoides.
const PERGUNTA_DE_CAMPO = /plant|semea|semeio|adub|aplic|pulveriz|colh|chuv|chov|irrig|previs|geada|semana|amanh/i;

// Dados do perfil que a IA pode pedir no meio da conversa. As opções são as do formulário
// do cultivo (Meus Cultivos), para o valor salvo pelo chat ser o mesmo que o formulário gravaria.
const ESTADOS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
type Campo = { chave: string; label: string; tipo: 'text' | 'select' | 'lista'; opcoes?: { valor: string; rotulo: string }[] };
// mencionado: a pergunta atual já traz o dado ("e se o solo for arenoso?"), então não se pede.
const DADOS_PEDIVEIS: Record<string, { descricao: string; falta: (p: any) => boolean; mencionado?: RegExp; campos: Campo[] }> = {
    solo: {
        descricao: 'o tipo de solo',
        falta: (p) => !p?.tipoSolo,
        mencionado: /arenos|argilos|siltos|\bmisto\b/i,
        campos: [{
            chave: 'tipoSolo', label: 'Tipo de solo', tipo: 'select',
            opcoes: [
                { valor: 'arenoso', rotulo: 'Arenoso (esquenta rápido, a água escorre)' },
                { valor: 'argiloso', rotulo: 'Argiloso (segura água e nutrientes)' },
                { valor: 'siltoso', rotulo: 'Siltoso (muito fino, erode fácil)' },
                { valor: 'misto', rotulo: 'Misto' },
                { valor: 'nao_sei', rotulo: 'Não sei' },
            ],
        }],
    },
    localizacao: {
        descricao: 'a cidade e o estado',
        falta: (p) => !p?.cidade || !p?.estado,
        campos: [
            { chave: 'estado', label: 'Estado', tipo: 'select', opcoes: ESTADOS.map((uf) => ({ valor: uf, rotulo: uf })) },
            { chave: 'cidade', label: 'Cidade', tipo: 'text' },
        ],
    },
    culturas: {
        descricao: 'as culturas plantadas nos últimos anos',
        falta: (p) => !p?.culturasHistorico?.length,
        campos: [{ chave: 'culturasHistorico', label: 'O que você plantou nos últimos anos? (separe por vírgula)', tipo: 'lista' }],
    },
};
const MARCA_DE_PEDIDO = /\[PEDIR:\s*([^\]]*)\]/gi;

// A IA sinaliza no texto quais dados quer, porque o gpt-oss-120b falha no modo JSON.
// Só vira formulário o que de fato falta no perfil; a marca nunca chega ao produtor.
function separarPedido(resposta: string, faltando: string[]) {
    const pedidos = [...resposta.matchAll(MARCA_DE_PEDIDO)]
        .flatMap((m) => m[1].split(',').map((c) => c.trim().toLowerCase()));
    const texto = resposta.replace(MARCA_DE_PEDIDO, '').trimEnd();
    const codigos = [...new Set(pedidos)].filter((c) => faltando.includes(c)).slice(0, 2);
    if (!codigos.length) return { texto, codigos, form: null };
    return {
        texto,
        codigos,
        form: {
            // Diz o que está sendo pedido: o modelo às vezes termina o texto com outra pergunta.
            mensagem: `Para ajustar a recomendação, me conte ${codigos.map((c) => DADOS_PEDIVEIS[c].descricao).join(' e ')}. O dado fica salvo no seu cultivo.`,
            campos_necessarios: codigos.flatMap((c) => DADOS_PEDIVEIS[c].campos),
        },
    };
}

// O que o produtor respondeu no formulário, só para exibir no histórico.
function resumoEnviado(dados: unknown): Record<string, string> | undefined {
    if (!dados || typeof dados !== 'object') return undefined;
    const pares = Object.entries(dados)
        .filter(([k, v]) => typeof v === 'string' && k.length <= 80)
        .slice(0, 5)
        .map(([k, v]) => [k, String(v).slice(0, 120)]);
    return pares.length ? Object.fromEntries(pares) : undefined;
}

type Trecho = { texto: string; fonte: string; pagina?: number };

// Junta palavras hifenizadas na quebra de linha e normaliza espaços
const limparTrecho = (t: string) => t.replace(/-\n/g, '').replace(/\s+/g, ' ').trim();

function resumoDoPerfil(p: any): string | null {
    if (!p) return null;
    const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && x !== 'Nenhum').join(', ') : '');
    const linhas: string[] = [`Cultivo: ${nomeDoCultivo(p)}`];
    if (p.cidade || p.estado) linhas.push(`Localização: ${[p.cidade, p.estado].filter(Boolean).join(' - ')}`);
    if (p.tamanho) linhas.push(`Área: ${p.tamanho} hectares`);
    const solo = [
        p.tipoSolo && (p.tipoSolo === 'nao_sei' ? 'tipo não sabe informar' : `tipo ${p.tipoSolo}`),
        p.phSolo != null && `pH ${p.phSolo}`,
        p.materiaOrganica && `matéria orgânica ${String(p.materiaOrganica).toLowerCase()}`,
        p.drenagem && `drenagem ${String(p.drenagem).toLowerCase()}`,
        p.analiseSolo && 'com análise de solo recente',
    ].filter(Boolean).join(', ');
    if (solo) linhas.push(`Solo: ${solo}`);
    if (lista(p.culturasHistorico)) linhas.push(`Culturas dos últimos anos: ${lista(p.culturasHistorico)}`);
    const safras = ordenarSafras(p.safras).map((s: any) => `${rotuloDaSafra(s)}: ${String(s.cultura).toLowerCase()}`);
    if (safras.length) linhas.push(`Safras registradas (da mais antiga à mais recente): ${safras.join('; ')}`);
    if (p.tempoCulturaAtual != null) linhas.push(`Tempo com as culturas atuais: ${p.tempoCulturaAtual} anos`);
    if (p.usoFertilizantes) linhas.push(`Uso de fertilizantes: ${String(p.usoFertilizantes).toLowerCase()}`);
    if (p.sistemaPlantio) linhas.push(`Sistema de plantio: ${p.sistemaPlantio === 'Não sei' ? 'não sabe informar' : String(p.sistemaPlantio).toLowerCase()}`);
    if (p.irrigacao) linhas.push(`Irrigação: ${String(p.irrigacao).toLowerCase()}`);
    if (p.proximaCultura) linhas.push(`Pretende plantar na próxima safra: ${String(p.proximaCultura).toLowerCase()}`);
    if (lista(p.problemasRecentes)) linhas.push(`Problemas recentes: ${lista(p.problemasRecentes)}`);
    if (lista(p.objetivos)) linhas.push(`Objetivos: ${lista(p.objetivos)}`);
    if (p.plano?.etapas?.length) {
        const etapas = p.plano.etapas.map((e: any, i: number) => `${i + 1}) ${e.quando ? `${e.quando}: ` : ''}${String(e.cultura).toLowerCase()}${e.feita ? ' (já feita)' : ''}`);
        linhas.push(`Plano de rotação que o produtor salvou: ${etapas.join('; ')}`);
    }
    if (p.observacoes?.trim()) linhas.push(`Observações do produtor: ${String(p.observacoes).replace(/\s+/g, ' ').slice(0, 300)}`);
    return linhas.length ? linhas.join('\n') : null;
}

// "me dê outras sugestões" ou "e para soja?" sozinhas viram um vetor de busca vago, e a
// busca traz trechos de outro assunto. Juntar com a pergunta anterior mantém o tema.
const PARECE_CONTINUACAO = /^(e|mas|mais|outr[ao]s?|isso|esse|essa|nesse|nessa|tamb[eé]m|por que|porque|como assim)(\s|[,?!.]|$)/i;

function textoParaBusca(pergunta: string, perguntaAnterior: string | null): string {
    const curta = pergunta.trim().split(/\s+/).length <= 4;
    if (perguntaAnterior && (curta || PARECE_CONTINUACAO.test(pergunta.trim()))) return `${perguntaAnterior}\n${pergunta}`;
    return pergunta;
}

// maiorScore fica gravado com a resposta: perguntas com score baixo apontam assuntos que
// faltam na base (npm run relatorio-chat). null = a busca não aconteceu.
async function buscarTrechos(texto: string, cfg: { pinecone: string; host: string }): Promise<{ trechos: Trecho[]; maiorScore: number | null; falha?: FalhaDaBusca }> {
    try {
        const [vector] = await gerarEmbeddings([texto], { tipo: 'query', apiKey: cfg.pinecone, prazoMs: PRAZO_DA_BUSCA_MS });

        const res = await fetch(`https://${cfg.host}/query`, {
            method: 'POST',
            headers: { 'Api-Key': cfg.pinecone, 'Content-Type': 'application/json', 'X-Pinecone-Api-Version': '2025-04' },
            signal: AbortSignal.timeout(PRAZO_DA_BUSCA_MS),
            body: JSON.stringify({ vector, topK: 5, namespace: NAMESPACE_DA_BASE, includeMetadata: true }),
        });
        if (!res.ok) throw new Error(`Pinecone ${res.status}: ${await res.text()}`);
        const matches: { score: number; metadata?: Record<string, unknown> }[] = (await res.json()).matches || [];
        console.log(`🔍 Pinecone: ${matches.map((m) => m.score.toFixed(3)).join(', ')} (limiar ${LIMIAR_RELEVANCIA})`);

        const trechos = matches
            .filter((m) => m.score >= LIMIAR_RELEVANCIA && typeof m.metadata?.texto === 'string')
            .slice(0, TRECHOS_NO_CONTEXTO)
            .map((m) => ({
                texto: limparTrecho(String(m.metadata!.texto)),
                fonte: String(m.metadata!.fonte ?? 'Embrapa'),
                pagina: typeof m.metadata!.pagina === 'number' ? m.metadata!.pagina : undefined,
            }));
        return { trechos, maiorScore: matches.length ? Math.max(...matches.map((m) => m.score)) : null };
    } catch (err) {
        // Sem a base, o chat ainda responde com prática geral: o prompt proíbe usar "📘" sem trechos.
        // O motivo vai para a tela, para o produtor saber que a resposta não consultou a Embrapa.
        const mensagem = err instanceof Error ? err.message : String(err);
        console.warn('⚠️ Busca na base indisponível:', mensagem);
        return { trechos: [], maiorScore: null, falha: motivoDaFalha(mensagem) };
    }
}

// 429 do Pinecone Inference: a cota mensal gratuita (5 milhões de tokens por modelo) acabou, ou
// muitas buscas no mesmo minuto. Qualquer outro erro: busca fora do ar.
type FalhaDaBusca = 'cota' | 'limite' | 'erro';
function motivoDaFalha(mensagem: string): FalhaDaBusca {
    if (!/\b429\b/.test(mensagem)) return 'erro';
    return /month|monthly|quota|mensal|RESOURCE_EXHAUSTED/i.test(mensagem) ? 'cota' : 'limite';
}

const hoje = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

const marcarComoFalha = (id: unknown) =>
    ChatMessage.updateOne({ _id: id }, { $set: { 'metadata.falhou': true } }).catch(() => {});

export async function POST(req: Request) {
    const inicio = Date.now();
    let perguntaId: unknown = null;
    try {
        const userId = await getUserIdFromToken();
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
        }

        const body = await req.json();
        const userPrompt = body.question || body.message || body.prompt || body.text ||
            (body.messages && body.messages[body.messages.length - 1]?.content);

        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.length > 1000) {
            return NextResponse.json({ success: false, message: 'Mensagem inválida (1 a 1000 caracteres).' }, { status: 400 });
        }

        await dbConnect();

        // A GEMINI_API_KEY deixou de ser obrigatória: só serve ao modelo Gemini da fila MODELOS_IA.
        const pineconeKey = process.env.PINECONE_API_KEY;
        const pineconeHost = (process.env.PINECONE_INDEX_HOST || '').replace(/^https?:\/\//, '');
        const groqKey = process.env.GROQ_API_KEY;

        if (!pineconeKey || !pineconeHost || !groqKey) {
            return NextResponse.json({ success: false, message: 'Configuração de servidor incompleta.' }, { status: 500 });
        }

        // O perfil vem do banco, não do corpo da requisição: o navegador não decide o que entra no prompt.
        // É o do cultivo da conversa (Meus Cultivos). O contexto (mensagens anteriores, pergunta
        // anterior) vem só desta conversa: com o chat único, uma dúvida de dias atrás sobre outro
        // assunto entrava no contexto da nova.
        const conversa = await conversaDoUsuario(userId, body.conversaId);
        const [{ cultivo: propriedade, outros: cultivosSemEscolha }, recentes] = await Promise.all([
            cultivoDaConversa(userId, conversa),
            ChatMessage.find({ userId, conversaId: conversa._id, 'metadata.falhou': { $ne: true }, 'metadata.apagada': { $ne: true } })
                .sort({ createdAt: -1 }).limit(MENSAGENS_DE_HISTORICO).select('text sender metadata.pediu').lean(),
        ]);

        // Gravada antes das chamadas para contar no limite de uso mesmo se algo falhar: cada
        // tentativa já gasta um embedding e uma resposta da cota gratuita. Se falhar, é marcada e
        // deixa de aparecer no histórico e no contexto das próximas perguntas.
        const enviado = resumoEnviado(body.submittedData);
        perguntaId = (await ChatMessage.create({ userId, conversaId: conversa._id, text: userPrompt, sender: 'user', ...(enviado ? { metadata: { submittedData: enviado } } : {}) }))._id;

        // O limite é contado depois de gravar, já com esta pergunta. Antes contava-se primeiro e
        // gravava-se depois: vários pedidos ao mesmo tempo liam a mesma contagem e passavam todos,
        // e um script esgotava a cota da IA de todo o app (revisão de engenharia, 03/11/2026).
        // Agora cada pedido enxerga os que gravaram antes dele, e o que passa do limite se apaga.
        const [ultimoMinuto, feitasHoje] = await Promise.all([
            perguntasDesde(userId, 60_000),
            perguntasDeHoje(userId),
        ]);
        if (ultimoMinuto > LIMITE_POR_MINUTO || feitasHoje > LIMITE_POR_DIA) {
            await ChatMessage.deleteOne({ _id: perguntaId });
            perguntaId = null;
            const diario = feitasHoje > LIMITE_POR_DIA;
            return NextResponse.json(
                {
                    success: false,
                    message: diario
                        ? `Você atingiu o limite de ${LIMITE_POR_DIA} perguntas de hoje. Ele renova à meia-noite (horário de Brasília).`
                        : 'Você fez várias perguntas seguidas. Aguarde cerca de 1 minuto e tente novamente.',
                },
                { status: 429, headers: { 'Retry-After': String(diario ? segundosAteMeiaNoite() : 60) } },
            );
        }

        await Conversa.updateOne({ _id: conversa._id }, {
            $inc: { perguntas: 1 },
            $set: { ultimaMensagemEm: new Date(), ...(!conversa.titulo && tituloDe(userPrompt) ? { titulo: tituloDe(userPrompt) } : {}) },
        });
        // Um formulário que ficou sem resposta não deve reaparecer ao recarregar a conversa.
        await ChatMessage.updateMany({ userId, 'metadata.form': { $exists: true } }, { $unset: { 'metadata.form': 1 } });
        const historico = [...recentes].reverse();
        const perguntaAnterior = recentes.find((m) => m.sender === 'user')?.text ?? null;
        const cidade = (propriedade as any)?.cidade as string | undefined;

        // No máximo um pedido a cada MENSAGENS_DE_HISTORICO mensagens, para não insistir com quem pulou.
        // Com vários cultivos e nenhum escolhido, não há onde gravar o dado: a IA pergunta de qual cultivo se trata.
        const pediuHaPouco = recentes.some((m: any) => m.metadata?.pediu?.length) || cultivosSemEscolha.length > 1;
        const faltando = pediuHaPouco ? [] : Object.keys(DADOS_PEDIVEIS)
            .filter((c) => DADOS_PEDIVEIS[c].falta(propriedade) && !DADOS_PEDIVEIS[c].mencionado?.test(userPrompt));

        // Resposta ao formulário ("Informei: ...") vira um vetor de busca pobre; a pergunta
        // que motivou o pedido representa melhor o assunto.
        const busca = body.respostaAoPedido === true && perguntaAnterior ? perguntaAnterior : textoParaBusca(userPrompt, perguntaAnterior);

        const [{ trechos, maiorScore, falha: falhaDaBusca }, clima, previsao, epoca] = await Promise.all([
            buscarTrechos(busca, { pinecone: pineconeKey, host: pineconeHost }),
            getWeatherSummary(cidade, (propriedade as any)?.coordenadas),
            PERGUNTA_DE_CAMPO.test(`${userPrompt} ${busca}`) ? getForecastSummary(cidade, (propriedade as any)?.coordenadas) : null,
            epocaDePlantio(propriedade, userPrompt, busca === userPrompt ? '' : busca),
        ]);
        const zarc = epoca?.paraIA ?? null;

        const contexto = trechos
            .map((t) => `[${tituloDoDocumento(t.fonte)}${t.pagina ? `, p. ${t.pagina} do PDF` : ''}] ${t.texto}`)
            .join('\n\n');
        const perfil = resumoDoPerfil(propriedade) ?? (cultivosSemEscolha.length > 1
            ? `O produtor tem ${cultivosSemEscolha.length} cultivos cadastrados (${cultivosSemEscolha.map((c) => `${nomeDoCultivo(c)}${c.cidade ? `, em ${c.cidade}` : ''}`).join('; ')}), mas esta conversa não está ligada a nenhum. Se a resposta depender da área, pergunte de qual cultivo ele fala e diga que ele pode escolher o cultivo no topo do chat.`
            : null);
        // O quadro do ZARC abaixo da resposta (quadroZarc) e a regra do aplicativo no prompt
        const temQuadroZarc = Boolean(epoca?.linhas.length || epoca?.aviso || perguntaDeQuandoPlantar(userPrompt));
        const systemPrompt = montarPrompt({
            hoje: hoje(),
            estacaoERegiao: estacaoERegiao((propriedade as any)?.estado),
            regrasDeClima: regrasDoClima((propriedade as any)?.estado),
            perfil,
            cidade,
            clima,
            previsao,
            zarc,
            contexto,
            faltando: faltando.map((c) => ({ codigo: c, descricao: DADOS_PEDIVEIS[c].descricao })),
            temQuadroZarc,
            lavouraPerene: temLavouraPerene(`${userPrompt} ${busca} ${perfil ?? ''}`),
        });

        const messages: MensagemGroq[] = [
            { role: 'system', content: systemPrompt },
            ...historico.map((m) => ({
                role: (m.sender === 'user' ? 'user' : 'assistant') as MensagemGroq['role'],
                content: String(m.text).slice(0, CARACTERES_POR_MENSAGEM_DO_HISTORICO),
            })),
            { role: 'user', content: userPrompt },
        ];

        const primeira = await gerarResposta(messages);
        if (!primeira.texto) {
            await marcarComoFalha(perguntaId);
            const limite = /rate_limit|429|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|timeout|aborted/i.test(primeira.erro);
            return NextResponse.json({
                success: false,
                message: limite
                    ? 'O CultivAI está recebendo muitas perguntas agora. Aguarde um minuto e tente de novo.'
                    : 'O CultivAI não conseguiu responder agora. Tente de novo em instantes.',
            }, { status: 502 });
        }
        let answer = primeira.texto;
        const geracao = {
            versaoPrompt: VERSAO_DO_PROMPT,
            modelo: primeira.modelo,
            tokensEntrada: primeira.tokensEntrada ?? 0,
            tokensSaida: primeira.tokensSaida ?? 0,
            revisada: false,
            comAviso: false,
            agrotoxicoRemovido: false,
            agronomiaComAviso: false,
        };

        const dadosDaPergunta = { pergunta: `${userPrompt} ${busca}`, estado: (propriedade as any)?.estado, irrigacao: (propriedade as any)?.irrigacao };
        const problema = [problemaDeAtribuicao(answer, contexto, zarc, previsao), problemaDeAgrotoxico(answer), problemaAgronomico(answer, dadosDaPergunta)].filter(Boolean).join(' ');
        if (problema) {
            console.warn('⚠️ Atribuição sem respaldo, agrotóxico com dose ou erro agronômico; pedindo revisão.', problema);
            const revisada = await gerarResposta([...messages, { role: 'assistant', content: answer }, { role: 'user', content: `${INICIO_DA_REVISAO}${problema}${FIM_DA_REVISAO}` }]);
            geracao.revisada = true;
            if (revisada.texto) {
                answer = semDesculpaNoInicio(revisada.texto);
                geracao.modelo = revisada.modelo;
                geracao.tokensEntrada += revisada.tokensEntrada ?? 0;
                geracao.tokensSaida += revisada.tokensSaida ?? 0;
            }
            if (problemaDeAtribuicao(answer, contexto, zarc, previsao)) {
                console.warn('⚠️ Revisão manteve a atribuição sem respaldo; resposta segue com aviso.');
                answer += '\n\n> ⚠️ Parte desta resposta não pôde ser conferida nos documentos da Embrapa ou no ZARC. Confirme com a assistência técnica antes de aplicar.';
                geracao.comAviso = true;
            }
            // Produto e dose de agrotóxico não podem sair, nem com aviso: as frases são cortadas.
            if (problemaDeAgrotoxico(answer)) {
                console.warn('⚠️ Revisão manteve agrotóxico com dose; frases removidas.');
                answer = semAgrotoxico(answer);
                geracao.agrotoxicoRemovido = true;
            }
            if (problemaAgronomico(answer, dadosDaPergunta)) {
                console.warn('⚠️ Revisão manteve um erro agronômico conhecido; resposta segue com aviso.');
                answer += `\n\n${AVISO_AGRONOMICO}`;
                geracao.agronomiaComAviso = true;
            }
        }

        const porArquivo = new Map<string, number[]>();
        for (const t of trechos) {
            const paginas = porArquivo.get(t.fonte) ?? [];
            if (t.pagina && !paginas.includes(t.pagina)) paginas.push(t.pagina);
            porArquivo.set(t.fonte, paginas);
        }
        const fontes = comTitulos([...porArquivo].map(([fonte, paginas]) => ({ fonte, paginas: paginas.sort((a, b) => a - b) })));

        const pedido = separarPedido(answer, faltando);
        if (faltando.length) console.log(`📝 Dados que faltam: ${faltando.join(', ')} — pedidos nesta resposta: ${pedido.codigos.join(', ') || 'nenhum'}`);
        answer = pedido.texto;
        // Quadro do ZARC abaixo da resposta: a janela oficial (quando há) e a indicação do
        // aplicativo. Vem dos dados, não do modelo, então aparece sempre que a pergunta pede.
        const quadroZarc = temQuadroZarc
            ?{ local: epoca?.local, linhas: epoca?.linhas ?? [], aviso: epoca?.aviso }
            : undefined;
        // O prompt pede para não falar do aplicativo; se o modelo falar, o parágrafo sai,
        // para não repetir o quadro.
        if (quadroZarc) {
            answer = answer.split(/\n\s*\n/).filter((p) => !(/plantio certo/i.test(p) && p.length < 400)).join('\n\n');
        }

        const resposta = await ChatMessage.create({
            userId, conversaId: conversa._id, text: answer, sender: 'bot',
            metadata: {
                fontes,
                perguntaId,
                busca: { texto: busca, maiorScore, trechosUsados: trechos.length, modelo: MODELO_EMBEDDING, ...(falhaDaBusca ? { falha: falhaDaBusca } : {}) },
                geracao: { ...geracao, duracaoMs: Date.now() - inicio },
                contexto: { perfil: perfil ?? undefined, clima: clima || undefined, previsao: previsao || undefined, zarc: zarc || undefined },
                ...(pedido.form ? { form: pedido.form, pediu: pedido.codigos } : {}),
                ...(quadroZarc ? { epoca: quadroZarc } : {}),
            },
        });

        return NextResponse.json({
            success: true,
            parsedData: pedido.form ? { tipo: 'coleta_dados', resposta: answer, ...pedido.form } : { tipo: 'resposta', resposta: answer },
            fontes,
            epoca: quadroZarc,
            semBase: falhaDaBusca,
            mensagemId: resposta._id,
            conversaId: conversa._id,
            // feitasHoje já inclui esta pergunta
            restantesHoje: Math.max(0, LIMITE_POR_DIA - feitasHoje),
        });

    } catch (err) {
        if (perguntaId) await marcarComoFalha(perguntaId);
        // O detalhe fica só no log: antes ele ia para a tela, com texto técnico (do banco, de um
        // serviço externo) que não ajuda o produtor e expõe o funcionamento interno.
        console.error('❌ Erro crítico capturado na rota /api/llm:', err);
        return NextResponse.json({ success: false, message: 'O CultivAI não conseguiu responder agora. Tente de novo em instantes.' }, { status: 500 });
    }
}
