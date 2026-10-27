import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Propriedade from '@/models/Propriedade';
import ChatMessage from '@/models/ChatMessage';
import Conversa from '@/models/Conversa';
import TentativaAcesso from '@/models/TentativaAcesso';
import { getUserIdFromToken } from '@/lib/auth';
import { apagarCookieSessao } from '@/lib/cookieSessao';
import { normalizarEmail } from '@/lib/senha';
import { excedeuLimite, registrarTentativa, ipDe, MINUTOS_DE_ESPERA } from '@/lib/tentativas';

export async function GET() {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        // Nunca devolver ao navegador a senha nem o código de recuperação, mesmo em hash.
        const user = await User.findById(userId).select('-senha -resetSenhaHash -resetSenhaExpira');

        if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });
        return NextResponse.json({ user });
    } catch (error) {
        console.error('API User Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// "Excluir minha conta" (Minha Conta). Pede a senha: num computador deixado aberto, outra
// pessoa não consegue excluir a conta. Apaga tudo o que é da pessoa e encerra a sessão.
export async function DELETE(req) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        const user = await User.findById(userId);
        if (!user) return apagarCookieSessao(NextResponse.json({ success: true }));

        const { senha } = await req.json().catch(() => ({}));
        const email = normalizarEmail(user.email);
        const ip = ipDe(req);
        // Confirmar com a senha também é testar uma senha: entra no mesmo limite do login.
        if (await excedeuLimite('login', email, ip)) {
            return NextResponse.json(
                { message: `Muitas tentativas seguidas. Aguarde ${MINUTOS_DE_ESPERA} minutos.` },
                { status: 429 }
            );
        }
        if (!senha || !(await bcrypt.compare(senha, user.senha))) {
            await registrarTentativa('login', email, ip);
            return NextResponse.json({ message: 'Senha incorreta.', campo: 'senha' }, { status: 401 });
        }

        await Promise.all([
            ChatMessage.deleteMany({ userId }),
            Conversa.deleteMany({ userId }),
            Propriedade.deleteMany({ userId }),
            TentativaAcesso.deleteMany({ chave: `email:${email}` }),
        ]);
        await User.deleteOne({ _id: userId });

        return apagarCookieSessao(NextResponse.json({ success: true }));
    } catch (error) {
        console.error('Excluir conta Error:', error);
        return NextResponse.json(
            { message: 'Não conseguimos excluir a conta agora. Tente de novo em alguns instantes.' },
            { status: 500 }
        );
    }
}
