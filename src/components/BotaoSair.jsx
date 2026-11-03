"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Botao from "@/components/ui/Botao";

// "Sair da conta": usado na barra lateral do computador e em Minha Conta (no celular, o botão
// saiu da navegação do rodapé, onde um toque sem querer tirava a pessoa do app).
// O cookie de sessão é httpOnly: só o servidor consegue apagá-lo (ver /api/auth/logout).
// As outras props vão para o Botao (variante, larguraTotal...).
export default function BotaoSair({ children = "Sair da conta", ...props }) {
  const router = useRouter();
  const sair = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };
  return (
    <Botao variante="perigoDiscreto" icone={LogOut} onClick={sair} {...props}>
      {children}
    </Botao>
  );
}
