"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Input from '@/components/Input';
import AvisoFormulario from '@/components/AvisoFormulario';
import styles from '../paginas.module.css';

export default function Conta() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [excluindo, setExcluindo] = useState(false); // painel de confirmação aberto
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState('');
    const [aguardando, setAguardando] = useState(false);
    const senhaRef = useRef(null);

    useEffect(() => {
        async function loadUser() {
            try {
                const res = await fetch('/api/user');
                // Conta inexistente (excluída, ou de antes da troca do banco): antes a tela
                // ficava parada em "Lendo dados da conta...".
                if (res.status === 401 || res.status === 404) { router.replace('/login'); return; }
                if (!res.ok) return;
                const data = await res.json();
                if (data.user) setUser(data.user);
            } catch (err) { }
        }
        loadUser();
    }, [router]);

    useEffect(() => {
        if (excluindo) senhaRef.current?.focus();
    }, [excluindo]);

    async function excluirConta(e) {
        e.preventDefault();
        if (!senha) { setErro('Digite a sua senha para confirmar.'); senhaRef.current?.focus(); return; }
        setAguardando(true);
        setErro('');
        try {
            const res = await fetch('/api/user', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senha }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErro(data.message || 'Não foi possível excluir a conta. Tente de novo.');
                senhaRef.current?.focus();
                return;
            }
            router.replace('/login?conta=excluida');
            router.refresh();
        } catch {
            setErro('Não foi possível conectar. Confira sua internet e tente de novo.');
        } finally {
            setAguardando(false);
        }
    }

    if (!user) return (
        <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Lendo dados da conta...
        </div>
    );

    return (
        <div style={{ padding: '0 1rem', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
            <h1 className={styles.tituloPagina} style={{ marginBottom: '0.8rem', fontWeight: '800', color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>Minha Conta</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3.5rem', fontSize: '1.1rem', maxWidth: '600px', lineHeight: '1.6' }}>
                Os dados da sua conta no CultivAI.
            </p>

            <div className={styles.cartaoConta} style={{ background: 'var(--surface)', borderRadius: '24px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem', borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
                    <div style={{ width: '80px', height: '80px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white', fontWeight: 'bold', boxShadow: '0 8px 16px rgba(22,163,74,0.2)' }}>
                        {user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{user.nome}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            Conta criada em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                </div>

                <div className={styles.grade2} style={{ gap: '2.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Nome Completo</label>
                        <div style={{ fontSize: '1.15rem', fontWeight: '500', color: 'var(--text-primary)', padding: '1.25rem', background: '#FDFDFD', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                            {user.nome}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>E-mail de Cadastro</label>
                        <div style={{ fontSize: '1.15rem', fontWeight: '500', color: 'var(--text-primary)', padding: '1.25rem', background: '#FDFDFD', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                            {user.email}
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '3rem', paddingTop: '2.5rem', borderTop: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                        ID de Registro Único: <span style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '4px 8px', borderRadius: '4px' }}>{user._id}</span>
                    </p>
                </div>
            </div>

            {/* Exclusão da conta: direito previsto na LGPD, sem precisar pedir à equipe. */}
            <section className={styles.cartaoConta} style={{ marginTop: '2rem', background: 'var(--surface)', borderRadius: '24px', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
                <h2 style={{ fontSize: '1.2rem', color: '#B91C1C', marginBottom: '0.5rem' }}>Excluir minha conta</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    Apaga a sua conta e tudo o que está guardado nela: os dados do Meu Cultivo, as conversas e as avaliações. Não dá para desfazer.
                </p>
                {!excluindo ? (
                    <button type="button" onClick={() => setExcluindo(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.25rem', borderRadius: '10px', border: '1px solid #DC2626', background: 'transparent', color: '#B91C1C', fontWeight: 600, cursor: 'pointer' }}>
                        <Trash2 size={18} aria-hidden="true" /> Excluir minha conta
                    </button>
                ) : (
                    <form onSubmit={excluirConta} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '420px' }}>
                        <Input ref={senhaRef} label="Para confirmar, digite a sua senha" type="password" value={senha}
                            onChange={(e) => { setSenha(e.target.value); setErro(''); }} autoComplete="current-password" invalido={Boolean(erro)} />
                        {erro && <AvisoFormulario>{erro}</AvisoFormulario>}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button type="submit" disabled={aguardando}
                                style={{ padding: '0.85rem 1.25rem', borderRadius: '10px', border: 'none', background: '#DC2626', color: 'white', fontWeight: 600, cursor: aguardando ? 'wait' : 'pointer', opacity: aguardando ? 0.7 : 1 }}>
                                {aguardando ? 'Excluindo...' : 'Excluir definitivamente'}
                            </button>
                            <button type="button" onClick={() => { setExcluindo(false); setSenha(''); setErro(''); }}
                                style={{ padding: '0.85rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
