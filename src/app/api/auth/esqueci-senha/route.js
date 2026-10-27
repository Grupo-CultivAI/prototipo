import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { normalizarEmail } from '@/lib/senha';
import { emailConfigurado, enviarEmail } from '@/lib/email';
import { excedeuLimite, registrarTentativa, ipDe, MINUTOS_DE_ESPERA } from '@/lib/tentativas';

const VALIDADE_MIN = 30;

// Mesma resposta exista a conta ou não: dizer "esse email não tem conta" permitiria
// descobrir quem usa o CultivAI.
const RESPOSTA = 'Se existir uma conta com esse email, enviamos um link para criar uma nova senha. Confira também a caixa de spam.';

export async function POST(req) {
    try {
        const { email: emailDigitado } = await req.json().catch(() => ({}));
        const email = normalizarEmail(emailDigitado);
        if (!email) return NextResponse.json({ message: 'Informe o seu email.' }, { status: 400 });

        if (!emailConfigurado() && process.env.NODE_ENV === 'production') {
            console.error('Recuperação de senha pedida, mas o SMTP não está configurado (SMTP_HOST, SMTP_USER, SMTP_PASS).');
            return NextResponse.json(
                { message: 'A recuperação de senha por email ainda não está ativa. Fale com a equipe do CultivAI.' },
                { status: 503 }
            );
        }

        await dbConnect();
        const ip = ipDe(req);
        if (await excedeuLimite('recuperacao', email, ip)) {
            return NextResponse.json(
                { message: `Você já pediu vários links. Aguarde ${MINUTOS_DE_ESPERA} minutos e confira o email, inclusive o spam.` },
                { status: 429 }
            );
        }
        await registrarTentativa('recuperacao', email, ip);

        const user = await User.findOne({ email });
        if (!user) return NextResponse.json({ message: RESPOSTA });

        // O código vai só no link do email; o banco guarda o hash, como faz com a senha.
        const codigo = crypto.randomBytes(32).toString('hex');
        user.resetSenhaHash = crypto.createHash('sha256').update(codigo).digest('hex');
        user.resetSenhaExpira = new Date(Date.now() + VALIDADE_MIN * 60_000);
        await user.save();

        // APP_URL fixa o endereço do link; sem ela, usa o endereço desta requisição.
        const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '');
        const link = `${base}/redefinir-senha?codigo=${codigo}`;

        if (!emailConfigurado()) {
            console.log(`🔑 SMTP não configurado (desenvolvimento). Link de recuperação: ${link}`);
            return NextResponse.json({ message: RESPOSTA });
        }

        await enviarEmail({
            para: user.email,
            assunto: 'CultivAI: criar uma nova senha',
            texto: `Olá, ${user.nome}!\n\nRecebemos um pedido para criar uma nova senha no CultivAI. Para continuar, abra o link abaixo (ele vale por ${VALIDADE_MIN} minutos):\n\n${link}\n\nSe não foi você, ignore este email: sua senha continua a mesma.`,
            html: `<p>Olá, ${user.nome.replace(/[<>&"]/g, '')}!</p>
<p>Recebemos um pedido para criar uma nova senha no CultivAI. O link vale por ${VALIDADE_MIN} minutos:</p>
<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Criar nova senha</a></p>
<p>Se não foi você, ignore este email: sua senha continua a mesma.</p>`,
        });
        return NextResponse.json({ message: RESPOSTA });
    } catch (error) {
        console.error('Esqueci a senha Error:', error);
        return NextResponse.json(
            { message: 'Não conseguimos enviar o email agora. Tente de novo em alguns instantes.' },
            { status: 500 }
        );
    }
}
