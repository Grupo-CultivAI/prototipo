import mongoose from 'mongoose';

const PropriedadeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // base (will maintain for compatibility or can be replaced)
    tamanho: { type: String, default: "" },
    // location
    estado: { type: String, default: "" },
    cidade: { type: String, default: "" },
    cep: { type: String, default: "" },
    coordenadas: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    // soil
    tipoSolo: { type: String, default: "" },
    phSolo: { type: Number, default: null },
    materiaOrganica: { type: String, enum: ["Baixa", "Média", "Alta", ""], default: "" },
    drenagem: { type: String, enum: ["Boa", "Média", "Ruim", ""], default: "" },
    analiseSolo: { type: Boolean, default: false },
    // history
    culturas: { type: String, default: "" }, // keeping for compatibility, maybe use as multi-input text or create culturasHistorico
    culturasHistorico: { type: [String], default: [] },
    tempoCulturaAtual: { type: Number, default: null },
    usoFertilizantes: { type: String, enum: ["Baixo", "Médio", "Alto", ""], default: "" },
    problemasRecentes: { type: [String], default: [] },
    // objectives
    objetivo: { type: String, default: "" }, // keeping for compatibility
    objetivos: { type: [String], default: [] },
    observacoes: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.models.Propriedade || mongoose.model('Propriedade', PropriedadeSchema);
