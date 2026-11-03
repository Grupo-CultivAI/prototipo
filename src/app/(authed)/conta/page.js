"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, KeyRound } from 'lucide-react';
import { Entrada } from '@/components/ui/Campo';
import BotaoSair from '@/components/BotaoSair';
import Botao from '@/components/ui/Botao';
import Aviso from '@/components/ui/Aviso';
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

            <div className={styles.cartaoConta} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem', borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
                    <div style={{ width: '80px', height: '80px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'var(--white)', fontWeight: 'bold', boxShadow: 'var(--shadow-primary-sm)' }}>
                        {user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{user.nome}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            Conta criada em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                </div>

                {/* Texto, e não caixas: pareciam campos editáveis, mas não respondiam ao toque.
                    O "ID de Registro Único" saiu: era um dado técnico, sem uso para o produtor. */}
                <dl className={styles.grade2} style={{ gap: '1.5rem 2.5rem', margin: 0 }}>
                    <div>
                        <dt style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>Nome</dt>
                        <dd style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{user.nome}</dd>
                    </div>
                    <div>
                        <dt style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>Email de cadastro</dt>
                        <dd style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{user.email}</dd>
                    </div>
                </dl>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                    <Botao href={`/redefinir-senha?email=${encodeURIComponent(user.email)}&voltar=/conta`} variante="secundario" icone={KeyRound}>
                        Trocar senha
                    </Botao>
                    {/* No celular, este é o lugar do "Sair" (saiu da navegação do rodapé) */}
                    <BotaoSair />
                </div>
            </div>

            {/* Exclusão da conta: direito previsto na LGPD, sem precisar pedir à equipe. */}
            <section className={styles.cartaoConta} style={{ marginTop: '2rem', background: 'var(--surface)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--erro-borda)' }}>
                <h2 style={{ fontSize: '1.2rem', color: 'var(--erro)', marginBottom: '0.5rem' }}>Excluir minha conta</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    Apaga a sua conta e tudo o que está guardado nela: os seus cultivos, as conversas e as avaliações. Não dá para desfazer.
                </p>
                {!excluindo ? (
                    <Botao variante="perigoDiscreto" icone={Trash2} onClick={() => setExcluindo(true)}>Excluir minha conta</Botao>
                ) : (
                    <form onSubmit={excluirConta} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '420px' }}>
                        <Entrada ref={senhaRef} rotulo="Para confirmar, digite a sua senha" type="password" value={senha}
                            onChange={(e) => { setSenha(e.target.value); setErro(''); }} autoComplete="current-password" invalido={Boolean(erro)} />
                        {erro && <Aviso tipo="erro">{erro}</Aviso>}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <Botao type="submit" variante="perigo" carregando={aguardando} textoCarregando="Excluindo...">Excluir definitivamente</Botao>
                            <Botao variante="neutro" onClick={() => { setExcluindo(false); setSenha(''); setErro(''); }}>Cancelar</Botao>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
