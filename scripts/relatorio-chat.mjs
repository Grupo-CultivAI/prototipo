// Relatório do uso do chat, para fechar o ciclo entre as frentes:
//   - respostas marcadas com 👎 pelos produtores → a Frente 3 investiga o que a IA errou;
//   - perguntas cuja busca na base achou pouco → assuntos que faltam na base da Embrapa,
//     para orientar a pesquisa de novos documentos.
// Uso: npm run relatorio-chat [-- --dias 30 --limite 0.72]
// Lê o MongoDB (.env.local) e não consome cota de nenhuma API. Não mostra quem perguntou.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const opcao = (nome, padrao) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i > -1 ? Number(process.argv[i + 1]) : padrao;
};
const DIAS = opcao('dias', 30);
// Calibração de 25/10/2026: fora do tema pontua 0,54–0,59; assunto agrícola ausente da base,
// 0,68–0,76; assunto coberto, 0,71–0,83. As faixas se sobrepõem, então a lista de lacunas é
// de candidatos: cada pergunta precisa ser lida.
const LIMITE = opcao('limite', 0.72);
// Em 26/10/2026, "receita de pão caseiro" pontuou 0,60 e "melão com água salobra" (ausente da base), 0,65.
const FORA_DO_TEMA = 0.62;

const data = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const curto = (t, n) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n)}…` : s; };
// Respostas ao formulário do chat e perguntas apagadas não dizem nada sobre o assunto.
const perguntaDeVerdade = (t) => t && t !== '[apagada]' && !/^Informei: |^Prefiro não informar agora/.test(t);

await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cultivai' });
try {
    const mensagens = mongoose.connection.db.collection('chatmessages');
    const desde = new Date(Date.now() - DIAS * 86_400_000);
    const respostas = await mensagens.find({ sender: 'bot', createdAt: { $gte: desde }, 'metadata.perguntaId': { $exists: true } }).toArray();
    const perguntas = new Map((await mensagens
        .find({ _id: { $in: respostas.map((r) => r.metadata.perguntaId) } })
        .project({ text: 1 }).toArray()).map((p) => [String(p._id), p.text]));
    const comPergunta = respostas
        .map((r) => ({ ...r, pergunta: perguntas.get(String(r.metadata.perguntaId)) }))
        .filter((r) => perguntaDeVerdade(r.pergunta));

    const boas = comPergunta.filter((r) => r.metadata.avaliacao === 'boa');
    const ruins = comPergunta.filter((r) => r.metadata.avaliacao === 'ruim');
    console.log(`\n📊 Últimos ${DIAS} dias: ${comPergunta.length} respostas, ${boas.length} 👍 e ${ruins.length} 👎`);

    console.log(`\n👎 Respostas avaliadas como ruins (${ruins.length}) — para a Frente 3`);
    if (!ruins.length) console.log('   nenhuma');
    for (const r of ruins) {
        const score = r.metadata.busca?.maiorScore;
        console.log(`\n   ${data(r.createdAt)} | busca ${score != null ? score.toFixed(2) : '—'} | ${r.metadata.busca?.trechosUsados ?? 0} trecho(s)`);
        console.log(`   P: ${curto(r.pergunta, 200)}`);
        console.log(`   R: ${curto(r.text, 300)}`);
    }

    // Mesma pergunta feita várias vezes aparece uma vez, com a contagem.
    const lacunas = new Map();
    for (const r of comPergunta) {
        const score = r.metadata.busca?.maiorScore;
        if (score == null || score >= LIMITE) continue;
        const chave = r.pergunta.trim().toLowerCase();
        const atual = lacunas.get(chave);
        if (atual) atual.vezes++;
        else lacunas.set(chave, { pergunta: r.pergunta, score, vezes: 1 });
    }
    const lista = [...lacunas.values()].sort((a, b) => a.score - b.score);
    const imprimir = (titulo, itens) => {
        console.log(`\n${titulo} (${itens.length})`);
        if (!itens.length) console.log('   nenhuma');
        for (const l of itens) console.log(`   ${l.score.toFixed(2)}  ${l.vezes > 1 ? `[${l.vezes}x] ` : ''}${curto(l.pergunta, 160)}`);
    };
    imprimir(`🔎 Pouca cobertura na base (busca entre ${FORA_DO_TEMA.toFixed(2)} e ${LIMITE.toFixed(2)}) — candidatos a novos documentos`,
        lista.filter((l) => l.score >= FORA_DO_TEMA).reverse());
    imprimir(`🚫 Busca abaixo de ${FORA_DO_TEMA.toFixed(2)} — em geral, fora do tema`, lista.filter((l) => l.score < FORA_DO_TEMA));
    console.log('\nRespostas gravadas antes desta versão do chat não têm a nota da busca e ficam de fora das lacunas.\n');
} finally {
    await mongoose.disconnect();
}
