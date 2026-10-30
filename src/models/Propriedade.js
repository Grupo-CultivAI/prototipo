import mongoose from 'mongoose';

// Cada documento é um cultivo (uma área: sítio, talhão, lote) do produtor. Até 30/10/2026 era
// um perfil único por conta (userId era unique); quem tem terra em lugares diferentes, com
// solo e culturas diferentes, agora cadastra cada uma. O nome do modelo e da coleção ficou o
// mesmo para não migrar os dados (ver scripts/migrar-cultivos.mjs).
const PropriedadeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Como o produtor chama a área ("Sítio Boa Vista", "Talhão do fundo")
    nome: { type: String, default: "" },
    // base (will maintain for compatibility or can be replaced)
    tamanho: { type: String, default: "" },
    // location
    estado: { type: String, default: "" },
    cidade: { type: String, default: "" },
    codigoMunicipio: { type: String, default: "" }, // IBGE, 7 dígitos (lista do formulário ou CEP)
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

PropriedadeSchema.index({ userId: 1, createdAt: 1 });

export default mongoose.models.Propriedade || mongoose.model('Propriedade', PropriedadeSchema);
