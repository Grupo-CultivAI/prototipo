import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(req) {
    try {
        await dbConnect();
        const { email, novaSenha } = await req.json();

        if (!email || !novaSenha) {
            return NextResponse.json(
                { message: 'Preencha todos os campos.' },
                { status: 400 }
            );
        }

        const user = await User.findOne({ email });
        if (!user) {
            return NextResponse.json(
                { message: 'Email não encontrado.' },
                { status: 404 }
            );
        }

        const salt = await bcrypt.genSalt(10);
        user.senha = await bcrypt.hash(novaSenha, salt);
        await user.save();

        return NextResponse.json(
            { message: 'Senha redefinida com sucesso!' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json(
            { message: 'Erro interno ao redefinir senha' },
            { status: 500 }
        );
    }
}
