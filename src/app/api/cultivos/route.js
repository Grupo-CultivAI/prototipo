import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getUserIdFromToken } from '@/lib/auth';
import Propriedade from '@/models/Propriedade';
import { perfilParcialSchema } from '@/lib/perfilSchema';
import { LIMITE_DE_CULTIVOS, cultivosDoUsuario } from '@/lib/cultivos';

// Meus Cultivos: a lista (GET) e um cultivo novo (POST). Um cultivo por id em ./[id].

export async function GET() {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        await dbConnect();
        return NextResponse.json({ success: true, cultivos: await cultivosDoUsuario(userId) });
    } catch (err) {
        console.error('Erro ao listar cultivos:', err);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// Só os campos do perfil, com tamanho e valores conferidos: o perfil entra no prompt da IA.
// O formulário do chat também cria um cultivo (com o nome que der) quando a pessoa ainda não tem.
export async function POST(req) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const resultado = perfilParcialSchema.safeParse(await req.json().catch(() => null));
        if (!resultado.success) {
            const problema = resultado.error.issues[0];
            return NextResponse.json({ message: problema?.message || 'Dados inválidos.', campo: problema?.path?.[0] }, { status: 400 });
        }

        await dbConnect();
        if (await Propriedade.countDocuments({ userId }) >= LIMITE_DE_CULTIVOS) {
            return NextResponse.json({ message: `Você já tem ${LIMITE_DE_CULTIVOS} cultivos cadastrados. Apague um para cadastrar outro.` }, { status: 400 });
        }
        const cultivo = await Propriedade.create({ ...resultado.data, userId });
        return NextResponse.json({ success: true, cultivo }, { status: 201 });
    } catch (err) {
        // Banco de produção ainda com o índice antigo (um perfil por conta): ver scripts/migrar-cultivos.mjs
        if (err?.code === 11000) {
            console.error('Índice único antigo em propriedades.userId: rode scripts/migrar-cultivos.mjs');
            return NextResponse.json({ message: 'Ainda não é possível cadastrar mais de um cultivo. Avise a equipe pelo Fale conosco.' }, { status: 409 });
        }
        console.error('Erro ao criar cultivo:', err);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
