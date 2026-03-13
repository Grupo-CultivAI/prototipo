"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";
import Link from "next/link";

export default function Cadastro(){

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [senha,setSenha] = useState("")
  const [confirmarSenha,setConfirmarSenha] = useState("")

  function cadastrar(){

    if(!email || !senha || !confirmarSenha){
      alert("Preencha todos os campos")
      return
    }

    if(senha !== confirmarSenha){
      alert("As senhas não coincidem")
      return
    }

    const usuario = {
      email: email,
      senha: senha
    }

    localStorage.setItem(
      "usuario",
      JSON.stringify(usuario)
    )

    alert("Usuário cadastrado!")

    router.push("/login")

  }

  return(

    <Card>

      <h2>Cadastro</h2>

      <p className="small-text">
        Insira suas informações para cadastrar-se no sistema
      </p>

      <Input placeholder="Nome completo"/>

      <Input
        placeholder="E-mail"
        required
        onChange={(e)=>setEmail(e.target.value)}
      />

      <Input
        placeholder="Senha"
        type="password"
        required
        onChange={(e)=>setSenha(e.target.value)}
      />

      <Input
        placeholder="Confirmação da senha"
        type="password"
        required
        onChange={(e)=>setConfirmarSenha(e.target.value)}
      />

      <Button
        text="Cadastrar"
        onClick={cadastrar}
      />

      <p className="small-text">

        Já possui conta?{" "}

        <Link href="/login">
          <strong>Faça login!</strong>
        </Link>

      </p>

    </Card>

  )

}