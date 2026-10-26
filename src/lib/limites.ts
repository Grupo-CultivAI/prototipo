import ChatMessage from '@/models/ChatMessage';

// Limite de uso por pessoa. Conta também as tentativas que falharam, porque cada uma já
// gastou um embedding da cota diária do Gemini (ver /api/llm).
export const LIMITE_POR_MINUTO = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 4);
export const LIMITE_POR_DIA = Number(process.env.RATE_LIMIT_PER_DAY ?? 30);

export const perguntasDesde = (userId: unknown, ms: number) =>
    ChatMessage.countDocuments({ userId, sender: 'user', createdAt: { $gte: new Date(Date.now() - ms) } });

export const perguntasRestantesHoje = async (userId: unknown) =>
    Math.max(0, LIMITE_POR_DIA - await perguntasDesde(userId, 86_400_000));
