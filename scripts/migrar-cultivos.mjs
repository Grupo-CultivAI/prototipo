// Meus Cultivos (30/10/2026): cada conta pode ter vários cultivos. O banco ainda tem o índice
// único em propriedades.userId, de quando era um perfil por conta, e recusa o segundo cultivo
// (erro E11000). Este script troca esse índice por um comum. Os perfis existentes continuam
// como estão e viram o primeiro cultivo de cada conta (sem nome, aparecem como "Cultivo em
// <cidade>" até a pessoa dar um nome).
//
// Uso:
//   node scripts/migrar-cultivos.mjs              → só mostra o que seria feito
//   node scripts/migrar-cultivos.mjs --confirmar  → troca o índice
//
// O banco do .env.local é o mesmo da produção. Pode rodar mais de uma vez.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const confirmar = process.argv.includes('--confirmar');
await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cultivai' });
const perfis = mongoose.connection.db.collection('propriedades');

const indices = await perfis.indexes();
const unico = indices.find((i) => i.unique && Object.keys(i.key).join() === 'userId');
const novo = indices.find((i) => Object.keys(i.key).join() === 'userId,createdAt');
console.log(`\n${await perfis.countDocuments()} perfil(is) na coleção propriedades.`);
console.log(unico ? `Índice único antigo: ${unico.name} (precisa sair).` : 'Índice único antigo: já não existe.');
console.log(novo ? `Índice novo: ${novo.name} (já existe).` : 'Índice novo { userId, createdAt }: ainda não existe.');

if (!confirmar) {
    console.log('\nNada foi alterado. Para aplicar, rode de novo com --confirmar.\n');
} else {
    if (unico) await perfis.dropIndex(unico.name);
    if (!novo) await perfis.createIndex({ userId: 1, createdAt: 1 });
    console.log('\nPronto: cada conta já pode cadastrar mais de um cultivo.\n');
}
await mongoose.disconnect();
