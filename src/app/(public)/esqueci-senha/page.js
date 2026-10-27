"use client"
import { useState, useRef } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import Input from "@/components/Input"
import AvisoFormulario from "@/components/AvisoFormulario"
import styles from "../conta.module.css"

// Primeiro passo da recuperação: a pessoa informa o email e recebe um link para criar uma
// senha nova (ver /api/auth/esqueci-senha e /redefinir-senha?codigo=...).
export default function EsqueciSenha() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")
  const [enviado, setEnviado] = useState("")
  const emailRef = useRef(null)

  async function pedirLink(e) {
    e.preventDefault()
    if (!email.trim()) {
      setErro("Digite o email da sua conta.")
      emailRef.current?.focus()
      return
    }
    setLoading(true)
    setErro("")
    try {
      const res = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(data.message || "Não foi possível enviar o email. Tente de novo.")
        return
      }
      setEnviado(data.message)
    } catch {
      setErro("Não foi possível conectar. Confira sua internet e tente de novo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.fundo}>
      <div className={styles.cartao}>
        {enviado ? (
          <div role="status" className={styles.confirmacao}>
            <MailCheck size={64} color="var(--primary)" strokeWidth={1.75} style={{ marginBottom: "1rem" }} aria-hidden="true" />
            <h1 className={styles.titulo}>Confira seu email</h1>
            <p className={styles.subtitulo}>{enviado}</p>
            <p className={styles.rodape}><Link href="/login">Voltar para o login</Link></p>
          </div>
        ) : (<>
          <div className={styles.cabecalho}>
            <h1 className={styles.titulo}>Esqueci a senha</h1>
            <p className={styles.subtitulo}>Digite o email da sua conta. Vamos mandar um link para você criar uma senha nova.</p>
          </div>

          <form onSubmit={pedirLink} noValidate className={styles.formulario}>
            <Input ref={emailRef} label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro("") }}
              placeholder="seuemail@exemplo.com" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off"
              spellCheck={false} required invalido={Boolean(erro)} />

            {erro && <AvisoFormulario>{erro}</AvisoFormulario>}

            <button type="submit" disabled={loading} className={styles.botao}>
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </form>

          <p className={styles.rodape}>
            Lembrou a senha? <Link href="/login">Entrar</Link>
            <br />
            Quer só trocar a senha? <Link href="/redefinir-senha">Trocar senha</Link>
          </p>
        </>)}
      </div>
    </div>
  )
}
