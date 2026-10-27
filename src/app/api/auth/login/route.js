import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { normalizarEmail } from '@/lib/senha';
import { excedeuLimite, registrarTentativa, limparTentativas, ipDe, MINUTOS_DE_ESPERA } from '@/lib/tentativas';

// O detalhe técnico fica no log da Vercel; para a pessoa, o que fazer.
const SERVIDOR_FORA = 'Não conseguimos falar com o servidor agora. Tente de novo em alguns instantes.';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req) {
    try {
        await dbConnect();
        const { email: emailDigitado, senha } = await req.json();
        const email = String(emailDigitado ?? '').trim();

        if (!email || !senha) {
            return NextResponse.json(
                { message: 'Preencha todos os campos.' },
                { status: 400 }
            );
        }

        const ip = ipDe(req);
        const chaveEmail = normalizarEmail(email);
        if (await excedeuLimite('login', chaveEmail, ip)) {
            return NextResponse.json(
                { message: `Muitas tentativas seguidas. Aguarde ${MINUTOS_DE_ESPERA} minutos ou use "Esqueci a senha".` },
                { status: 429, headers: { 'Retry-After': String(MINUTOS_DE_ESPERA * 60) } }
            );
        }

        // O cadastro grava o email em minúsculas; contas antigas podem ter maiúsculas.
        const user = await User.findOne({ email: chaveEmail }) ?? await User.findOne({ email });
        const authOk = user && await bcrypt.compare(senha, user.senha);
        if (!authOk) {
            await registrarTentativa('login', chaveEmail, ip);
            return NextResponse.json(
                { message: 'Email ou senha incorretos' },
                { status: 401 }
            );
        }
        await limparTentativas('login', chaveEmail);

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
            { message: SERVIDOR_FORA },
            { status: 500 }
        );
    }
}
