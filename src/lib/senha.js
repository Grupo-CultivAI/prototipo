// Regra de senha usada no cadastro, na troca e na recuperação de senha (e mostrada na tela).
// Contas antigas com senha mais curta continuam entrando; a regra vale para senhas novas.
export const TAMANHO_MINIMO_SENHA = 8;
export const REGRA_SENHA = `Mínimo de ${TAMANHO_MINIMO_SENHA} caracteres.`;

export function problemaNaSenha(senha) {
  if (typeof senha !== "string" || senha.length < TAMANHO_MINIMO_SENHA) {
    return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  }
  return null;
}

export const normalizarEmail = (email) => String(email ?? "").trim().toLowerCase();
