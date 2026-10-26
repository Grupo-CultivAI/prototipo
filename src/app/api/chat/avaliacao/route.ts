import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ChatMessage from '@/models/ChatMessage';
import { getUserIdFromToken } from '@/lib/auth';

// 👍/👎 do produtor numa resposta. avaliacao null desfaz a avaliação.
// As respostas mal avaliadas aparecem em npm run relatorio-chat, para a Frente 3.
export async function POST(req: Request) {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });

    const { id, avaliacao } = await req.json().catch(() => ({}));
    if (!mongoose.isValidObjectId(id) || ![null, 'boa', 'ruim'].includes(avaliacao)) {
        return NextResponse.json({ success: false, message: 'Avaliação inválida.' }, { status: 400 });
    }

    await dbConnect();
    // userId no filtro: cada pessoa só avalia as respostas da própria conversa.
    const { matchedCount } = await ChatMessage.updateOne(
        { _id: id, userId, sender: 'bot' },
        avaliacao ? { $set: { 'metadata.avaliacao': avaliacao } } : { $unset: { 'metadata.avaliacao': 1 } },
    );
    if (!matchedCount) return NextResponse.json({ success: false, message: 'Resposta não encontrada.' }, { status: 404 });
    return NextResponse.json({ success: true });
}
