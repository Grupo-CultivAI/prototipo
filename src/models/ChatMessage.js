import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Mensagens gravadas antes das conversas existirem são migradas na primeira leitura
    // (ver lib/conversas.ts), por isso o campo não é obrigatório.
    conversaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversa'
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
        busca: {
            texto: String, // o que foi buscado: a pergunta, ou ela junto com a anterior
            maiorScore: Number,
            trechosUsados: Number
        },
        // Como a resposta foi gerada, para entender erros e custo
        geracao: {
            modelo: String,
            tokensEntrada: Number,
            tokensSaida: Number,
            duracaoMs: Number,
            revisada: Boolean, // a checagem de números pediu que o modelo reescrevesse
            comAviso: Boolean // a revisão também falhou e a resposta saiu com aviso
        },
        // O que a IA sabia da propriedade quando respondeu (o perfil pode mudar depois)
        contexto: {
            perfil: String,
            clima: String,
            previsao: String, // próximos dias, uma linha por dia
            zarc: String // janelas de plantio oficiais enviadas à IA
        },
        // Quadro do ZARC mostrado abaixo da resposta (src/lib/zarc.ts)
        epoca: {
            local: String,
            linhas: { type: [String], default: undefined },
            aviso: String
        },
        // 👍/👎 do produtor (POST /api/chat/avaliacao)
        avaliacao: { type: String, enum: ['boa', 'ruim'] }
    }
}, { timestamps: true });

ChatMessageSchema.index({ userId: 1, createdAt: -1 });
ChatMessageSchema.index({ conversaId: 1, createdAt: -1 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
