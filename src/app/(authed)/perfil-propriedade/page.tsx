"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Sprout, History, Target, ChevronDown, ChevronUp, Droplets, FlaskConical, AlertCircle, Info } from 'lucide-react';
import styles from '../paginas.module.css';
import { ESTADOS, formularioPerfilSchema, type PerfilFormulario, type PerfilValidado } from '@/lib/perfilSchema';
import { ITENS_DO_PERFIL, itensFaltando, CULTURAS_COMUNS, normalizarCultura, semRepetir, CHAVE_PEDIR_ANALISE } from '@/lib/perfil';

const SEM_PROBLEMAS = 'Nenhum';

const VALORES_INICIAIS: PerfilFormulario = {
    tamanho: '', estado: '' as PerfilFormulario['estado'], cidade: '', cep: '', tipoSolo: '', phSolo: null, materiaOrganica: '',
    drenagem: '', analiseSolo: false, culturasHistorico: [], tempoCulturaAtual: null,
    usoFertilizantes: '', sistemaPlantio: '', irrigacao: '', problemasRecentes: [], objetivos: [],
    proximaCultura: '', observacoes: ''
};
const AINDA_NAO_DECIDI = 'Ainda não decidi';

// Botões que marcam e desmarcam, no lugar de texto separado por vírgula.
const Opcoes = ({ opcoes, marcadas, alternar }: any) => (
    <div className={styles.opcoes}>
        {opcoes.map((o: string) => (
            <button key={o} type="button" aria-pressed={marcadas.includes(o)} onClick={() => alternar(o)}
                className={`${styles.opcao} ${marcadas.includes(o) ? styles.opcaoMarcada : ''}`}>
                {o}
            </button>
        ))}
    </div>
);



// Cabeçalho de cada bloco do formulário. Fica fora da página: definido dentro dela, o React
// o recriava a cada tecla digitada. É um botão dentro do título (padrão de bloco sanfonado),
// e não uma div clicável, para abrir também pelo teclado e pelo leitor de tela.
function CabecalhoSecao({ id, aberta, aoAlternar, icon: Icon, title, description }: {
    id: string; aberta: boolean; aoAlternar: (id: string) => void; icon: React.ElementType; title: string; description: string;
}) {
    return (
        <h3 style={{ margin: 0 }}>
            <button type="button" onClick={() => aoAlternar(id)} aria-expanded={aberta} style={{
                width: '100%', border: 'none', font: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', cursor: 'pointer',
                background: aberta ? 'var(--primary-light)' : '#FDFDFD',
                borderBottom: aberta ? '1px solid var(--border)' : 'none',
                transition: 'all 0.3s', borderRadius: aberta ? '16px 16px 0 0' : '16px', color: aberta ? 'white' : 'var(--text-primary)'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ display: 'inline-flex', padding: '10px', background: aberta ? 'rgba(255,255,255,0.2)' : 'var(--surface)', borderRadius: '12px', color: aberta ? 'white' : 'var(--primary)' }}>
                        <Icon size={24} aria-hidden="true" />
                    </span>
                    <span>
                        <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 700 }}>{title}</span>
                        <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 400, color: aberta ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>{description}</span>
                    </span>
                </span>
                {aberta ? <ChevronUp size={24} aria-hidden="true" /> : <ChevronDown size={24} color="var(--text-secondary)" aria-hidden="true" />}
            </button>
        </h3>
    );
}

