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
        // Dados que a IA pediu nesta resposta (ver DADOS_PEDIVEIS em api/llm/route.ts)
        pediu: { type: [String], default: undefined }
    }
}, { timestamps: true });

ChatMessageSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
