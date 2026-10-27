import mongoose from 'mongoose';

// Época de plantio oficial (ZARC) de um município, gravada por scripts/importar-zarc.mjs a
// partir dos dados abertos do Ministério da Agricultura. O formato de "j" está descrito no
// script e em src/lib/zarc-formato.mjs. Só leitura no app.
const ZarcMunicipioSchema = new mongoose.Schema({
    _id: String, // geocódigo do IBGE
    uf: String,
    nome: String,
    busca: String, // nome sem acento, em minúsculas
    j: mongoose.Schema.Types.Mixed,
    atualizadoEm: Date
}, { collection: 'zarcmunicipios', versionKey: false });

ZarcMunicipioSchema.index({ uf: 1, busca: 1 });

export default mongoose.models.ZarcMunicipio || mongoose.model('ZarcMunicipio', ZarcMunicipioSchema);
