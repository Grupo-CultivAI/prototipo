import mongoose from 'mongoose';

const KnowledgeSchema = new mongoose.Schema({
    content: { 
        type: String, 
        required: true 
    },
    metadata: {
        source: { type: String, default: 'manual' },
        category: { type: String, default: 'geral' }
    },
    embedding: { 
        type: [Number], 
        required: true 
    }
}, { timestamps: true });

export default mongoose.models.Knowledge || mongoose.model('Knowledge', KnowledgeSchema);
