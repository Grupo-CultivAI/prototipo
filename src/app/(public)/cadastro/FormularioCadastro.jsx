"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import Input from "@/components/Input"
import AvisoFormulario from "@/components/AvisoFormulario"
import { CHAVE_EMAIL_CADASTRADO } from "@/lib/cadastro"
import { REGRA_SENHA, problemaNaSenha } from "@/lib/senha"
import styles from "../conta.module.css"

export default function FormularioCadastro() {
  const router = useRouter()
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [aceitou, setAceitou] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null) // { texto, campo, emailJaCadastrado }
  const [criada, setCriada] = useState(false)
  const nomeRef = useRef(null)
  const emailRef = useRef(null)
  const senhaRef = useRef(null)
  const confirmarRef = useRef(null)
  const privacidadeRef = useRef(null)

  // Mexer num campo apaga a mensagem de erro antiga.
  const alterar = (setter) => (e) => { setter(e.target.value); setErro(null) }
  // Com erro, o foco vai para o campo a corrigir, e o leitor de tela lê a mensagem.
  const falhar = (texto, campo, extra = {}) => {
    setErro({ texto, campo, ...extra })
    const refs = { nome: nomeRef, email: emailRef, senha: senhaRef, confirmar: confirmarRef, privacidade: privacidadeRef }
    refs[campo]?.current?.focus()
  }

  async function cadastrar(e) {
    e.preventDefault()
    if (!nome.trim()) return falhar("Digite o seu nome.", "nome")
    if (!email.trim()) return falhar("Digite o seu email.", "email")
    const senhaFraca = problemaNaSenha(senha)
    if (senhaFraca) return falhar(senhaFraca, "senha")
    if (senha !== confirmarSenha) return falhar("As senhas não conferem. Digite a mesma senha nos dois campos.", "confirmar")
    if (!aceitou) return falhar("Para criar a conta, leia e aceite o aviso de privacidade.", "privacidade")

    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, aceitouPrivacidade: aceitou })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        falhar(data.message || "Não foi possível criar a conta. Tente de novo.", data.campo, { emailJaCadastrado: data.emailJaCadastrado });
        setLoading(false);
        return;
      }
      try { sessionStorage.setItem(CHAVE_EMAIL_CADASTRADO, email.trim().toLowerCase()) } catch { }
      setCriada(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      console.error(err);
      falhar("Não foi possível conectar. Confira sua internet e tente de novo.");
      setLoading(false);
    }
  }

  const invalido = (campo) => erro?.campo === campo

  return (
    <div className={styles.fundo}>
      <div className={styles.cartao} style={{ maxWidth: '500px' }}>
        {criada ? (
          <div role="status" className={styles.confirmacao}>
            <CheckCircle2 size={72} color="var(--primary)" strokeWidth={1.75} style={{ marginBottom: '1rem' }} aria-hidden="true" />
            <h1 className={styles.titulo}>Conta criada!</h1>
            <p className={styles.subtitulo}>Levando você para o login...</p>
          </div>
        ) : (<>
          <div className={styles.cabecalho}>
            <h1 className={styles.titulo}>Criar conta</h1>
            <p className={styles.subtitulo}>Preencha seus dados para receber recomendações de rotação de culturas para a sua área.</p>
          </div>

          <form onSubmit={cadastrar} noValidate className={styles.formulario}>
            <Input ref={nomeRef} label="Nome" value={nome} onChange={alterar(setNome)} placeholder="Ex.: João da Silva"
              autoComplete="name" autoCapitalize="words" required invalido={invalido("nome")} />

            <Input ref={emailRef} label="Email" type="email" value={email} onChange={alterar(setEmail)} placeholder="seuemail@exemplo.com"
              autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required invalido={invalido("email")} />

            <div className={styles.duasColunas}>
              <Input ref={senhaRef} label="Senha" type="password" value={senha} onChange={alterar(setSenha)}
                autoComplete="new-password" required minLength={8} dica={REGRA_SENHA} invalido={invalido("senha")} />
              <Input ref={confirmarRef} label="Confirmar senha" type="password" value={confirmarSenha} onChange={alterar(setConfirmarSenha)}
                autoComplete="new-password" required invalido={invalido("confirmar")} />
            </div>

            <label className={`${styles.aceite} ${invalido("privacidade") ? styles.aceiteInvalido : ""}`}>
              <input ref={privacidadeRef} type="checkbox" checked={aceitou} onChange={(e) => { setAceitou(e.target.checked); setErro(null) }}
                aria-invalid={invalido("privacidade") || undefined} />
              <span>
                Li e concordo com o <Link href="/privacidade" target="_blank">aviso de privacidade</Link>, que explica quais dados o CultivAI guarda e para quê.
              </span>
            </label>

            {erro && (
              <AvisoFormulario>
                {erro.texto}
                {erro.emailJaCadastrado && <> <Link href="/login" style={{ color: 'inherit', fontWeight: 700 }}>Entrar</Link></>}
              </AvisoFormulario>
            )}

            <button type="submit" disabled={loading} className={styles.botao}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className={styles.rodape}>
            Já tem conta? <Link href="/login">Entrar</Link>
          </p>
        </>)}
      </div>
    </div>
  )
}
