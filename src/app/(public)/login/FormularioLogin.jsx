"use client"
import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Input from "@/components/Input"
import AvisoFormulario from "@/components/AvisoFormulario"
import { CHAVE_EMAIL_CADASTRADO, emailCadastrado } from "@/lib/cadastro"
import styles from "../conta.module.css"

const semInscricao = () => () => {}

export default function FormularioLogin({ contaExcluida = false }) {
  const router = useRouter()
  // Depois do cadastro, o email já vem preenchido e só falta a senha. No servidor não há
  // sessionStorage: a primeira renderização vem sem email e o navegador completa em seguida.
  const cadastrado = useSyncExternalStore(semInscricao, emailCadastrado, () => null)
  const [emailDigitado, setEmail] = useState(null)
  const email = emailDigitado ?? cadastrado ?? ""
  const vindoDoCadastro = Boolean(cadastrado) && emailDigitado === null
  const [senha, setSenha] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null) // { texto, campos: ["email", "senha"] }
  const emailRef = useRef(null)
  const senhaRef = useRef(null)

  useEffect(() => {
    if (vindoDoCadastro) senhaRef.current?.focus()
  }, [vindoDoCadastro])

  const alterar = (setter) => (e) => { setter(e.target.value); setErro(null) }
  // Com erro, o foco vai para o campo a corrigir, e o leitor de tela lê a mensagem.
  const falhar = (texto, campos = []) => {
    setErro({ texto, campos })
    const alvo = campos.includes("email") && !email ? emailRef : campos.length ? senhaRef : null
    alvo?.current?.focus()
  }

  async function entrar(e) {
    e.preventDefault()
    if (!email || !senha) {
      falhar("Preencha o email e a senha.", [!email && "email", !senha && "senha"].filter(Boolean))
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        falhar(data.message || "Não foi possível entrar. Tente de novo.", res.status === 401 ? ["email", "senha"] : []);
        setLoading(false);
        return;
      }
      try { sessionStorage.removeItem(CHAVE_EMAIL_CADASTRADO) } catch { }
      router.replace("/painel");
    } catch (err) {
      console.error(err);
      falhar("Não foi possível conectar. Confira sua internet e tente de novo.");
      setLoading(false);
    }
  }

  const invalido = (campo) => Boolean(erro?.campos?.includes(campo))

  return (
    <div className={styles.fundo}>
      <div className={styles.cartao}>
        <div className={styles.cabecalho}>
          <h1 className={styles.titulo}>Bem-vindo de volta</h1>
          <p className={styles.subtitulo}>Entre para conversar com o CultivAI sobre a sua lavoura.</p>
        </div>

        <form onSubmit={entrar} noValidate className={styles.formulario}>
          {vindoDoCadastro && !erro && <AvisoFormulario tipo="sucesso">Conta criada. Agora é só digitar sua senha para entrar.</AvisoFormulario>}
          {contaExcluida && !vindoDoCadastro && !erro && <AvisoFormulario tipo="sucesso">Sua conta e todos os seus dados foram excluídos.</AvisoFormulario>}

          <Input
            ref={emailRef}
            label="Email"
            type="email"
            value={email}
            onChange={alterar(setEmail)}
            placeholder="seuemail@exemplo.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            invalido={invalido("email")}
          />

          <Input
            ref={senhaRef}
            label="Senha"
            type="password"
            value={senha}
            onChange={alterar(setSenha)}
            autoComplete="current-password"
            required
            invalido={invalido("senha")}
            acessorio={<Link href="/esqueci-senha" className={styles.linkPequeno}>Esqueci a senha</Link>}
          />

          {erro && <AvisoFormulario>{erro.texto}</AvisoFormulario>}

          <button type="submit" disabled={loading} className={styles.botao} style={{ background: 'var(--primary-dark)' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className={styles.rodape}>
          Ainda não tem conta? <Link href="/cadastro">Crie sua conta</Link>
        </p>
      </div>
    </div>
  )
}
