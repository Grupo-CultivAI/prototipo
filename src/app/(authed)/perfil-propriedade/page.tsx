// @ts-nocheck
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Sprout, History, Target, ChevronDown, ChevronUp, Droplets, FlaskConical, AlertCircle, Info } from 'lucide-react';

const estadosBr = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Local Zod Schema matching backend
const formSchema = z.object({
    tamanho: z.string().optional(),
    estado: z.string().min(1, "Estado é obrigatório"),
    cidade: z.string().min(1, "Cidade é obrigatória"),
    cep: z.string().optional().refine((val) => !val || /^\d{5}-\d{3}$/.test(val) || /^\d{8}$/.test(val), "CEP inválido"),
    coordenadas: z.object({ lat: z.number().nullable().optional(), lng: z.number().nullable().optional() }).optional(),
    tipoSolo: z.enum(["arenoso", "argiloso", "siltoso", "misto", ""]),
    phSolo: z.preprocess((val) => val === '' || val == null ? null : Number(val), z.number().min(3.5).max(9).nullable().optional()) as z.ZodType<number | null | undefined, any, any>,
    materiaOrganica: z.enum(["Baixa", "Média", "Alta", ""]).optional().nullable(),
    drenagem: z.enum(["Boa", "Média", "Ruim", ""]).optional().nullable(),
    analiseSolo: z.boolean().default(false),
    culturas: z.string().optional(), // For text input (comma separated)
    tempoCulturaAtual: z.preprocess((val) => val === '' || val == null ? null : Number(val), z.number().min(0, "Tempo não pode ser negativo").nullable().optional()) as z.ZodType<number | null | undefined, any, any>,
    usoFertilizantes: z.enum(["Baixo", "Médio", "Alto", ""]).optional().nullable(),
    problemasRecentes: z.array(z.string()).default([]),
    objetivos: z.array(z.string()).default([]),
    observacoes: z.string().optional().nullable()
});

type FormData = z.infer<typeof formSchema>;

