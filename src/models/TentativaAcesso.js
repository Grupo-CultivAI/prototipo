import mongoose from 'mongoose';

// Uma linha por tentativa de login que falhou ou por pedido de recuperação de senha.
// O MongoDB apaga cada linha 15 minutos depois (índice TTL), então a coleção não cresce.
const TentativaAcessoSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['login', 'recuperacao'], required: true },
    // "email:fulano@x.com" ou "ip:200.1.2.3"
    chave: { type: String, required: true },
    criadaEm: { type: Date, default: Date.now, expires: 900 }
});

TentativaAcessoSchema.index({ tipo: 1, chave: 1, criadaEm: -1 });

export default mongoose.models.TentativaAcesso || mongoose.model('TentativaAcesso', TentativaAcessoSchema);
