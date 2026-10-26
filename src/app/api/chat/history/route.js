import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import ChatMessage from '@/models/ChatMessage';
import { comTitulos } from '@/lib/documentos';
import { perguntasRestantesHoje } from '@/lib/limites';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function getUserIdFromToken() {
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload.id;
    } catch (error) {
        return null;
    }
}

export async function GET() {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        // Perguntas que falharam ou foram apagadas ficam gravadas só para contar no limite de uso.
        const [history, restantesHoje] = await Promise.all([
            ChatMessage.find({ userId, 'metadata.falhou': { $ne: true }, 'metadata.apagada': { $ne: true } }).sort({ timestamp: 1 }),
            perguntasRestantesHoje(userId),
        ]);

        const formattedHistory = history.map(msg => ({
            id: msg._id,
            text: msg.text,
            sender: msg.sender,
            form: msg.metadata?.form,
            submittedData: msg.metadata?.submittedData,
            fontes: comTitulos(msg.metadata?.fontes),
            avaliacao: msg.metadata?.avaliacao
        }));

        return NextResponse.json({ success: true, history: formattedHistory, restantesHoje });
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        // Apagar tudo zerava o limite diário, que conta as perguntas gravadas: bastava reiniciar
        // o chat para fazer mais 30. As perguntas das últimas 24h ficam só como registro, sem o
        // texto, e o resto é apagado de fato.
        const desde = new Date(Date.now() - 86_400_000);
        await ChatMessage.updateMany(
            { userId, sender: 'user', createdAt: { $gte: desde } },
            { $set: { text: '[apagada]', 'metadata.apagada': true }, $unset: { 'metadata.submittedData': 1 } },
        );
        await ChatMessage.deleteMany({ userId, $or: [{ sender: 'bot' }, { createdAt: { $lt: desde } }] });

        return NextResponse.json({ success: true, message: 'Histórico apagado com sucesso' });
    } catch (error) {
        console.error("Erro ao apagar histórico:", error);
        return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
    }
}