export default function PerfilPropriedade() {
    const router = useRouter();
    const [openSection, setOpenSection] = useState<string>('localizacao');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            tamanho: '', estado: '', cidade: '', cep: '', tipoSolo: '', phSolo: null, materiaOrganica: '',
            drenagem: '', analiseSolo: false, culturas: '', tempoCulturaAtual: null,
            usoFertilizantes: '', problemasRecentes: [], objetivos: [], observacoes: ''
        }
    });

    const cepValue = watch('cep');

    useEffect(() => {
        if (cepValue && cepValue.replace(/\D/g, '').length === 8) {
            const cleanCep = cepValue.replace(/\D/g, '');
            fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
                .then(res => res.json())
                .then(data => {
                    if (!data.erro) {
                        setValue('cidade', data.localidade);
                        setValue('estado', data.uf);
                    }
                }).catch(() => { });
        }
    }, [cepValue, setValue]);

    useEffect(() => {
        async function loadProfile() {
            try {
                const res = await fetch('/api/propriedade');
                if (res.ok) {
                    const data = await res.json();
                    if (data.propriedade) {
                        const p = data.propriedade;
                        Object.keys(p).forEach(key => {
                            if (p[key] !== undefined && key !== 'coordenadas') {
                                setValue(key as any, p[key]);
                            }
                        });
                        if (p.culturasHistorico && p.culturasHistorico.length) {
                            setValue('culturas', p.culturasHistorico.join(', '));
                        }
                    }
                }
            } catch (err) { }
        }
        loadProfile();
    }, [setValue]);

    const onSubmit = async (data: any) => {
        setSaving(true);
        setMessage('');
        try {
            // prepare data for backend (split culturas)
            const submissionData = {
                ...data,
                culturasHistorico: data.culturas ? data.culturas.split(',').map(c => c.trim()).filter(Boolean) : []
            };

            const res = await fetch('/api/propriedade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            });
            if (res.ok) {
                setMessage('Dados registrados com sucesso! Preparando análise agronômica...');
                setTimeout(() => {
                    setMessage('');
                    router.push('/chatbot');
                }, 2000);
            } else {
                setMessage('Não foi possível registrar as alterações.');
            }
        } catch (err) {
            setMessage('Sem resposta do servidor.');
        } finally {
            setSaving(false);
        }
    };

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? '' : section);
    };

    const AccordionHeader = ({ id, icon: Icon, title, description }: any) => {
        const isOpen = openSection === id;
        return (
            <div onClick={() => toggleSection(id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', cursor: 'pointer',
                background: isOpen ? 'var(--primary-light)' : '#FDFDFD',
                borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                transition: 'all 0.3s', borderRadius: isOpen ? '16px 16px 0 0' : '16px', color: isOpen ? 'white' : 'var(--text-primary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '10px', background: isOpen ? 'rgba(255,255,255,0.2)' : 'var(--surface)', borderRadius: '12px', color: isOpen ? 'white' : 'var(--primary)' }}>
                        <Icon size={24} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>{title}</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: isOpen ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>{description}</p>
                    </div>
                </div>
                {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} color="var(--text-secondary)" />}
            </div>
        );
    };

    const inputStyle = { width: '100%', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s' };
    const labelStyle = { display: 'block', marginBottom: '0.6rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' };
    const errorStyle = { color: '#EF4444', fontSize: '0.85rem', marginTop: '0.4rem', display: 'block' };

    return (
        <div style={{ padding: '0 1rem', width: '100%', maxWidth: '900px', margin: '0 auto', paddingBottom: '4rem' }}>
            <h1 style={{ fontSize: '2.6rem', marginBottom: '0.8rem', fontWeight: '800', color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>Meu Cultivo</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3.5rem', fontSize: '1.1rem', maxWidth: '650px', lineHeight: '1.6' }}>
                Complete os dados da sua área abaixo para que a Inteligência Artificial possa fornecer diagnósticos precisos e planos direcionados à sua realidade.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* --- 1. LOCALIZAÇÃO --- */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                    <AccordionHeader id="localizacao" icon={MapPin} title="1. Localização e Clima" description="Ajuda a IA a entender seu regime de chuvas e clima." />
                    {openSection === 'localizacao' && (
                        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', padding: '1rem', background: 'rgba(22, 163, 74, 0.05)', borderRadius: '12px', alignItems: 'flex-start', gap: '12px' }}>
                                    <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                        Com o seu CEP, nós localizamos sua cidade e estado para inferir automaticamente a estação do ano atual e as condições climáticas esperadas em sua região.
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>CEP <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(opcional)</span></label>
                                <input placeholder="XXXXX-XXX" {...register('cep')} style={inputStyle} />
                                {errors.cep && <span style={errorStyle}>{errors.cep.message}</span>}
                            </div>
                            <div>
                                <label style={labelStyle}>Estado *</label>
                                <select {...register('estado')} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    {estadosBr.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                </select>
                                {errors.estado && <span style={errorStyle}>{errors.estado.message}</span>}
                            </div>
                            <div>
                                <label style={labelStyle}>Cidade *</label>
                                <input placeholder="Sua cidade" {...register('cidade')} style={inputStyle} />
                                {errors.cidade && <span style={errorStyle}>{errors.cidade.message}</span>}
                            </div>
                            <div>
                                <label style={labelStyle}>Tamanho da Propriedade (Hectares)</label>
                                <input type="number" placeholder="Ex: 50" {...register('tamanho')} style={inputStyle} />
                            </div>
                        </div>
                    )}
                </div>

                {/* --- 2. SOLO --- */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                    <AccordionHeader id="solo" icon={Droplets} title="2. Solo (Base Física/Química)" description="Condiciona o desenvolvimento e retenção de nutrientes." />
                    {openSection === 'solo' && (
                        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label style={labelStyle} title="Influencia diretamente na retenção de água e nutrientes.">Tipo de Solo * ⓘ</label>
                                <select {...register('tipoSolo')} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    <option value="arenoso">Arenoso (Aquece rápido, escorrega água)</option>
                                    <option value="argiloso">Argiloso (Retém água e nutrientes)</option>
                                    <option value="siltoso">Siltoso (Fácil erosão, muito fino)</option>
                                    <option value="misto">Misto (Equilíbrio)</option>
                                </select>
                                {errors.tipoSolo && <span style={errorStyle}>{errors.tipoSolo.message}</span>}
                            </div>
                            <div>
                                <label style={labelStyle}>pH do Solo <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(3.5 a 9)</span></label>
                                <input type="number" step="0.1" placeholder="Ex: 6.5" {...register('phSolo')} style={inputStyle} />
                                {errors.phSolo && <span style={errorStyle}>{errors.phSolo.message}</span>}
                            </div>
                            <div>
                                <label style={labelStyle}>Matéria Orgânica</label>
                                <select {...register('materiaOrganica')} style={inputStyle}>
                                    <option value="">Não sei informar</option>
                                    <option value="Baixa">Baixa</option>
                                    <option value="Média">Média</option>
                                    <option value="Alta">Alta</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Drenagem (Escoamento da água)</label>
                                <select {...register('drenagem')} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    <option value="Boa">Boa (Seca em tempo adequado)</option>
                                    <option value="Média">Média</option>
                                    <option value="Ruim">Ruim (Apoça água frequentemente)</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                                <input type="checkbox" id="analiseSolo" {...register('analiseSolo')} style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                                <label htmlFor="analiseSolo" style={{ fontSize: '1rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Possui análise de solo recente? (últimos 12 meses)</label>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- 3. HISTÓRICO --- */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                    <AccordionHeader id="historico" icon={History} title="3. Histórico da Área" description="Culturas anteriores e desafios enfrentados." />
                    {openSection === 'historico' && (
                        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Culturas plantadas nos últimos anos <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(separe por vírgula)</span></label>
                                <input placeholder="Ex: Soja, Milho safrinha, Braquiária" {...register('culturas')} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Tempo com as culturas atuais (anos)</label>
                                <input type="number" placeholder="Ex: 3" {...register('tempoCulturaAtual')} style={inputStyle} />
                                {errors.tempoCulturaAtual && <span style={errorStyle}>{errors.tempoCulturaAtual.message}</span>}
                            </div>
                            <div>
                                <label style={labelStyle}>Histórico de uso de fertilizantes</label>
                                <select {...register('usoFertilizantes')} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    <option value="Baixo">Baixo (Mais orgânico/natural)</option>
                                    <option value="Médio">Médio (Uso padrão da região)</option>
                                    <option value="Alto">Alto (Sistema intensivo)</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Problemas recentes observados (múltipla escolha)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
                                    {['Queda de produtividade', 'Pragas', 'Doenças', 'Solo fraco', 'Nenhum'].map(prob => (
                                        <label key={prob} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#FDFDFD', padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer' }}>
                                            <input type="checkbox" value={prob} {...register('problemasRecentes')} style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }} />
                                            {prob}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- 4. OBJETIVOS --- */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                    <AccordionHeader id="objetivo" icon={Target} title="4. Objetivos (Pra onde quer ir)" description="Para a IA recomendar o caminho exato." />
                    {openSection === 'objetivo' && (
                        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={labelStyle}>Metas Principais (múltipla escolha)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
                                    {['Aumentar produtividade', 'Recuperar solo', 'Reduzir custos', 'Diversificar produção', 'Transição para orgânico'].map(obj => (
                                        <label key={obj} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#FDFDFD', padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer' }}>
                                            <input type="checkbox" value={obj} {...register('objetivos')} style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }} />
                                            {obj}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Observações Adicionais <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(opcional)</span></label>
                                <textarea rows={4} placeholder="Conte mais sobre sua área se desejar..." {...register('observacoes')} style={{ ...inputStyle, resize: 'vertical' }}></textarea>
                            </div>
                        </div>
                    )}
                </div>


                {/* --- SUBMIT --- */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ color: message.includes('Não foi possível') || message.includes('Sem resposta') ? '#EF4444' : 'var(--primary-light)', fontWeight: '600', fontSize: '1.1rem' }}>
                        {message}
                    </div>
                    <button type="submit" disabled={saving}
                        style={{ background: 'var(--primary)', color: 'var(--white)', padding: '1.25rem 3.5rem', borderRadius: '100px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '1.1rem', transition: 'all 0.3s', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(22, 163, 74, 0.25)' }}>
                        {saving ? 'Atualizando Análise...' : 'Salvar Dados & Ir para IA'}
                    </button>
                </div>
            </form>
        </div>
    );
}
