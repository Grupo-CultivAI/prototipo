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

  function redefinirSenha(){

     if(!email || !novaSenha || !confirmarSenha){
       alert("Preencha todos os campos")
       return
    }

    if(novaSenha !== confirmarSenha){
      alert("As senhas não coincidem")
      return
    }

    const usuarioSalvo = JSON.parse(
      localStorage.getItem("usuario")
    )

    if(!usuarioSalvo){
      alert("Nenhum usuário cadastrado")
      return
    }

    if(usuarioSalvo.email !== email){
      alert("Email não encontrado")
      return
    }

    if(novaSenha !== confirmarSenha){
      alert("As senhas não coincidem")
      return
    }

    usuarioSalvo.senha = novaSenha

    localStorage.setItem(
      "usuario",
      JSON.stringify(usuarioSalvo)
    )

    alert("Senha redefinida com sucesso!")

    router.push("/login")

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
        text="Salvar"
        onClick={redefinirSenha}
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