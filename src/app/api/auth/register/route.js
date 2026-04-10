import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(req) {
    try {
        await dbConnect();
        const { nome, email, senha } = await req.json();

        if (!nome || !email || !senha) {
            return NextResponse.json(
                { message: 'Preencha todos os campos.' },
                { status: 400 }
            );
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { message: 'Email já cadastrado.' },
                { status: 400 }
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
            { message: 'Erro interno ao cadastrar usuário' },
            { status: 500 }
        );
    }
}
