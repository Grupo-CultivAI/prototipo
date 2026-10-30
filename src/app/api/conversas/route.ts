import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Conversa from '@/models/Conversa';
import { getUserIdFromToken } from '@/lib/auth';
import { conversaAtual } from '@/lib/conversas';
import { cultivoDoUsuario, nomeDoCultivo } from '@/lib/cultivos';

const CONVERSAS_NA_LISTA = 50;

// Lista das conversas, a de mensagem mais recente primeiro, com o nome do cultivo de cada uma.
// As vazias ficam de fora: não há o que reabrir nelas.
export async function GET() {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });

    await dbConnect();
    const conversas = await Conversa.find({ userId, perguntas: { $gt: 0 } })
        .sort({ ultimaMensagemEm: -1 })
        .limit(CONVERSAS_NA_LISTA)
        .select('titulo perguntas ultimaMensagemEm createdAt propriedadeId')
        .populate({ path: 'propriedadeId', select: 'nome cidade' })
        .lean<{ _id: unknown; titulo: string; perguntas: number; ultimaMensagemEm: Date | null; createdAt: Date; propriedadeId: any }[]>();

    return NextResponse.json({
        success: true,
        conversas: conversas.map((c) => ({
            id: c._id,
            titulo: c.titulo || 'Conversa sem título',
            perguntas: c.perguntas,
            ultimaMensagemEm: c.ultimaMensagemEm ?? c.createdAt,
            cultivo: c.propriedadeId ? nomeDoCultivo(c.propriedadeId) : null,
        })),
    });
}

// "Nova conversa": as anteriores ficam guardadas, e o contexto da IA recomeça do zero.
// Com { propriedadeId }, a conversa nova é sobre aquele cultivo ("Perguntar sobre este cultivo",
// ou a troca de cultivo no topo do chat); null deixa a conversa geral.
export async function POST(req: Request) {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    await dbConnect();
    let propriedadeId = null;
    if (body?.propriedadeId) {
        const cultivo = await cultivoDoUsuario(userId, body.propriedadeId);
        if (!cultivo) return NextResponse.json({ success: false, message: 'Cultivo não encontrado.' }, { status: 404 });
        propriedadeId = cultivo._id;
    }

    // Clicar várias vezes sem perguntar nada não cria várias conversas vazias: a vazia é reaproveitada.
    const atual = await conversaAtual(userId, { criar: false });
    if (atual && !atual.perguntas) {
        if (body && 'propriedadeId' in body) await Conversa.updateOne({ _id: atual._id }, { $set: { propriedadeId } });
        return NextResponse.json({ success: true, conversaId: atual._id, propriedadeId: 'propriedadeId' in (body ?? {}) ? propriedadeId : atual.propriedadeId });
    }

    const nova = await Conversa.create({ userId, propriedadeId });
    return NextResponse.json({ success: true, conversaId: nova._id, propriedadeId });
}
