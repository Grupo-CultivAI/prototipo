import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getUserIdFromToken } from '@/lib/auth';

// Para as telas de login e cadastro mandarem direto ao chat quem já entrou. Confere se a
// conta ainda existe: um cookie válido de uma conta apagada (ou do banco antigo) levaria ao
// chat, o chat mandaria de volta ao login, e a pessoa ficaria presa nesse vaivém.
export async function usuarioLogado(): Promise<boolean> {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return false;
        await dbConnect();
        return Boolean(await User.exists({ _id: userId }));
    } catch {
        return false; // sem banco, a tela de login aparece e mostra o erro ao tentar entrar
    }
}
