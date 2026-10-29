import { redirect } from "next/navigation"
import { usuarioLogado } from "@/lib/sessao"
import FormularioLogin from "./FormularioLogin"

export const metadata = { title: "Entrar | CultivAI" }

// Quem já entrou vai direto para o chat, sem ver o formulário.
// ?conta=excluida: veio da exclusão de conta (Minha Conta).
export default async function Login({ searchParams }) {
  if (await usuarioLogado()) redirect("/painel")
  const { conta } = await searchParams
  return <FormularioLogin contaExcluida={conta === "excluida"} />
}
