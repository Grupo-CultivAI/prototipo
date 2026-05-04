"use client";
import React, { useState } from 'react';

export default function DynamicForm({ data, onSubmit, onSkip, submittedData }) {
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (chave, valor) => {
        setFormData(prev => ({ ...prev, [chave]: valor }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/propriedade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (response.ok) {
                onSubmit(formData);
            } else {
                onSubmit(formData);
            }
        } catch (error) {
            onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render read-only summary if data was already submitted
    if (submittedData) {
        return (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', marginTop: '0.5rem', width: '100%' }}>
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
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '0.5rem' }}>
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
                                style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                            >
                                <option value="" disabled>Selecione uma opção</option>
                                {campo.opcoes?.map((op, i) => (
                                    <option key={i} value={op}>{op}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                required
                                type={campo.tipo === 'number' ? 'number' : 'text'}
                                step={campo.tipo === 'number' ? 'any' : undefined}
                                value={formData[campo.chave] || ''}
                                onChange={(e) => handleChange(campo.chave, e.target.value)}
                                style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
                            />
                        )}
                    </div>
                ))}
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{ flex: 1, padding: '0.8rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {isSubmitting ? 'Salvando...' : 'Salvar Dados'}
                    </button>
                    {onSkip && (
                        <button
                            type="button"
                            onClick={onSkip}
                            disabled={isSubmitting}
                            style={{ flex: 1, padding: '0.8rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
                        >
                            Pular
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
