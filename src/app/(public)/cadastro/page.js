"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import AvisoFormulario from "@/components/AvisoFormulario"
import { CHAVE_EMAIL_CADASTRADO } from "@/lib/cadastro"

export default function Cadastro() {
  const router = useRouter()
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null) // { texto, emailJaCadastrado }
  const [criada, setCriada] = useState(false)

  // Mexer num campo apaga a mensagem de erro antiga.
  const alterar = (setter) => (e) => { setter(e.target.value); setErro(null) }

  async function cadastrar(e) {
    e.preventDefault()
    if (senha !== confirmarSenha) {
      setErro({ texto: "As senhas não conferem. Digite a mesma senha nos dois campos." })
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro({ texto: data.message || "Não foi possível criar a conta. Tente de novo.", emailJaCadastrado: data.emailJaCadastrado });
        setLoading(false);
        return;
      }
      try { sessionStorage.setItem(CHAVE_EMAIL_CADASTRADO, email.trim().toLowerCase()) } catch { }
      setCriada(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      console.error(err);
      setErro({ texto: "Não foi possível conectar. Confira sua internet e tente de novo." });
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 76px)', background: 'radial-gradient(circle at top, #e8f5ec 0%, var(--bg) 100%)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: 'var(--surface)', padding: '3rem', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>

          {criada ? (
            <div role="status" style={{ textAlign: 'center', padding: '2rem 0' }}>
              <CheckCircle2 size={72} color="var(--primary)" strokeWidth={1.75} style={{ marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '2rem', color: 'var(--primary-dark)', marginBottom: '0.5rem', fontWeight: '700' }}>Conta criada!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Levando você para o login...</p>
            </div>
          ) : (<>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2.2rem', color: 'var(--primary-dark)', marginBottom: '0.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Criar Conta</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Preencha seus dados para começar a gerenciar sua propriedade com IA.</p>
          </div>

          <form onSubmit={cadastrar} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Nome Completo</label>
              <input type="text" value={nome} onChange={alterar(setNome)} required placeholder="Ex: João da Silva"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Email</label>
              <input type="email" value={email} onChange={alterar(setEmail)} required placeholder="exemplo@email.com"
                style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Senha</label>
                <input type="password" value={senha} onChange={alterar(setSenha)} required placeholder="••••••••"
                  style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Confirmar</label>
                <input type="password" value={confirmarSenha} onChange={alterar(setConfirmarSenha)} required placeholder="••••••••"
                  style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              </div>
            </div>

            {erro && (
              <AvisoFormulario>
                {erro.texto}
                {erro.emailJaCadastrado && <> <Link href="/login" style={{ color: 'inherit', fontWeight: 700 }}>Entrar</Link></>}
              </AvisoFormulario>
            )}

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '1.2rem', marginTop: '0.25rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '1.05rem', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Cadastrando...' : 'Criar Conta'}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Já possui conta? <Link href="/login" style={{ color: 'var(--primary-dark)', fontWeight: '700', textDecoration: 'none' }}>Fazer login</Link>
            </p>
          </div>
          </>)}
        </div>
      </div>
    </div>
  )
}