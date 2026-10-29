"use client";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { EMAIL_DO_PROJETO, linkFaleConosco } from "@/lib/faleConosco";
import styles from "./FaleConosco.module.css";

// Botão fixo no canto inferior das telas públicas (página inicial, login, cadastro, senha...),
// para quem tiver problema conseguir avisar a equipe. Nas telas internas o mesmo link fica na
// navegação (Sidebar), porque aqui embaixo ele cobriria o campo e o botão Enviar do chat.
export default function FaleConosco() {
  const caminho = usePathname();
  return (
    <a href={linkFaleConosco(caminho)} className={styles.botao} title={`Escrever para ${EMAIL_DO_PROJETO}`}>
      <Mail size={18} aria-hidden="true" />
      <span>Fale conosco</span>
    </a>
  );
}
