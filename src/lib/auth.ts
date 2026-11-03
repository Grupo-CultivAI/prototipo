import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET environment variable is not set');
const JWT_SECRET = new TextEncoder().encode(secret);

// O id da conta da sessão, ou null. Além da assinatura do cookie, confere no banco se a conta
// existe e se a versão da sessão (v) é a atual: trocar a senha sobe a versão e derruba as
// sessões abertas antes. Antes da revisão de engenharia de 03/11/2026, quem tinha pegado a
// sessão de alguém continuava entrando por até 7 dias, mesmo depois da troca de senha.
// Cookies e contas de antes da versão, sem o campo, valem como versão 0.
export async function getUserIdFromToken(): Promise<string | null> {
    const token = (await cookies()).get('authToken')?.value;
    if (!token) return null;
    let id: string;
    let versao: number;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        if (typeof payload.id !== 'string' || !mongoose.isValidObjectId(payload.id)) return null;
        id = payload.id;
        versao = typeof payload.v === 'number' ? payload.v : 0;
    } catch {
        return null;
    }
    await dbConnect();
    const valida = await User.exists({ _id: id, versaoSessao: versao === 0 ? { $in: [0, null] } : versao });
    return valida ? id : null;
}
