import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getUserIdFromToken } from '@/lib/auth';
import ChatMessage from '@/models/ChatMessage';
import Conversa from '@/models/Conversa';
import { conversaAtual, conversaDoUsuario } from '@/lib/conversas';
import { comTitulos } from '@/lib/documentos';
import { LIMITE_POR_DIA, perguntasRestantesHoje } from '@/lib/limites';

// Mensagens da conversa pedida (?conversa=id, vinda da lista) ou, sem ela, da mais recente.
export async function GET(req) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });

        await dbConnect();
        const pedida = new URL(req.url).searchParams.get('conversa');
        // Quem nunca perguntou nada ainda não tem conversa.
        const conversa = pedida ? await conversaDoUsuario(userId, pedida, { criar: false }) : await conversaAtual(userId, { criar: false });
        // Perguntas que falharam ou foram apagadas ficam gravadas só para contar no limite de uso.
        const [history, restantesHoje] = await Promise.all([
            conversa
                ? ChatMessage.find({ conversaId: conversa._id, 'metadata.falhou': { $ne: true }, 'metadata.apagada': { $ne: true } }).sort({ timestamp: 1 }).lean()
                : [],
            perguntasRestantesHoje(userId),
        ]);

        const formattedHistory = history.map(msg => ({
            id: msg._id,
            text: msg.text,
            sender: msg.sender,
            form: msg.metadata?.form,
            submittedData: msg.metadata?.submittedData,
            fontes: comTitulos(msg.metadata?.fontes),
            epoca: msg.metadata?.epoca,
            semBase: msg.metadata?.busca?.falha,
            avaliacao: msg.metadata?.avaliacao
        }));

        return NextResponse.json({ success: true, history: formattedHistory, restantesHoje, limiteDiario: LIMITE_POR_DIA, conversaId: conversa?._id ?? null, propriedadeId: conversa?.propriedadeId ?? null });
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        return NextResponse.json({ success: false, message: 'Não conseguimos falar com o servidor agora. Tente de novo em alguns instantes.' }, { status: 500 });
    }
}

// Apaga a conversa aberta (?conversa=id) e abre uma nova, vazia.
export async function DELETE(req) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });

        await dbConnect();
        const conversa = await conversaDoUsuario(userId, new URL(req.url).searchParams.get('conversa'));
        // Apagar tudo zerava o limite diário, que conta as perguntas gravadas: bastava reiniciar
        // o chat para fazer mais 30. As perguntas das últimas 24h ficam só como registro, sem o
        // texto, e o resto é apagado de fato.
        const desde = new Date(Date.now() - 86_400_000);
        await ChatMessage.updateMany(
            { conversaId: conversa._id, sender: 'user', createdAt: { $gte: desde } },
            { $set: { text: '[apagada]', 'metadata.apagada': true }, $unset: { 'metadata.submittedData': 1 } },
        );
        await ChatMessage.deleteMany({ conversaId: conversa._id, $or: [{ sender: 'bot' }, { createdAt: { $lt: desde } }] });
        await Conversa.deleteOne({ _id: conversa._id });
        // A conversa nova continua sobre o mesmo cultivo
        const nova = await Conversa.create({ userId, propriedadeId: conversa.propriedadeId ?? null });

        return NextResponse.json({ success: true, message: 'Conversa apagada', conversaId: nova._id, propriedadeId: nova.propriedadeId });
    } catch (error) {
        console.error("Erro ao apagar histórico:", error);
        return NextResponse.json({ success: false, message: 'Não conseguimos falar com o servidor agora. Tente de novo em alguns instantes.' }, { status: 500 });
    }
}
