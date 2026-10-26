import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    sender: {
        type: String,
        enum: ['user', 'bot'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        form: mongoose.Schema.Types.Mixed,
        submittedData: mongoose.Schema.Types.Mixed,
        fontes: mongoose.Schema.Types.Mixed,
        falhou: Boolean,
        // Pergunta apagada ao reiniciar o chat: sem texto, guardada só para o limite diário
        apagada: Boolean,
        // Dados que a IA pediu nesta resposta (ver DADOS_PEDIVEIS em api/llm/route.ts)
        pediu: { type: [String], default: undefined },
        // Pergunta que esta resposta atende, e o resultado da busca na base (relatorio-chat)
        perguntaId: mongoose.Schema.Types.ObjectId,
        busca: { maiorScore: Number, trechosUsados: Number },
        // 👍/👎 do produtor (POST /api/chat/avaliacao)
        avaliacao: { type: String, enum: ['boa', 'ruim'] }
    }
}, { timestamps: true });

ChatMessageSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
