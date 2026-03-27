"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";
import Link from "next/link";

export default function Login(){

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [senha,setSenha] = useState("")

  // Verifica se já existe usuário logado
  useEffect(() => {

    const usuarioLogado = localStorage.getItem("usuarioLogado")

    if(usuarioLogado){
      const dados = localStorage.getItem("cultivAI_user_input")

      if(dados){
        router.push("/chatbot")
      } else {
       router.push("/perfil-propriedade")
      }
    }

  }, [])

  function entrar(){

    if(!email || !senha){
      alert("Preencha todos os campos")
      return
    }

    const usuarioSalvo = JSON.parse(
      localStorage.getItem("usuario")
    )

    if(!usuarioSalvo){
      alert("Nenhum usuário cadastrado.")
      return
    }

    if(
      usuarioSalvo.email === email &&
      usuarioSalvo.senha === senha
    ){

      localStorage.setItem("usuarioLogado", "true")

      const dados = localStorage.getItem("cultivAI_user_input")

      if(dados){
        router.push("/chatbot")
      } else {
       router.push("/perfil-propriedade")
      }

    }
    else{
      alert("Email ou senha incorretos")
    }

  }

  return(

    <Card>

      <h2 className="title">Login</h2>

      <p className="small-text">
        Insira suas credenciais para entrar no sistema
      </p>

      <p>Email</p>
      <Input
        placeholder="exemplo@email.com"
        required
        onChange={(e)=>setEmail(e.target.value)}
      />

      <div style={{display:"flex", justifyContent:"space-between"}}>
        <p>Senha</p>

        <Link href="/redefinir-senha">
          <span className="small-text">Esqueci a senha</span>
        </Link>
      </div>

      <Input
        placeholder="********"
        type="password"
        required
        onChange={(e)=>setSenha(e.target.value)}
      />

      <Button
        text="Login"
        onClick={entrar}
      />

      <Button
        text="Login com o Google"
        style={{
          background:"white",
          color:"#424242",
          border:"1px solid #424242"
        }}
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