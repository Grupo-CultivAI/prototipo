import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import dbConnect from '@/lib/mongodb';
import { getUserIdFromToken } from '@/lib/auth';
import { cultivoDoUsuario } from '@/lib/cultivos';
import { gerarResposta } from '@/lib/modelos';
import { normalizar } from '@/lib/zarc-formato.mjs';
import Propriedade from '@/models/Propriedade';
import ChatMessage from '@/models/ChatMessage';

// "Salvar como plano" numa resposta do chat: o modelo de linguagem tira da resposta a sequência
// de culturas (etapas), que vira o plano de rotação do cultivo. O produtor ajusta e marca as
// etapas feitas no formulário do cultivo.

const MAXIMO_DE_ETAPAS = 8;
const CARACTERES_DA_RESPOSTA = 4000;

const INSTRUCAO = `Você extrai planos de rotação de culturas de um texto em português. Responda só com JSON, sem nada antes ou depois, neste formato:
{"etapas":[{"quando":"...","cultura":"...","objetivo":"..."}]}
Regras:
- Uma etapa para cada cultura da sequência proposta, na ordem em que o texto propõe plantar.
- "quando": o período que o texto cita (ex.: "Safra 2025/26", "Inverno 2026", "1º ano, verão"). Se o texto não diz, deixe "".
- "cultura": o nome curto da cultura (ex.: "Soja", "Milho safrinha", "Crotalária").
- "objetivo": o motivo daquela etapa, em até 12 palavras, ou "".
- No máximo ${MAXIMO_DE_ETAPAS} etapas. Não invente culturas que não estão no texto.
- Se o texto não traz uma sequência de culturas para plantar, responda {"etapas":[]}.`;

const respostaDoModelo = z.object({
    etapas: z.array(z.object({
        quando: z.string().trim().max(60).catch(''),
        cultura: z.string().trim().min(1).max(60),
        objetivo: z.string().trim().max(200).catch(''),
    })).max(MAXIMO_DE_ETAPAS),
});

// A etapa só fica se a cultura aparece mesmo no texto da resposta (o modelo não pode inventar).
const citadaNoTexto = (cultura, texto) => {
    const palavra = normalizar(cultura).split(' ')[0];
    return palavra.length >= 3 && ` ${texto} `.includes(` ${palavra}`);
};

export async function POST(req, { params }) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const { mensagemId } = (await req.json().catch(() => ({}))) ?? {};
        if (!mongoose.isValidObjectId(mensagemId)) return NextResponse.json({ message: 'Resposta inválida.' }, { status: 400 });

        await dbConnect();
        const cultivo = await cultivoDoUsuario(userId, (await params).id);
        if (!cultivo) return NextResponse.json({ message: 'Cultivo não encontrado.' }, { status: 404 });
        const mensagem = await ChatMessage.findOne({ _id: mensagemId, userId, sender: 'bot' }).select('text').lean();
        if (!mensagem?.text) return NextResponse.json({ message: 'Resposta não encontrada.' }, { status: 404 });

        // Clicar de novo na mesma resposta não gasta outra chamada ao modelo.
        if (cultivo.plano && String(cultivo.plano.mensagemId) === String(mensagemId)) {
            return NextResponse.json({ success: true, plano: cultivo.plano, substituiu: false });
        }

        const texto = mensagem.text.slice(0, CARACTERES_DA_RESPOSTA);
        const geracao = await gerarResposta(
            [{ role: 'system', content: INSTRUCAO }, { role: 'user', content: texto }],
            { tetoDeTokens: 700, temperatura: 0 },
        );
        if (!geracao.texto) return NextResponse.json({ message: 'O assistente está sem resposta agora. Tente de novo em instantes.' }, { status: 503 });

        let etapas = [];
        try {
            const json = geracao.texto.slice(geracao.texto.indexOf('{'), geracao.texto.lastIndexOf('}') + 1);
            const lido = respostaDoModelo.safeParse(JSON.parse(json));
            if (lido.success) etapas = lido.data.etapas;
        } catch { }
        const normalizado = normalizar(texto);
        etapas = etapas.filter((e) => citadaNoTexto(e.cultura, normalizado)).map((e) => ({ ...e, feita: false }));
        if (!etapas.length) {
            return NextResponse.json({ message: 'Esta resposta não traz uma sequência de culturas para salvar como plano. Peça ao assistente um plano de rotação para as próximas safras.' }, { status: 422 });
        }

        const plano = { etapas, mensagemId, criadoEm: new Date() };
        await Propriedade.updateOne({ _id: cultivo._id, userId }, { $set: { plano } });
        return NextResponse.json({ success: true, plano, substituiu: Boolean(cultivo.plano?.etapas?.length) });
    } catch (err) {
        console.error('Erro ao salvar o plano:', err);
        return NextResponse.json({ message: 'Não deu para salvar o plano agora. Tente de novo em instantes.' }, { status: 500 });
    }
}
