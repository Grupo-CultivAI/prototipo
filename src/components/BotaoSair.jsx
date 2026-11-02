"use client";
import { useRouter } from "next/navigation";

// "Sair da conta": usado na barra lateral do computador e em Minha Conta (no celular, o botão
// saiu da navegação do rodapé, onde um toque sem querer tirava a pessoa do app).
// O cookie de sessão é httpOnly: só o servidor consegue apagá-lo (ver /api/auth/logout).
export default function BotaoSair({ className, children }) {
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
    <button type="button" onClick={sair} className={className}>
      {children}
    </button>
  );
}
