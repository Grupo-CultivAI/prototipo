"use client";
import { useState, useEffect } from 'react';

export default function Conta() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        async function loadUser() {
            try {
                const res = await fetch('/api/user');
                if (!res.ok) return;
                const data = await res.json();
                if (data.user) setUser(data.user);
            } catch (err) { }
        }
        loadUser();
    }, []);

    if (!user) return (
        <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Lendo dados da conta...
        </div>
    );

    return (
        <div style={{ padding: '0 1rem', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2.6rem', marginBottom: '0.8rem', fontWeight: '800', color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>Minha Conta</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3.5rem', fontSize: '1.1rem', maxWidth: '600px', lineHeight: '1.6' }}>
                Detalhes de segurança e identificação da sua conta Premium no CultivAI.
            </p>

            <div style={{ background: 'var(--surface)', padding: '3.5rem', borderRadius: '24px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem', borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
                    <div style={{ width: '80px', height: '80px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white', fontWeight: 'bold', boxShadow: '0 8px 16px rgba(22,163,74,0.2)' }}>
                        {user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{user.nome}</div>
                        <div style={{ display: 'inline-flex', background: 'rgba(22, 163, 74, 0.1)', color: 'var(--primary-dark)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
                            Membro Premium
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
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
        </div>
    );
}
