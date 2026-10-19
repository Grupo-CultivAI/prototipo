import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(req) {
    try {
        await dbConnect();
        const { email, senhaAtual, novaSenha } = await req.json();

        if (!email || !senhaAtual || !novaSenha) {
            return NextResponse.json(
                { message: 'Preencha todos os campos.' },
                { status: 400 }
            );
        }

        const user = await User.findOne({ email });
        const credenciaisOk = user && (await bcrypt.compare(senhaAtual, user.senha));

        // Mesma resposta para email inexistente e senha errada: distinguir os dois
        // permitiria descobrir quais emails têm conta no sistema.
        if (!credenciaisOk) {
            return NextResponse.json(
                { message: 'Email ou senha atual incorretos.' },
                { status: 401 }
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
