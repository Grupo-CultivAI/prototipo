import mongoose from 'mongoose';
import ChatMessage from '@/models/ChatMessage';
import Conversa from '@/models/Conversa';

// Respostas ao formulário do chat não servem de título.
const NAO_E_TITULO = /^Informei: |^Prefiro não informar agora/;

export function tituloDe(pergunta: unknown): string {
    const texto = String(pergunta ?? '').replace(/\s+/g, ' ').trim();
    if (!texto || NAO_E_TITULO.test(texto)) return '';
    return texto.length > 60 ? `${texto.slice(0, 57)}…` : texto;
}

// O histórico gravado antes das conversas existirem vira uma conversa só, na primeira vez que
// a pessoa abre o chat depois da mudança. Ela continua vendo o mesmo chat de antes.
async function migrarMensagensSoltas(userId: unknown) {
    const solta = await ChatMessage.exists({ userId, conversaId: { $exists: false } });
    if (!solta) return;
    const primeira = await ChatMessage.findOne({
        userId, conversaId: { $exists: false }, sender: 'user', 'metadata.apagada': { $ne: true },
    }).sort({ createdAt: 1 }).select('text').lean<{ text: string }>();
    const conversa = await Conversa.create({ userId, titulo: tituloDe(primeira?.text) || 'Conversa anterior' });
    await ChatMessage.updateMany({ userId, conversaId: { $exists: false } }, { $set: { conversaId: conversa._id } });
}

// A conversa que o chat mostra: a mais recente da pessoa.
export async function conversaAtual(userId: unknown, { criar = true } = {}) {
    await migrarMensagensSoltas(userId);
    const atual = await Conversa.findOne({ userId }).sort({ createdAt: -1 });
    if (atual || !criar) return atual;
    return Conversa.create({ userId });
}

// A conversa indicada pelo navegador, se for mesmo dessa pessoa; senão, a atual.
export async function conversaDoUsuario(userId: unknown, conversaId: unknown) {
    if (mongoose.isValidObjectId(conversaId)) {
        const conversa = await Conversa.findOne({ _id: conversaId, userId });
        if (conversa) return conversa;
    }
    return conversaAtual(userId);
}
