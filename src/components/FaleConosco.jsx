"use client";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import styles from "./FaleConosco.module.css";

// Botão fixo no canto inferior das telas públicas (login, cadastro, senha...), para quem tiver
// problema para entrar conseguir avisar a equipe. Na página inicial não aparece: ela já tem
// a seção "Fale conosco". O email já vai com a tela em que a pessoa estava.
const EMAIL_DO_PROJETO = "pex.ifsp@gmail.com";

const NOME_DA_TELA = {
  "/login": "Entrar",
  "/cadastro": "Criar conta",
  "/esqueci-senha": "Esqueci a senha",
  "/redefinir-senha": "Redefinir senha",
  "/privacidade": "Privacidade",
};

export default function FaleConosco() {
  const caminho = usePathname();
  if (caminho === "/") return null;

  const tela = NOME_DA_TELA[caminho] ?? caminho;
  const assunto = `CultivAI: problema na tela "${tela}"`;
  const corpo = `Olá, equipe do CultivAI.\n\nTela: ${tela} (${caminho})\n\nO que aconteceu:\n\n`;
  const href = `mailto:${EMAIL_DO_PROJETO}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

  return (
    <a href={href} className={styles.botao} title={`Escrever para ${EMAIL_DO_PROJETO}`}>
      <Mail size={18} aria-hidden="true" />
      <span>Fale conosco</span>
    </a>
  );
}
