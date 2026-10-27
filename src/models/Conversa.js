import mongoose from 'mongoose';

// Cada conversa do chat. As mensagens apontam para ela (ChatMessage.conversaId).
// O chat abre na mais recente ("Nova conversa" cria outra); as anteriores ficam no botão
// "Conversas" (GET /api/conversas).
const ConversaSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Tirado da primeira pergunta, sem chamar a IA
    titulo: { type: String, default: '' },
    perguntas: { type: Number, default: 0 },
    ultimaMensagemEm: { type: Date, default: null }
}, { timestamps: true });

// A conversa atual é a mais recente de cada pessoa.
ConversaSchema.index({ userId: 1, createdAt: -1 });
// A lista de conversas vem pela última mensagem.
ConversaSchema.index({ userId: 1, ultimaMensagemEm: -1 });

export default mongoose.models.Conversa || mongoose.model('Conversa', ConversaSchema);
