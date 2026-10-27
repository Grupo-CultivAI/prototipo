// Gravada pelo cadastro e lida pelo login, para o email já vir preenchido.
// sessionStorage: some sozinha ao fechar a aba.
export const CHAVE_EMAIL_CADASTRADO = "cultivai:emailCadastrado";

export function emailCadastrado() {
  try {
    return sessionStorage.getItem(CHAVE_EMAIL_CADASTRADO);
  } catch {
    return null;
  }
}
