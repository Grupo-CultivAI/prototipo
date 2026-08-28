"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";
import Link from "next/link";

export default function RedefinirSenha(){

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [novaSenha,setNovaSenha] = useState("")
  const [confirmarSenha,setConfirmarSenha] = useState("")
  const [carregando,setCarregando] = useState(false)

  async function redefinirSenha(){

     if(!email || !novaSenha || !confirmarSenha){
       alert("Preencha todos os campos")
       return
    }

    if(novaSenha !== confirmarSenha){
      alert("As senhas não coincidem")
      return
    }

    setCarregando(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, novaSenha }),
      })

      const data = await response.json()

      if(!response.ok){
        alert(data.message || "Não foi possível redefinir a senha")
        return
      }

      alert("Senha redefinida com sucesso!")

      router.push("/login")
    } catch (error) {
      alert("Erro ao redefinir senha. Tente novamente.")
    } finally {
      setCarregando(false)
    }

  }

  return(

    <Card>

      <h2>Redefinir Senha</h2>

      <p className="small-text">
        Insira suas credenciais para redefinir a senha no sistema
      </p>

      <p>Email</p>
      <Input
        placeholder="exemplo@email.com"
        required
        onChange={(e)=>setEmail(e.target.value)}
      />

      <p>Nova Senha</p>
      <Input
        placeholder="********"
        type="password"
        required
        onChange={(e)=>setNovaSenha(e.target.value)}
      />

      <p>Confirmar Nova Senha</p>
      <Input
        placeholder="********"
        type="password"
        required
        onChange={(e)=>setConfirmarSenha(e.target.value)}
      />

      <Button
        text={carregando ? "Salvando..." : "Salvar"}
        onClick={redefinirSenha}
        disabled={carregando}
      />

      <p className="small-text">

        Não tem uma conta?{" "}

        <Link href="/cadastro">
          <strong>Crie uma!</strong>
        </Link>

      </p>

    </Card>

  )

}