// Fila de modelos de linguagem, usada pelo chat (/api/llm) e pela extração do plano de rotação
// (/api/cultivos/[id]/plano). Saiu de api/llm/route.ts em 30/10/2026.

export type MensagemGroq = { role: 'system' | 'user' | 'assistant'; content: string };

// Fila de modelos, tentados em ordem: se um falha (limite, fora do ar, demora, resposta
// cortada), o próximo responde. No plano gratuito cada modelo tem a própria cota, somando
// todos os usuários, então mais modelos = mais perguntas por minuto, sem custo.
// Formato "provedor:modelo". Em 27/10/2026 a Groq não tinha outros modelos de conversa
// úteis; o Gemini 3.5 Flash-Lite (mesma chave dos embeddings, cota separada) foi o único
// estável nos testes: gemini-3.5-flash e gemini-3.8-flash davam "high demand" ou demoravam
// mais de 25 s, e o gemma-4 escrevia o próprio raciocínio na resposta.
// Em 28/10/2026 o Google bloqueou o plano gratuito do projeto, e o Gemini saiu da fila padrão.
// Em 29/10/2026 entrou a NVIDIA (build.nvidia.com), no fim: o mesmo gpt-oss-20b, com cerca de
// 10.000 requisições por dia, contra ~230 perguntas por dia somando a Groq (200 mil tokens por
// dia por modelo). Fica por último porque o acesso gratuito é de avaliação e pode ficar lento
// com o tráfego de outros usuários; só responde quando a Groq esgota.
// Também em 29/10/2026 o gpt-oss-120b passou para a frente: nas mesmas perguntas, respondeu tão
// rápido quanto o 20b (1 a 3 s) e melhor (usa o ZARC com o marcador e cruza com a previsão; o 20b
// precisou de revisão numa delas). Cotas separadas, então a capacidade não muda. Testados na
// NVIDIA e descartados: nemotron-3-ultra-550b (bom, mas 6 de 15 respostas passaram de 20 s),
// mistral-large-4 (lento e passa do teto de tokens), minimax-m3.1-flash (lento e 429), e
// deepseek-v4.1-flash, gemma-4-31b, glm-5.3-flash e step-5 (não responderam em 45 s).
const MODELOS_IA = (process.env.MODELOS_IA || 'groq:openai/gpt-oss-120b,groq:openai/gpt-oss-20b,groq:qwen/qwen3.8-27b,nvidia:openai/gpt-oss-20b')
    .split(',').map((s) => s.trim()).filter(Boolean);

// Todos aceitam o formato de chat da OpenAI. Provedor sem chave é pulado.
const PROVEDORES: Record<string, { url: string; chave: () => string | undefined }> = {
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', chave: () => process.env.GROQ_API_KEY },
    nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', chave: () => process.env.NVIDIA_API_KEY },
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', chave: () => process.env.GEMINI_API_KEY },
};

// Um modelo que trava não pode prender a pergunta: em 27/10/2026 o gemini-flash-latest ficou
// mais de 5 minutos sem responder. Passado o prazo, o próximo modelo tenta.
const PRAZO_POR_MODELO_MS = 20_000;

// Uma resposta longa (plano de ~400 palavras) usa uns 700 tokens. Em 26/10/2026 o gpt-oss-20b
// entrou em laço repetindo "Milho / Soja / ..." até 2.048 tokens: resposta inútil e metade do
// limite por minuto da Groq. Cortada no teto, a resposta é descartada e o próximo modelo tenta.
const TETO_DE_TOKENS_DA_RESPOSTA = 1000;

export type Geracao = { texto: string; erro: string; modelo?: string; tokensEntrada?: number; tokensSaida?: number };

// tetoDeTokens: o padrão é o da resposta do chat; a extração do plano usa menos.
export async function gerarResposta(messages: MensagemGroq[], { tetoDeTokens = TETO_DE_TOKENS_DA_RESPOSTA, temperatura = 0.3 } = {}): Promise<Geracao> {
    let erro = '';
    for (const entrada of MODELOS_IA) {
        const [nomeProvedor, model] = entrada.includes(':') ? [entrada.slice(0, entrada.indexOf(':')), entrada.slice(entrada.indexOf(':') + 1)] : ['groq', entrada];
        const provedor = PROVEDORES[nomeProvedor];
        const chave = provedor?.chave();
        if (!provedor || !chave) {
            console.warn(`⚠️ ${entrada}: provedor desconhecido ou sem chave; pulando.`);
            continue;
        }
        let res: Response;
        try {
            res = await fetch(provedor.url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(PRAZO_POR_MODELO_MS),
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: temperatura,
                    max_completion_tokens: tetoDeTokens,
                    // Os gpt-oss raciocinam antes de responder, e esse raciocínio conta no limite por minuto.
                    ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
                }),
            });
        } catch (e) {
            erro = `${entrada}: ${e instanceof Error ? e.message : e}`;
            console.warn(`⚠️ ${entrada} não respondeu (${erro}); tentando o próximo modelo.`);
            continue;
        }
        if (res.ok) {
            const dados = await res.json();
            const texto = dados.choices?.[0]?.message?.content || '';
            const u = dados.usage ?? {};
            if (dados.choices?.[0]?.finish_reason === 'length') {
                erro = `${entrada} atingiu o teto de ${tetoDeTokens} tokens`;
                console.warn(`⚠️ ${erro} (provável repetição em laço); tentando o próximo modelo.`);
            } else if (texto) {
                console.log(`🎉 Sucesso com ${entrada} — tokens: ${u.prompt_tokens} de entrada + ${u.completion_tokens} de saída.`);
                return { texto, erro: '', modelo: entrada, tokensEntrada: u.prompt_tokens, tokensSaida: u.completion_tokens };
            }
        } else {
            erro = await res.text();
            console.warn(`⚠️ ${entrada} falhou (${res.status}):`, erro.slice(0, 300));
        }
    }
    return { texto: '', erro };
}
