import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

// O detalhe técnico fica no log da Vercel; para a pessoa, o que fazer.
const SERVIDOR_FORA = 'Não conseguimos falar com o servidor agora. Tente de novo em alguns instantes.';

export async function POST(req) {
    try {
        await dbConnect();
        const { nome, email: emailDigitado, senha } = await req.json();
        // "Eduarda@gmail.com" e "eduarda@gmail.com " viravam duas contas diferentes.
        const email = String(emailDigitado ?? '').trim().toLowerCase();

        if (!nome || !email || !senha) {
            return NextResponse.json(
                { message: 'Preencha todos os campos.' },
                { status: 400 }
            );
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { message: 'Esse email já tem conta. Quer entrar?', emailJaCadastrado: true },
                { status: 409 }
            );
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);

        const newUser = await User.create({
            nome,
            email,
            senha: hashedPassword,
        });

        return NextResponse.json(
            { message: 'Usuário cadastrado com sucesso!', user: { id: newUser._id, nome: newUser.nome, email: newUser.email } },
            { status: 201 }
        );
    } catch (error) {
        console.error('Registration Error:', error);
        return NextResponse.json(
            { message: SERVIDOR_FORA },
            { status: 500 }
        );
    }
}
