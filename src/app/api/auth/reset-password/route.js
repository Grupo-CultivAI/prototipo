import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { normalizarEmail, problemaNaSenha } from '@/lib/senha';
import { excedeuLimite, registrarTentativa, limparTentativas, ipDe, MINUTOS_DE_ESPERA } from '@/lib/tentativas';

// Dois jeitos de definir uma senha nova:
// - { codigo, novaSenha }: veio do link "Esqueci a senha" enviado por email;
// - { email, senhaAtual, novaSenha }: lembra a senha e quer trocá-la.
export async function POST(req) {
    try {
        await dbConnect();
        const { codigo, email: emailDigitado, senhaAtual, novaSenha } = await req.json();

        const senhaFraca = problemaNaSenha(novaSenha);
        if (senhaFraca) return NextResponse.json({ message: senhaFraca, campo: 'novaSenha' }, { status: 400 });

        let user;
        if (codigo) {
            const hash = crypto.createHash('sha256').update(String(codigo)).digest('hex');
            user = await User.findOne({ resetSenhaHash: hash, resetSenhaExpira: { $gt: new Date() } });
            if (!user) {
                return NextResponse.json(
                    { message: 'Este link expirou ou já foi usado. Peça um novo em "Esqueci a senha".', linkInvalido: true },
                    { status: 400 }
                );
            }
        } else {
            const email = normalizarEmail(emailDigitado);
            if (!email || !senhaAtual) {
                return NextResponse.json({ message: 'Preencha todos os campos.' }, { status: 400 });
            }
            // Trocar senha também testa uma senha: entra no mesmo limite do login.
            const ip = ipDe(req);
            if (await excedeuLimite('login', email, ip)) {
                return NextResponse.json(
                    { message: `Muitas tentativas seguidas. Aguarde ${MINUTOS_DE_ESPERA} minutos ou use "Esqueci a senha".` },
                    { status: 429 }
                );
            }
            user = await User.findOne({ email }) ?? await User.findOne({ email: String(emailDigitado).trim() });
            const credenciaisOk = user && (await bcrypt.compare(senhaAtual, user.senha));
            // Mesma resposta para email inexistente e senha errada: distinguir os dois
            // permitiria descobrir quais emails têm conta no sistema.
            if (!credenciaisOk) {
                await registrarTentativa('login', email, ip);
                return NextResponse.json(
                    { message: 'Email ou senha atual incorretos.' },
                    { status: 401 }
                );
            }
        }

        const salt = await bcrypt.genSalt(10);
        user.senha = await bcrypt.hash(novaSenha, salt);
        // O link só serve uma vez.
        user.resetSenhaHash = null;
        user.resetSenhaExpira = null;
        await user.save();
        await limparTentativas('login', normalizarEmail(user.email));

        return NextResponse.json(
            { message: 'Senha alterada. Agora é só entrar com a senha nova.' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json(
            { message: 'Não conseguimos falar com o servidor agora. Tente de novo em alguns instantes.' },
            { status: 500 }
        );
    }
}
