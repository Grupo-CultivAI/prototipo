import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Conversa from '@/models/Conversa';
import { getUserIdFromToken } from '@/lib/auth';
import { conversaAtual } from '@/lib/conversas';

// "Nova conversa": as anteriores ficam guardadas, e o contexto da IA recomeça do zero.
export async function POST() {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });

    await dbConnect();
    // Clicar várias vezes sem perguntar nada não cria várias conversas vazias.
    const atual = await conversaAtual(userId, { criar: false });
    if (atual && !atual.perguntas) return NextResponse.json({ success: true, conversaId: atual._id });

    const nova = await Conversa.create({ userId });
    return NextResponse.json({ success: true, conversaId: nova._id });
}
