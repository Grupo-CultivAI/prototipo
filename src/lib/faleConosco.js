// Link "Fale conosco" (email do projeto), usado no botão flutuante das telas públicas
// (components/FaleConosco.jsx) e na navegação das telas internas (components/Sidebar.jsx).
// O email já vai com a tela em que a pessoa estava; no chat, orienta a colar a resposta.
export const EMAIL_DO_PROJETO = "pex.ifsp@gmail.com";

const NOME_DA_TELA = {
  "/": "Página inicial",
  "/login": "Entrar",
  "/cadastro": "Criar conta",
  "/esqueci-senha": "Esqueci a senha",
  "/redefinir-senha": "Redefinir senha",
  "/privacidade": "Privacidade",
  "/chatbot": "Assistente (chat)",
  "/perfil-propriedade": "Meu Cultivo",
  "/conta": "Minha Conta",
};

const DICA_DA_TELA = {
  "/chatbot": "Se for sobre uma resposta do chat, use o botão de copiar (ao lado do 👍/👎) e cole a resposta aqui.\n\n",
};

export function linkFaleConosco(caminho) {
  const tela = NOME_DA_TELA[caminho] ?? caminho;
  const assunto = `CultivAI: contato pela tela "${tela}"`;
  const corpo = `Olá, equipe do CultivAI.\n\nTela: ${tela} (${caminho})\n\n${DICA_DA_TELA[caminho] ?? ""}O que aconteceu:\n\n`;
  return `mailto:${EMAIL_DO_PROJETO}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
