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
    tipoSolo: { type: String, default: "" }, // arenoso, argiloso, siltoso, misto ou nao_sei
    phSolo: { type: Number, default: null },
    materiaOrganica: { type: String, enum: ["Baixa", "Média", "Alta", ""], default: "" },
    drenagem: { type: String, enum: ["Boa", "Média", "Ruim", ""], default: "" },
    analiseSolo: { type: Boolean, default: false },
    // history
    culturasHistorico: { type: [String], default: [] },
    tempoCulturaAtual: { type: Number, default: null },
    usoFertilizantes: { type: String, enum: ["Baixo", "Médio", "Alto", ""], default: "" },
    sistemaPlantio: { type: String, enum: ["Plantio direto", "Convencional", "Cultivo mínimo", "Não sei", ""], default: "" },
    irrigacao: { type: String, enum: ["Não irrigo", "Aspersão", "Gotejamento", "Sulco ou inundação", "Outro", ""], default: "" },
    problemasRecentes: { type: [String], default: [] },
    // objectives
    objetivos: { type: [String], default: [] },
    proximaCultura: { type: String, default: "" }, // "Ainda não decidi" também é resposta
    observacoes: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.models.Propriedade || mongoose.model('Propriedade', PropriedadeSchema);
