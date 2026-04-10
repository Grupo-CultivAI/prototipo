import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback_secret'
);

export async function POST(req) {
    try {
        await dbConnect();
        const { email, senha } = await req.json();

        if (!email || !senha) {
            return NextResponse.json(
                { message: 'Preencha todos os campos.' },
                { status: 400 }
            );
        }

        const user = await User.findOne({ email });
        if (!user) {
            return NextResponse.json(
                { message: 'Email ou senha incorretos' },
                { status: 401 }
            );
        }

        const authOk = await bcrypt.compare(senha, user.senha);
        if (!authOk) {
            return NextResponse.json(
                { message: 'Email ou senha incorretos' },
                { status: 401 }
            );
        }

        // Gerar JWT com a biblioteca jose
        const alg = 'HS256';
        const jwt = await new SignJWT({ id: user._id.toString(), email: user.email, nome: user.nome })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(JWT_SECRET);

        // Setting cookie explicitly ensuring we return a Response first and Next.js sets it headers
        const response = NextResponse.json(
            {
                success: true,
                message: 'Login realizado com sucesso',
                user: { id: user._id.toString(), email: user.email, nome: user.nome }
            },
            { status: 200 }
        );

        response.cookies.set('authToken', jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login Error:', error);
        return NextResponse.json(
            { message: 'Erro interno ao realizar login' },
            { status: 500 }
        );
    }
}
