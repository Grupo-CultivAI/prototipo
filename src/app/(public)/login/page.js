"use client"
import { useState, useEffect, useRef, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AvisoFormulario from "@/components/AvisoFormulario"
import { CHAVE_EMAIL_CADASTRADO, emailCadastrado } from "@/lib/cadastro"

const semInscricao = () => () => {}

export default function Login() {
  const router = useRouter()
  // Depois do cadastro, o email já vem preenchido e só falta a senha. No servidor não há
  // sessionStorage: a primeira renderização vem sem email e o navegador completa em seguida.
  const cadastrado = useSyncExternalStore(semInscricao, emailCadastrado, () => null)
  const [emailDigitado, setEmail] = useState(null)
  const email = emailDigitado ?? cadastrado ?? ""
  const vindoDoCadastro = Boolean(cadastrado) && emailDigitado === null
  const [senha, setSenha] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")
  const senhaRef = useRef(null)

  useEffect(() => {
    if (vindoDoCadastro) senhaRef.current?.focus()
  }, [vindoDoCadastro])

  const alterar = (setter) => (e) => { setter(e.target.value); setErro("") }

  async function entrar(e) {
    e.preventDefault()
    if (!email || !senha) {
      setErro("Preencha o email e a senha.")
      return
    }
    setLoading(true)
    setErro("")
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.message || "Não foi possível entrar. Tente de novo.");
        setLoading(false);
        return;
      }
      try { sessionStorage.removeItem(CHAVE_EMAIL_CADASTRADO) } catch { }
      localStorage.setItem("usuarioLogado", "true");
      router.push("/chatbot");
    } catch (err) {
      console.error(err);
      setErro("Não foi possível conectar. Confira sua internet e tente de novo.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 76px)', background: 'radial-gradient(circle at top, #e8f5ec 0%, var(--bg) 100%)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: 'var(--surface)', padding: '3rem', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>

          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(22, 163, 74, 0.1)', color: 'var(--primary)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              Acesso Restrito
            </div>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--primary-dark)', marginBottom: '0.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Bem-vindo de volta</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Acesse sua área exclusiva para produtores rurais.</p>
          </div>

          <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {vindoDoCadastro && !erro && <AvisoFormulario tipo="sucesso">Conta criada. Agora é só digitar sua senha para entrar.</AvisoFormulario>}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Email Corporativo</label>
              <input type="email" value={email} onChange={alterar(setEmail)} required placeholder="contato@fazenda.com"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Senha de Acesso</label>
                <Link href="/redefinir-senha" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Esqueceu?</Link>
              </div>
              <input type="password" value={senha} ref={senhaRef} onChange={alterar(setSenha)} required placeholder="••••••••"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            {erro && <AvisoFormulario>{erro}</AvisoFormulario>}

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '1.2rem', marginTop: '0.25rem', background: 'var(--primary-dark)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '1.05rem', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(6,64,43,0.15)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Acessando plataforma...' : 'Entrar na Plataforma'}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Novo por aqui? <Link href="/cadastro" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none' }}>Crie sua conta</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}