import { getUserIdFromToken } from '@/lib/auth';

// Para as telas de login e cadastro mandarem direto ao Painel quem já entrou. A leitura da
// sessão confere se a conta ainda existe e se a sessão não caiu com uma troca de senha: um
// cookie válido de uma conta apagada (ou do banco antigo) levaria ao Painel, o Painel mandaria
// de volta ao login, e a pessoa ficaria presa nesse vaivém.
export async function usuarioLogado(): Promise<boolean> {
    try {
        return Boolean(await getUserIdFromToken());
    } catch {
        return false; // sem banco, a tela de login aparece e mostra o erro ao tentar entrar
    }
}
