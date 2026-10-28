import ChatMessage from '@/models/ChatMessage';

// Limite de uso por pessoa. Conta também as tentativas que falharam, porque cada uma já
// gastou cota das APIs (embedding da pergunta e modelo de resposta; ver /api/llm).
export const LIMITE_POR_MINUTO = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 4);
export const LIMITE_POR_DIA = Number(process.env.RATE_LIMIT_PER_DAY ?? 30);

export const perguntasDesde = (userId: unknown, ms: number) =>
    ChatMessage.countDocuments({ userId, sender: 'user', createdAt: { $gte: new Date(Date.now() - ms) } });

// O limite diário renova à meia-noite de Brasília. Até 28/10/2026 contava as últimas 24 horas,
// por causa da cota diária de embeddings do Gemini; com o Pinecone (cota mensal folgada) a
// janela móvel deixou de ser necessária, e a meia-noite é mais fácil de entender. O limite por
// minuto continua segurando rajadas.
// O Brasil não tem horário de verão desde 2019, então Brasília é sempre UTC-3.
const FUSO_BRASILIA = '-03:00';

export function meiaNoiteDeHoje(agora = new Date()): Date {
    const [dia, mes, ano] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(agora).split('/');
    return new Date(`${ano}-${mes}-${dia}T00:00:00${FUSO_BRASILIA}`);
}

/** Segundos até a próxima meia-noite de Brasília (para o cabeçalho Retry-After). */
export const segundosAteMeiaNoite = (agora = new Date()) =>
    Math.max(60, Math.ceil((meiaNoiteDeHoje(agora).getTime() + 86_400_000 - agora.getTime()) / 1000));

export const perguntasDeHoje = (userId: unknown) =>
    ChatMessage.countDocuments({ userId, sender: 'user', createdAt: { $gte: meiaNoiteDeHoje() } });

export const perguntasRestantesHoje = async (userId: unknown) =>
    Math.max(0, LIMITE_POR_DIA - await perguntasDeHoje(userId));
