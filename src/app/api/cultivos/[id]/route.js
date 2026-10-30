import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getUserIdFromToken } from '@/lib/auth';
import Propriedade from '@/models/Propriedade';
import Conversa from '@/models/Conversa';
import { perfilParcialSchema } from '@/lib/perfilSchema';
import { cultivoDoUsuario } from '@/lib/cultivos';

// Um cultivo de Meus Cultivos: ler (GET), alterar (PATCH) e apagar (DELETE). Só o dono acessa;
// para os outros, o cultivo "não existe" (404), sem revelar que o id é de alguém.

const naoEncontrado = () => NextResponse.json({ message: 'Cultivo não encontrado.' }, { status: 404 });

export async function GET(req, { params }) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        await dbConnect();
        const cultivo = await cultivoDoUsuario(userId, (await params).id);
        return cultivo ? NextResponse.json({ success: true, cultivo }) : naoEncontrado();
    } catch (err) {
        console.error('Erro ao ler cultivo:', err);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// Tudo opcional: o formulário do chat manda só o dado pedido (ex.: { tipoSolo }).
export async function PATCH(req, { params }) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const resultado = perfilParcialSchema.safeParse(await req.json().catch(() => null));
        if (!resultado.success) {
            const problema = resultado.error.issues[0];
            return NextResponse.json({ message: problema?.message || 'Dados inválidos.', campo: problema?.path?.[0] }, { status: 400 });
        }
        // O formulário do chat manda cidade e estado sem o código do IBGE: o código antigo
        // apontaria para a cidade anterior, então é limpo (o ZARC busca pelo nome).
        const dados = { ...resultado.data };
        if ((dados.cidade !== undefined || dados.estado !== undefined) && dados.codigoMunicipio === undefined) {
            dados.codigoMunicipio = '';
        }

        await dbConnect();
        const atual = await cultivoDoUsuario(userId, (await params).id);
        if (!atual) return naoEncontrado();
        const cultivo = await Propriedade.findOneAndUpdate({ _id: atual._id, userId }, { $set: dados }, { returnDocument: 'after' }).lean();
        return NextResponse.json({ success: true, cultivo });
    } catch (err) {
        console.error('Erro ao alterar cultivo:', err);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// As conversas sobre o cultivo continuam, sem ele (passam a ser conversas gerais).
export async function DELETE(req, { params }) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        await dbConnect();
        const cultivo = await cultivoDoUsuario(userId, (await params).id);
        if (!cultivo) return naoEncontrado();
        await Propriedade.deleteOne({ _id: cultivo._id, userId });
        await Conversa.updateMany({ userId, propriedadeId: cultivo._id }, { $set: { propriedadeId: null } });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Erro ao apagar cultivo:', err);
        return NextResponse.json({ message: 'Não conseguimos apagar o cultivo agora. Tente de novo em alguns instantes.' }, { status: 500 });
    }
}
