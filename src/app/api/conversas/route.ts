import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Conversa from '@/models/Conversa';
import { getUserIdFromToken } from '@/lib/auth';
import { conversaAtual } from '@/lib/conversas';

const CONVERSAS_NA_LISTA = 50;

// Lista das conversas, a de mensagem mais recente primeiro. As vazias ficam de fora:
// não há o que reabrir nelas.
export async function GET() {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });

    await dbConnect();
    const conversas = await Conversa.find({ userId, perguntas: { $gt: 0 } })
        .sort({ ultimaMensagemEm: -1 })
        .limit(CONVERSAS_NA_LISTA)
        .select('titulo perguntas ultimaMensagemEm createdAt')
        .lean<{ _id: unknown; titulo: string; perguntas: number; ultimaMensagemEm: Date | null; createdAt: Date }[]>();

    return NextResponse.json({
        success: true,
        conversas: conversas.map((c) => ({
            id: c._id,
            titulo: c.titulo || 'Conversa sem título',
            perguntas: c.perguntas,
            ultimaMensagemEm: c.ultimaMensagemEm ?? c.createdAt,
        })),
    });
}

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
