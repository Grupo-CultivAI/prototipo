"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function Cadastro() {
  const router = useRouter()
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [loading, setLoading] = useState(false)

  async function cadastrar(e) {
    e.preventDefault()
    if (senha !== confirmarSenha) {
      alert("As senhas não coincidem")
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Erro ao cadastrar");
        setLoading(false);
        return;
      }
      alert("Usuário cadastrado com sucesso!");
      router.push("/login");
    } catch (err) {
      console.error(err);
      alert("Erro de conexão");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 76px)', background: 'radial-gradient(circle at top, #e8f5ec 0%, var(--bg) 100%)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: 'var(--surface)', padding: '3rem', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>

          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--primary-dark)', marginBottom: '0.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Criar Conta</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Preencha seus dados para começar a gerenciar sua propriedade com IA.</p>
          </div>

          <form onSubmit={cadastrar} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Nome Completo</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex: João da Silva"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="exemplo@email.com"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Senha</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required placeholder="••••••••"
                  style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Confirmar</label>
                <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required placeholder="••••••••"
                  style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '1.2rem', marginTop: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '1.05rem', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Cadastrando...' : 'Criar Conta'}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Já possui conta? <Link href="/login" style={{ color: 'var(--primary-dark)', fontWeight: '700', textDecoration: 'none' }}>Fazer login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}