import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import ChatMessage from '@/models/ChatMessage';

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
        const history = await ChatMessage.find({ userId }).sort({ timestamp: 1 });

        const formattedHistory = history.map(msg => ({
            id: msg._id,
            text: msg.text,
            sender: msg.sender,
            form: msg.metadata?.form,
            submittedData: msg.metadata?.submittedData
        }));

        return NextResponse.json({ success: true, history: formattedHistory });
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
        await ChatMessage.deleteMany({ userId });

        return NextResponse.json({ success: true, message: 'Histórico apagado com sucesso' });
    } catch (error) {
        console.error("Erro ao apagar histórico:", error);
        return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
    }
}
