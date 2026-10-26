import mongoose from 'mongoose';

// Cada conversa do chat. As mensagens apontam para ela (ChatMessage.conversaId).
// Hoje a tela mostra só a mais recente ("Nova conversa" cria outra); a lista de conversas
// anteriores pode ser montada depois sobre este mesmo modelo.
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

export default mongoose.models.Conversa || mongoose.model('Conversa', ConversaSchema);
