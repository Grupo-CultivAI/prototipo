"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [loading, setLoading] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    if (!email || !senha) {
      alert("Preencha todos os campos")
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Email ou senha incorretos");
        setLoading(false);
        return;
      }
      localStorage.setItem("usuarioLogado", "true");
      router.push("/chatbot");
    } catch (err) {
      console.error(err);
      alert("Erro de conexão");
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
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Email Corporativo</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="contato@fazenda.com"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Senha de Acesso</label>
                <Link href="/redefinir-senha" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Esqueceu?</Link>
              </div>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required placeholder="••••••••"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '1.2rem', marginTop: '1rem', background: 'var(--primary-dark)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '1.05rem', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(6,64,43,0.15)', opacity: loading ? 0.7 : 1 }}>
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