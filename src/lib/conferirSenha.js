import bcrypt from 'bcryptjs';

// Só do servidor (src/lib/senha.js também vai para o navegador, e o bcrypt não deve ir junto).

// Hash bcrypt (custo 10, como as senhas) de uma senha aleatória que ninguém sabe. Quando o email
// não tem conta, a comparação é feita com ele: sem isso, a resposta para email inexistente vinha
// mais rápida (o bcrypt não rodava), e medir o tempo revelava quem tem conta, apesar da mensagem
// igual (revisão de engenharia, 03/11/2026).
const HASH_FALSO = '$2b$10$WB4F1jHJlRtjYtGMks34QuXbtWqJ36a/M/9Jf3LM8/R7/dLNfEDR.';

// Confere a senha da conta, sempre rodando o bcrypt uma vez. Senha que não é texto (número,
// objeto) não confere, em vez de derrubar a rota com erro 500.
export async function senhaConfere(senha, user) {
    if (typeof senha !== 'string' || !senha) return false;
    const confere = await bcrypt.compare(senha, user?.senha || HASH_FALSO);
    return Boolean(user) && confere;
}
