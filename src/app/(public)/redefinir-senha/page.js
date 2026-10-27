"use client"
import { Suspense, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import Input from "@/components/Input"
import AvisoFormulario from "@/components/AvisoFormulario"
import { REGRA_SENHA, problemaNaSenha } from "@/lib/senha"
import styles from "../conta.module.css"

// Dois usos:
// - /redefinir-senha?codigo=...: veio do link do email "Esqueci a senha"; pede só a senha nova;
// - /redefinir-senha: quem lembra a senha e quer trocá-la (email + senha atual + senha nova).
function Formulario() {
  const router = useRouter()
  const codigo = useSearchParams().get("codigo")
  const [email, setEmail] = useState("")
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null) // { texto, campo, linkInvalido }
  const [pronto, setPronto] = useState(false)
  const emailRef = useRef(null)
  const senhaAtualRef = useRef(null)
  const novaSenhaRef = useRef(null)
  const confirmarRef = useRef(null)

  const alterar = (setter) => (e) => { setter(e.target.value); setErro(null) }
  const falhar = (texto, campo, extra = {}) => {
    setErro({ texto, campo, ...extra })
    const refs = { email: emailRef, senhaAtual: senhaAtualRef, novaSenha: novaSenhaRef, confirmar: confirmarRef }
    refs[campo]?.current?.focus()
  }

  async function salvar(e) {
    e.preventDefault()
    if (!codigo && !email.trim()) return falhar("Digite o seu email.", "email")
    if (!codigo && !senhaAtual) return falhar("Digite a sua senha atual.", "senhaAtual")
    const fraca = problemaNaSenha(novaSenha)
    if (fraca) return falhar(fraca, "novaSenha")
    if (novaSenha !== confirmar) return falhar("As senhas não conferem. Digite a mesma senha nos dois campos.", "confirmar")

    setLoading(true)
    setErro(null)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codigo ? { codigo, novaSenha } : { email, senhaAtual, novaSenha }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        falhar(data.message || "Não foi possível alterar a senha. Tente de novo.", data.campo || (res.status === 401 ? "senhaAtual" : undefined), { linkInvalido: data.linkInvalido })
        return
      }
      setPronto(true)
      setTimeout(() => router.push("/login"), 1800)
    } catch {
      falhar("Não foi possível conectar. Confira sua internet e tente de novo.")
    } finally {
      setLoading(false)
    }
  }

  const invalido = (campo) => erro?.campo === campo

  if (pronto) {
    return (
      <div role="status" className={styles.confirmacao}>
        <CheckCircle2 size={72} color="var(--primary)" strokeWidth={1.75} style={{ marginBottom: "1rem" }} aria-hidden="true" />
        <h1 className={styles.titulo}>Senha alterada!</h1>
        <p className={styles.subtitulo}>Levando você para o login...</p>
      </div>
    )
  }

  return (<>
    <div className={styles.cabecalho}>
      <h1 className={styles.titulo}>{codigo ? "Criar nova senha" : "Trocar senha"}</h1>
      <p className={styles.subtitulo}>
        {codigo ? "Escolha uma senha nova para a sua conta." : "Informe seu email e a senha atual para definir uma senha nova."}
      </p>
    </div>

    <form onSubmit={salvar} noValidate className={styles.formulario}>
      {!codigo && (<>
        <Input ref={emailRef} label="Email" type="email" value={email} onChange={alterar(setEmail)} placeholder="seuemail@exemplo.com"
          autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required invalido={invalido("email")} />
        <Input ref={senhaAtualRef} label="Senha atual" type="password" value={senhaAtual} onChange={alterar(setSenhaAtual)}
          autoComplete="current-password" required invalido={invalido("senhaAtual")} />
      </>)}
      <Input ref={novaSenhaRef} label="Senha nova" type="password" value={novaSenha} onChange={alterar(setNovaSenha)}
        autoComplete="new-password" required minLength={8} dica={REGRA_SENHA} invalido={invalido("novaSenha")} />
      <Input ref={confirmarRef} label="Confirmar senha nova" type="password" value={confirmar} onChange={alterar(setConfirmar)}
        autoComplete="new-password" required invalido={invalido("confirmar")} />

      {erro && (
        <AvisoFormulario>
          {erro.texto}
          {erro.linkInvalido && <> <Link href="/esqueci-senha" style={{ color: "inherit", fontWeight: 700 }}>Pedir novo link</Link></>}
        </AvisoFormulario>
      )}

      <button type="submit" disabled={loading} className={styles.botao}>
        {loading ? "Salvando..." : "Salvar senha nova"}
      </button>
    </form>

    <p className={styles.rodape}>
      {codigo ? <>Lembrou a senha? <Link href="/login">Entrar</Link></> : <>Esqueceu a senha atual? <Link href="/esqueci-senha">Receber link por email</Link></>}
    </p>
  </>)
}

// useSearchParams precisa de Suspense para a página poder ser gerada no servidor.
export default function RedefinirSenha() {
  return (
    <div className={styles.fundo}>
      <div className={styles.cartao}>
        <Suspense fallback={null}>
          <Formulario />
        </Suspense>
      </div>
    </div>
  )
}
