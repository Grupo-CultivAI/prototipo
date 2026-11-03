"use client";
import React, { useState } from 'react';
import Botao from '@/components/ui/Botao';

// salvar: grava o dado no cultivo da conversa (o chat sabe qual é).
export default function DynamicForm({ data, onSubmit, onSkip, submittedData, salvar }) {
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (chave, valor) => {
        setFormData(prev => ({ ...prev, [chave]: valor }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Campos "lista" (ex.: culturas) são gravados no cultivo como lista, igual a Meus Cultivos
        const paraSalvar = { ...formData };
        for (const campo of data?.campos_necessarios || []) {
            if (campo.tipo === 'lista' && typeof paraSalvar[campo.chave] === 'string') {
                paraSalvar[campo.chave] = paraSalvar[campo.chave].split(',').map(c => c.trim()).filter(Boolean);
            }
        }
        // A conversa segue mesmo se a gravação falhar: a resposta usa o que a pessoa informou.
        try {
            await salvar?.(paraSalvar);
        } catch (error) {
        } finally {
            onSubmit(formData);
            setIsSubmitting(false);
        }
    };

    // Render read-only summary if data was already submitted
    if (submittedData) {
        return (
            <div style={{ background: 'var(--on-dark-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--on-dark-faint)', marginTop: '0.5rem', width: '100%' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados Fornecidos:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {Object.entries(submittedData).map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{key}</span>
                            <span style={{ fontWeight: '600' }}>{value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data || !data.campos_necessarios) return null;

    return (
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: '0.5rem' }}>
            <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {data.mensagem || "Precisamos de mais alguns detalhes para dar uma resposta melhor."}
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {data.campos_necessarios.map((campo, index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{campo.label}</label>
                        {campo.tipo === 'select' ? (
                            <select
                                required
                                value={formData[campo.chave] || ''}
                                onChange={(e) => handleChange(campo.chave, e.target.value)}
                                style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                            >
                                <option value="" disabled>Selecione uma opção</option>
                                {campo.opcoes?.map((op, i) => (
                                    <option key={i} value={op.valor ?? op}>{op.rotulo ?? op}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                required
                                type={campo.tipo === 'number' ? 'number' : 'text'}
                                step={campo.tipo === 'number' ? 'any' : undefined}
                                value={formData[campo.chave] || ''}
                                onChange={(e) => handleChange(campo.chave, e.target.value)}
                                style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                            />
                        )}
                    </div>
                ))}
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <Botao type="submit" larguraTotal carregando={isSubmitting} textoCarregando="Salvando...">Salvar dados</Botao>
                    {onSkip && <Botao variante="neutro" larguraTotal onClick={onSkip} disabled={isSubmitting}>Pular</Botao>}
                </div>
            </form>
        </div>
    );
}
