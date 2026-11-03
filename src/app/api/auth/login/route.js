import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { normalizarEmail } from '@/lib/senha';
import { senhaConfere } from '@/lib/conferirSenha';
import { gravarCookieSessao } from '@/lib/cookieSessao';
import { excedeuLimite, registrarTentativa, limparTentativas, ipDe, MINUTOS_DE_ESPERA } from '@/lib/tentativas';

// O detalhe técnico fica no log da Vercel; para a pessoa, o que fazer.
const SERVIDOR_FORA = 'Não conseguimos falar com o servidor agora. Tente de novo em alguns instantes.';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
}

export async function POST(req) {
    try {
        await dbConnect();
        const { email: emailDigitado, senha } = await req.json();
        const email = String(emailDigitado ?? '').trim();

        if (!email || typeof senha !== 'string' || !senha) {
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
        // O bcrypt roda mesmo sem conta, para o tempo da resposta não revelar se o email existe.
        if (!(await senhaConfere(senha, user))) {
            await registrarTentativa('login', chaveEmail, ip);
            return NextResponse.json(
                { message: 'Email ou senha incorretos' },
                { status: 401 }
            );
        }
        await limparTentativas('login', chaveEmail);

        const response = NextResponse.json(
            {
                success: true,
                message: 'Login realizado com sucesso',
                user: { id: user._id.toString(), email: user.email, nome: user.nome }
            },
            { status: 200 }
        );

        return gravarCookieSessao(response, user);
    } catch (error) {
        console.error('Login Error:', error);
        return NextResponse.json(
            { message: SERVIDOR_FORA },
            { status: 500 }
        );
    }
}
