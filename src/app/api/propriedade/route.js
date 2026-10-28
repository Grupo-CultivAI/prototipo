import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import Propriedade from '@/models/Propriedade';
import { perfilParcialSchema } from '@/lib/perfilSchema';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function getUserIdFromToken() {
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload.id;
    } catch (error) {
        return null;
    }
}

export async function GET(req) {
    try {
        await dbConnect();
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const prop = await Propriedade.findOne({ userId });
        return NextResponse.json({ success: true, propriedade: prop || null });
    } catch (err) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await dbConnect();
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        // Só os campos do perfil, com tamanho e valores conferidos: o perfil entra no prompt da
        // IA, e antes a rota gravava qualquer coisa que o navegador mandasse.
        const resultado = perfilParcialSchema.safeParse(await req.json().catch(() => null));
        if (!resultado.success) {
            const problema = resultado.error.issues[0];
            return NextResponse.json(
                { message: problema?.message || 'Dados inválidos.', campo: problema?.path?.[0] },
                { status: 400 }
            );
        }
        // O formulário do chat manda cidade e estado sem o código do IBGE: o código antigo
        // apontaria para a cidade anterior, então é limpo (o ZARC busca pelo nome).
        const dados = { ...resultado.data };
        if ((dados.cidade !== undefined || dados.estado !== undefined) && dados.codigoMunicipio === undefined) {
            dados.codigoMunicipio = '';
        }
        const prop = await Propriedade.findOneAndUpdate(
            { userId },
            { $set: { ...dados, userId } },
            { new: true, upsert: true }
        );
        return NextResponse.json({ success: true, propriedade: prop });
    } catch (err) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// "Apagar dados da propriedade" no Meu Cultivo: some o perfil, a conta continua.
export async function DELETE() {
    try {
        await dbConnect();
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await Propriedade.deleteOne({ userId });
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ message: 'Não conseguimos apagar os dados agora. Tente de novo em alguns instantes.' }, { status: 500 });
    }
}
