import { redirect } from "next/navigation"
import { usuarioLogado } from "@/lib/sessao"
import FormularioLogin from "./FormularioLogin"

export const metadata = { title: "Entrar | CultivAI" }

// Quem já entrou vai direto para o chat, sem ver o formulário.
export default async function Login() {
  if (await usuarioLogado()) redirect("/chatbot")
  return <FormularioLogin />
}