export default function PerfilPropriedade() {
    const router = useRouter();
    const [openSection, setOpenSection] = useState<string>('localizacao');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [novaCultura, setNovaCultura] = useState('');
    const [confirmandoApagar, setConfirmandoApagar] = useState(false);

    const { register, handleSubmit, setValue, watch, control, reset, formState: { errors } } = useForm<PerfilFormulario, unknown, PerfilValidado>({
        resolver: zodResolver(formularioPerfilSchema),
        defaultValues: VALORES_INICIAIS
    });

    // "Apagar dados da propriedade": some o perfil, a conta e as conversas continuam.
    const apagarDados = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/propriedade', { method: 'DELETE' });
            if (!res.ok) throw new Error();
            reset(VALORES_INICIAIS);
            setMessage('Dados da propriedade apagados.');
        } catch {
            setMessage('Não foi possível apagar os dados. Tente de novo.');
        } finally {
            setSaving(false);
            setConfirmandoApagar(false);
        }
    };

    // useWatch, e não watch(): o watch() não é compatível com o otimizador do React.
    const cepValue = useWatch({ control, name: 'cep' });
    const valores = useWatch({ control });
    const faltando = itensFaltando(valores);

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
                        setValue('culturasHistorico', semRepetir(p.culturasHistorico));
                    }
                }
            } catch (err) { }
        }
        loadProfile();
    }, [setValue]);

    // pedirAnalise: o chat abre e já envia a primeira pergunta (gasta uma do limite diário).
    const onSubmit = async (data: PerfilValidado, pedirAnalise: boolean) => {
        setSaving(true);
        setMessage('');
        try {
            const submissionData = { ...data, culturasHistorico: semRepetir(data.culturasHistorico) };

            const res = await fetch('/api/propriedade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            });
            if (res.ok && pedirAnalise) {
                setMessage('Dados salvos! Abrindo o chat com uma primeira análise da sua área...');
                try { sessionStorage.setItem(CHAVE_PEDIR_ANALISE, '1'); } catch { }
                setTimeout(() => router.push('/chatbot'), 1200);
            } else if (res.ok) {
                setMessage('Dados salvos.');
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

    const inputStyle = { width: '100%', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', background: '#FDFDFD', outline: 'none', transition: 'border 0.2s' };
    const labelStyle = { display: 'block', marginBottom: '0.6rem', fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' };
    const errorStyle = { color: '#EF4444', fontSize: '0.85rem', marginTop: '0.4rem', display: 'block' };

    return (
        <div style={{ padding: '0 1rem', width: '100%', maxWidth: '900px', margin: '0 auto', paddingBottom: '4rem' }}>
            <h1 className={styles.tituloPagina} style={{ marginBottom: '0.8rem', fontWeight: '800', color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>Meu Cultivo</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3.5rem', fontSize: '1.1rem', maxWidth: '650px', lineHeight: '1.6' }}>
                Complete os dados da sua área abaixo para que a Inteligência Artificial possa fornecer diagnósticos precisos e planos direcionados à sua realidade.
            </p>

            <div className={styles.progressoPerfil}>
                <strong style={{ color: 'var(--primary-dark)' }}>
                    {faltando.length ? `Perfil: ${ITENS_DO_PERFIL.length - faltando.length} de ${ITENS_DO_PERFIL.length} itens importantes` : 'Perfil completo ✓'}
                </strong>
                <div className={styles.barraPerfil}>
                    <span style={{ width: `${Math.round(((ITENS_DO_PERFIL.length - faltando.length) / ITENS_DO_PERFIL.length) * 100)}%` }} />
                </div>
                {faltando.length > 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Falta: {faltando.map((i) => i.rotulo).join(', ')}.</span>
                )}
            </div>

            <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* --- 1. LOCALIZAÇÃO --- */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                    <CabecalhoSecao aberta={openSection === 'localizacao'} aoAlternar={toggleSection} id="localizacao" icon={MapPin} title="1. Localização e Clima" description="Para a IA considerar o clima e a época do ano na sua região." />
                    {openSection === 'localizacao' && (
                        <div className={styles.grade2} style={{ padding: '2rem', gap: '1.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', padding: '1rem', background: 'rgba(22, 163, 74, 0.05)', borderRadius: '12px', alignItems: 'flex-start', gap: '12px' }}>
                                    <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                        Com o CEP, preenchemos a cidade e o estado. A IA usa a cidade para consultar o clima de agora e a data de hoje para considerar a época do ano.
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
                                    {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
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
                    <CabecalhoSecao aberta={openSection === 'solo'} aoAlternar={toggleSection} id="solo" icon={Droplets} title="2. Solo (Base Física/Química)" description="Condiciona o desenvolvimento e retenção de nutrientes." />
                    {openSection === 'solo' && (
                        <div className={styles.grade2} style={{ padding: '2rem', gap: '1.5rem' }}>
                            <div>
                                <label style={labelStyle} title="Influencia diretamente na retenção de água e nutrientes.">Tipo de Solo ⓘ</label>
                                <select {...register('tipoSolo')} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    <option value="arenoso">Arenoso (Aquece rápido, escorrega água)</option>
                                    <option value="argiloso">Argiloso (Retém água e nutrientes)</option>
                                    <option value="siltoso">Siltoso (Fácil erosão, muito fino)</option>
                                    <option value="misto">Misto (Equilíbrio)</option>
                                    <option value="nao_sei">Não sei</option>
                                </select>
                                {errors.tipoSolo && <span style={errorStyle}>{errors.tipoSolo.message}</span>}
                                <span style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                    Dica: aperte um punhado de terra úmida. Se esfarela, é arenoso; se forma uma &quot;cobrinha&quot; que dobra sem quebrar, é argiloso.
                                </span>
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
                    <CabecalhoSecao aberta={openSection === 'historico'} aoAlternar={toggleSection} id="historico" icon={History} title="3. Histórico e Manejo da Área" description="Culturas anteriores, forma de plantio, irrigação e desafios." />
                    {openSection === 'historico' && (
                        <div className={styles.grade2} style={{ padding: '2rem', gap: '1.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Culturas plantadas nos últimos anos <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(toque para marcar)</span></label>
                                <Controller name="culturasHistorico" control={control} render={({ field }) => {
                                    const marcadas = field.value || [];
                                    const alternar = (c: string) => field.onChange(marcadas.includes(c) ? marcadas.filter((x: string) => x !== c) : [...marcadas, c]);
                                    const acrescentar = () => {
                                        const c = normalizarCultura(novaCultura);
                                        if (c) field.onChange(semRepetir([...marcadas, c]));
                                        setNovaCultura('');
                                    };
                                    return (
                                        <>
                                            <Opcoes opcoes={semRepetir([...CULTURAS_COMUNS, ...marcadas])} marcadas={marcadas} alternar={alternar} />
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                                                <input value={novaCultura} onChange={(e) => setNovaCultura(e.target.value)} placeholder="Outra cultura"
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); acrescentar(); } }}
                                                    style={{ ...inputStyle, padding: '0.8rem 1rem', minWidth: 0 }} />
                                                <button type="button" onClick={acrescentar} className={styles.opcao} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Acrescentar</button>
                                            </div>
                                        </>
                                    );
                                }} />
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
                            <div>
                                <label style={labelStyle}>Sistema de plantio</label>
                                <select {...register('sistemaPlantio')} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    <option value="Plantio direto">Plantio direto (sem revolver o solo, sobre a palha)</option>
                                    <option value="Convencional">Convencional (aração e gradagem)</option>
                                    <option value="Cultivo mínimo">Cultivo mínimo (revolve pouco o solo)</option>
                                    <option value="Não sei">Não sei</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Irrigação</label>
                                <select {...register('irrigacao')} style={inputStyle}>
                                    <option value="">Selecione...</option>
                                    <option value="Não irrigo">Não irrigo (só chuva)</option>
                                    <option value="Aspersão">Aspersão</option>
                                    <option value="Gotejamento">Gotejamento</option>
                                    <option value="Sulco ou inundação">Sulco ou inundação</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Problemas recentes observados (múltipla escolha)</label>
                                <div className={styles.grade2} style={{ gap: '1rem', marginTop: '0.8rem' }}>
                                    {/* "Nenhum" exclui os demais, e marcar um problema desmarca "Nenhum". */}
                                    <Controller name="problemasRecentes" control={control} render={({ field }) => {
                                        const marcados = field.value || [];
                                        const alternar = (prob: string, marcar: boolean) => {
                                            if (!marcar) return field.onChange(marcados.filter((x: string) => x !== prob));
                                            field.onChange(prob === SEM_PROBLEMAS ? [SEM_PROBLEMAS] : [...marcados.filter((x: string) => x !== SEM_PROBLEMAS), prob]);
                                        };
                                        return <>{['Queda de produtividade', 'Pragas', 'Doenças', 'Solo fraco', SEM_PROBLEMAS].map(prob => (
                                            <label key={prob} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#FDFDFD', padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={marcados.includes(prob)} onChange={(e) => alternar(prob, e.target.checked)} style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }} />
                                                {prob}
                                            </label>
                                        ))}</>;
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- 4. OBJETIVOS --- */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                    <CabecalhoSecao aberta={openSection === 'objetivo'} aoAlternar={toggleSection} id="objetivo" icon={Target} title="4. Próxima Safra e Objetivos" description="O que pretende plantar e aonde quer chegar." />
                    {openSection === 'objetivo' && (
                        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={labelStyle}>O que pretende plantar na próxima safra?</label>
                                <Controller name="proximaCultura" control={control} render={({ field }) => (
                                    <Opcoes
                                        opcoes={[...semRepetir([...CULTURAS_COMUNS, ...(field.value && field.value !== AINDA_NAO_DECIDI ? [field.value] : [])]), AINDA_NAO_DECIDI]}
                                        marcadas={field.value ? [field.value] : []}
                                        alternar={(c: string) => field.onChange(field.value === c ? '' : c)}
                                    />
                                )} />
                            </div>
                            <div>
                                <label style={labelStyle}>Metas Principais (múltipla escolha)</label>
                                <div className={styles.grade2} style={{ gap: '1rem', marginTop: '0.8rem' }}>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ color: message.includes('Não foi possível') || message.includes('Sem resposta') ? '#EF4444' : 'var(--primary-light)', fontWeight: '600', fontSize: '1.1rem' }}>
                        {message}
                    </div>
                    <div className={styles.acoesFormulario}>
                        <button type="button" disabled={saving} onClick={handleSubmit((d) => onSubmit(d, false))}
                            style={{ background: 'transparent', color: 'var(--primary-dark)', padding: '1.1rem 2rem', borderRadius: '100px', border: '1px solid var(--primary)', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', opacity: saving ? 0.7 : 1 }}>
                            Só salvar
                        </button>
                        <button type="button" disabled={saving} onClick={handleSubmit((d) => onSubmit(d, true))}
                            style={{ background: 'var(--primary)', color: 'var(--white)', padding: '1.25rem 2.5rem', borderRadius: '100px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '1.05rem', transition: 'all 0.3s', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(22, 163, 74, 0.25)' }}>
                            {saving ? 'Salvando...' : 'Salvar e pedir análise à IA'}
                        </button>
                    </div>
                </div>
            </form>

            <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {!confirmandoApagar ? (
                    <button type="button" onClick={() => setConfirmandoApagar(true)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#B91C1C', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.95rem' }}>
                        Apagar dados da propriedade
                    </button>
                ) : (
                    <div role="group" aria-label="Confirmar exclusão dos dados da propriedade" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                        <span>Apagar tudo o que foi preenchido no Meu Cultivo? Sua conta e suas conversas continuam.</span>
                        <button type="button" onClick={apagarDados} disabled={saving}
                            style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: 'none', background: '#DC2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                            Apagar
                        </button>
                        <button type="button" onClick={() => setConfirmandoApagar(false)}
                            style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
