import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { normalizarEmail, problemaNaSenha } from '@/lib/senha';
import { senhaConfere } from '@/lib/conferirSenha';
import { getUserIdFromToken } from '@/lib/auth';
import { gravarCookieSessao } from '@/lib/cookieSessao';
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
            if (!email || typeof senhaAtual !== 'string' || !senhaAtual) {
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
            // Mesma resposta (e mesmo tempo: o bcrypt roda mesmo sem conta) para email inexistente
            // e senha errada: distinguir os dois permitiria descobrir quais emails têm conta.
            if (!(await senhaConfere(senhaAtual, user))) {
                await registrarTentativa('login', email, ip);
                return NextResponse.json(
                    { message: 'Email ou senha atual incorretos.' },
                    { status: 401 }
                );
            }
        }

        // Quem troca a senha em Minha Conta está logado e volta para lá: lida antes de a versão
        // subir, a sessão dele ganha um cookie novo, e só as outras caem.
        const sessaoDeQuemTrocou = (await getUserIdFromToken()) === user._id.toString();

        const salt = await bcrypt.genSalt(10);
        user.senha = await bcrypt.hash(novaSenha, salt);
        // O link só serve uma vez.
        user.resetSenhaHash = null;
        user.resetSenhaExpira = null;
        // Todas as sessões abertas com a senha antiga deixam de valer (src/lib/auth.ts): quem
        // tinha pegado a sessão da pessoa perde o acesso assim que ela troca a senha.
        user.versaoSessao = (user.versaoSessao ?? 0) + 1;
        await user.save();
        await limparTentativas('login', normalizarEmail(user.email));

        const response = NextResponse.json(
            { message: 'Senha alterada. Agora é só entrar com a senha nova.' },
            { status: 200 }
        );
        return sessaoDeQuemTrocou ? gravarCookieSessao(response, user) : response;
    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json(
            { message: 'Não conseguimos falar com o servidor agora. Tente de novo em alguns instantes.' },
            { status: 500 }
        );
    }
}
