import { redirect } from "next/navigation"
import { usuarioLogado } from "@/lib/sessao"
import FormularioCadastro from "./FormularioCadastro"

export const metadata = { title: "Criar conta | CultivAI" }

// Quem já entrou vai direto para o chat, sem ver o formulário.
export default async function Cadastro() {
  if (await usuarioLogado()) redirect("/painel")
  return <FormularioCadastro />
}
