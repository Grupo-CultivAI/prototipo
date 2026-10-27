// Remove dos perfis gravados os campos antigos "culturas" e "objetivo", que saíram do
// modelo Propriedade (substituídos por culturasHistorico e objetivos).
//
// Uso:
//   node scripts/limpar-campos-legados.mjs              → só conta o que seria alterado
//   node scripts/limpar-campos-legados.mjs --confirmar  → altera o banco
//
// Se algum perfil tiver valor só no campo antigo, ele é copiado para o novo antes de apagar.
// O banco do .env.local é o mesmo da produção.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const confirmar = process.argv.includes('--confirmar');
await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cultivai' });
const perfis = mongoose.connection.db.collection('propriedades');

const comCampoAntigo = { $or: [{ culturas: { $exists: true } }, { objetivo: { $exists: true } }] };
const vazio = (lista) => !Array.isArray(lista) || lista.length === 0;

let copiados = 0;
const afetados = await perfis.find(comCampoAntigo).project({ culturas: 1, objetivo: 1, culturasHistorico: 1, objetivos: 1 }).toArray();
for (const p of afetados) {
    const novo = {};
    if (p.culturas?.trim() && vazio(p.culturasHistorico)) novo.culturasHistorico = p.culturas.split(',').map((c) => c.trim()).filter(Boolean);
    if (p.objetivo?.trim() && vazio(p.objetivos)) novo.objetivos = [p.objetivo.trim()];
    if (Object.keys(novo).length) {
        copiados++;
        if (confirmar) await perfis.updateOne({ _id: p._id }, { $set: novo });
    }
}

console.log(`\n${afetados.length} perfil(is) com campo antigo; ${copiados} com valor que precisa ir para o campo novo.`);
if (!confirmar) {
    console.log('Nada foi alterado. Para aplicar, rode de novo com --confirmar.\n');
} else {
    const r = await perfis.updateMany(comCampoAntigo, { $unset: { culturas: '', objetivo: '' } });
    console.log(`${r.modifiedCount} perfil(is) limpo(s).\n`);
}
await mongoose.disconnect();
