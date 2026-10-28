// Relatório do uso do chat, para fechar o ciclo entre as frentes:
//   - respostas marcadas com 👎 pelos produtores → a Frente 3 investiga o que a IA errou;
//   - perguntas cuja busca na base achou pouco → assuntos que faltam na base da Embrapa,
//     para orientar a pesquisa de novos documentos.
// Uso: npm run relatorio-chat [-- --dias 30 --limite 0.42]
// Lê o MongoDB (.env.local) e não consome cota de nenhuma API. Não mostra quem perguntou.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FAIXA_FORA_DO_TEMA, FAIXA_POUCA_COBERTURA, MODELO_EMBEDDING } from '../src/lib/embeddings.mjs';
dotenv.config({ path: '.env.local', quiet: true });

const opcao = (nome, padrao) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i > -1 ? Number(process.argv[i + 1]) : padrao;
};
const DIAS = opcao('dias', 30);
// Cada modelo de embedding tem a sua escala de score. As respostas gravam o modelo da busca
// (metadata.busca.modelo); as de antes de 28/10/2026, sem esse campo, são do Gemini.
// As faixas se sobrepõem, então a lista de lacunas é de candidatos: cada pergunta precisa ser lida.
const FAIXAS = {
    [MODELO_EMBEDDING]: { foraDoTema: FAIXA_FORA_DO_TEMA, poucaCobertura: opcao('limite', FAIXA_POUCA_COBERTURA) },
    // Gemini, calibração de 25 e 26/10/2026: fora do tema 0,54–0,60; ausente da base 0,65–0,76; coberto 0,71–0,83.
    'gemini-embedding-001': { foraDoTema: 0.62, poucaCobertura: 0.72 },
};
const faixasDe = (r) => FAIXAS[r.metadata.busca?.modelo ?? 'gemini-embedding-001'] ?? FAIXAS['gemini-embedding-001'];

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
        const faixas = faixasDe(r);
        if (score == null || score >= faixas.poucaCobertura) continue;
        const chave = r.pergunta.trim().toLowerCase();
        const atual = lacunas.get(chave);
        if (atual) atual.vezes++;
        else lacunas.set(chave, { pergunta: r.pergunta, score, vezes: 1, foraDoTema: score < faixas.foraDoTema, gemini: !r.metadata.busca?.modelo });
    }
    const lista = [...lacunas.values()].sort((a, b) => a.score - b.score);
    const atual = FAIXAS[MODELO_EMBEDDING];
    const imprimir = (titulo, itens) => {
        console.log(`\n${titulo} (${itens.length})`);
        if (!itens.length) console.log('   nenhuma');
        for (const l of itens) console.log(`   ${l.score.toFixed(2)}${l.gemini ? ' (G)' : '    '}  ${l.vezes > 1 ? `[${l.vezes}x] ` : ''}${curto(l.pergunta, 160)}`);
    };
    imprimir(`🔎 Pouca cobertura na base (busca entre ${atual.foraDoTema.toFixed(2)} e ${atual.poucaCobertura.toFixed(2)}) — candidatos a novos documentos`,
        lista.filter((l) => !l.foraDoTema).reverse());
    imprimir(`🚫 Busca abaixo de ${atual.foraDoTema.toFixed(2)} — em geral, fora do tema`, lista.filter((l) => l.foraDoTema));
    if (lista.some((l) => l.gemini)) console.log('\n(G) = busca feita com o Gemini, antes de 28/10/2026, noutra escala: faixas de 0,62 e 0,72.');
    console.log('\nRespostas gravadas antes desta versão do chat não têm a nota da busca e ficam de fora das lacunas.\n');
} finally {
    await mongoose.disconnect();
}
