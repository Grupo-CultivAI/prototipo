"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, History, Target, Droplets, ArrowLeft, ListChecks, Plus, X, Trash2 } from 'lucide-react';
import styles from '../paginas.module.css';
import { ESTADOS, formularioPerfilSchema, type PerfilFormulario, type PerfilValidado } from '@/lib/perfilSchema';
import { ITENS_DO_PERFIL, itensFaltando, CULTURAS_COMUNS, PERIODOS_DA_SAFRA, normalizarCultura, semRepetir, nomeDoCultivo, rotuloDaSafra, CHAVE_PEDIR_ANALISE } from '@/lib/perfil';
import BuscaCidade from '@/components/BuscaCidade';
import MapaDoPonto from '@/components/MapaDoPonto';
import Botao from '@/components/ui/Botao';
import Aviso from '@/components/ui/Aviso';
import Bloco from '@/components/ui/Bloco';
import Campo, { Entrada, Selecao, AreaTexto, classeDoControle } from '@/components/ui/Campo';
import Opcoes, { Marcar } from '@/components/ui/Opcoes';
import BarraDeAcoes, { TextoAdaptavel } from '@/components/ui/BarraDeAcoes';
import type { TipoSelo } from '@/components/ui/Selo';
import ConfirmarNaTela from '@/components/ui/ConfirmarNaTela';

const SEM_PROBLEMAS = 'Nenhum';

const VALORES_INICIAIS: PerfilFormulario = {
    nome: '', tamanho: '', estado: '' as PerfilFormulario['estado'], cidade: '', codigoMunicipio: '', cep: '', tipoSolo: '', phSolo: null, materiaOrganica: '',
    drenagem: '', analiseSolo: false, culturasHistorico: [], tempoCulturaAtual: null,
    usoFertilizantes: '', sistemaPlantio: '', irrigacao: '', problemasRecentes: [], objetivos: [],
    proximaCultura: '', observacoes: '', safras: [], coordenadas: null, plano: null
};
// Anos para a linha do tempo das safras: do próximo até dez anos atrás.
const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 12 }, (_, i) => ANO_ATUAL + 1 - i);
// Ao duplicar um cultivo (talhão vizinho), vêm estes campos; culturas e plano não.
const CAMPOS_COPIADOS = ['estado', 'cidade', 'codigoMunicipio', 'cep', 'tipoSolo', 'phSolo', 'materiaOrganica', 'drenagem', 'analiseSolo', 'usoFertilizantes', 'sistemaPlantio', 'irrigacao', 'objetivos'];
const AINDA_NAO_DECIDI = 'Ainda não decidi';

// Em que bloco fica cada campo, na ordem da tela: para abrir o bloco do primeiro erro.
const BLOCO_DO_CAMPO: Record<string, string> = {
    estado: 'localizacao', cidade: 'localizacao', codigoMunicipio: 'localizacao', cep: 'localizacao', tamanho: 'localizacao', coordenadas: 'localizacao',
    tipoSolo: 'solo', phSolo: 'solo', materiaOrganica: 'solo', drenagem: 'solo', analiseSolo: 'solo',
    culturasHistorico: 'historico', safras: 'historico', tempoCulturaAtual: 'historico', usoFertilizantes: 'historico', sistemaPlantio: 'historico', irrigacao: 'historico', problemasRecentes: 'historico',
    proximaCultura: 'objetivo', objetivos: 'objetivo', observacoes: 'objetivo',
    plano: 'plano',
};
// Itens importantes do perfil (ITENS_DO_PERFIL) que ficam em cada bloco
const ITENS_DO_BLOCO: Record<string, string[]> = {
    localizacao: ['localizacao'], solo: ['solo'], historico: ['culturas', 'sistema', 'irrigacao'], objetivo: ['proxima', 'objetivos'],
};
const TITULO_DO_BLOCO: Record<string, string> = {
    localizacao: '1. Localização e Clima', solo: '2. Solo', historico: '3. Histórico e Manejo da Área', objetivo: '4. Próxima Safra e Objetivos', plano: '5. Plano de rotação',
};
// O erro de uma lista (safras, etapas do plano) fica dentro de cada item: pega a primeira mensagem.
// "ref" (o elemento do campo) fica de fora: percorrê-lo entraria na árvore da página.
function primeiraMensagem(erro: any, nivel = 0): string {
    if (!erro || typeof erro !== 'object' || nivel > 3) return 'confira os dados.';
    if (typeof erro.message === 'string' && erro.message) return erro.message;
    for (const [chave, valor] of Object.entries(erro)) {
        if (chave === 'ref') continue;
        const m = primeiraMensagem(valor, nivel + 1);
        if (m !== 'confira os dados.') return m;
    }
    return 'confira os dados.';
}

// Situação de cada bloco no cabeçalho ("Completo", "Faltam 2", "Corrigir"), para ver o que falta sem abrir.
type Situacao = { texto: string; tipo: TipoSelo };

// Formulário de um cultivo de Meus Cultivos: sem id, cadastra um novo (/meus-cultivos/novo);
// com id, edita (/meus-cultivos/[id]).
export default function FormularioCultivo({ id, copiarDe }: { id?: string; copiarDe?: string }) {
    const [nomeDaOrigem, setNomeDaOrigem] = useState('');
    const router = useRouter();
    const [openSection, setOpenSection] = useState<string>('localizacao');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [messageErro, setMessageErro] = useState(false);
    const [novaCultura, setNovaCultura] = useState('');
    const [confirmandoApagar, setConfirmandoApagar] = useState(false);
    const excluirRef = useRef<HTMLButtonElement>(null);
    const [naoEncontrado, setNaoEncontrado] = useState(false);

    const [statusCep, setStatusCep] = useState('');

    const { register, handleSubmit, setValue, control, formState: { errors, isSubmitted } } = useForm<PerfilFormulario, unknown, PerfilValidado>({
        resolver: zodResolver(formularioPerfilSchema),
        defaultValues: VALORES_INICIAIS
    });

    // Some o cultivo; a conta e as conversas continuam (as conversas sobre ele viram gerais).
    // A falha aparece na própria confirmação (ConfirmarNaTela), que continua aberta.
    const excluirCultivo = async () => {
        const res = await fetch(`/api/cultivos/${id}`, { method: 'DELETE' }).catch(() => null);
        if (!res?.ok) throw new Error('Não foi possível excluir o cultivo. Tente de novo.');
        router.push('/meus-cultivos?excluido=1');
    };

    // useWatch, e não watch(): o watch() não é compatível com o otimizador do React.
    const valores = useWatch({ control });
    const safras = useFieldArray({ control, name: 'safras' });
    const etapas = useFieldArray({ control, name: 'plano.etapas' as const });

    // Centro do município escolhido, para o mapa do ponto abrir na cidade.
    // Guardado com o código: trocar de cidade invalida o centro anterior sem precisar limpá-lo.
    const [centroBuscado, setCentroBuscado] = useState<{ codigo: string; lat: number; lng: number } | null>(null);
    const centro = centroBuscado && centroBuscado.codigo === valores.codigoMunicipio ? centroBuscado : null;
    useEffect(() => {
        const codigo = valores.codigoMunicipio;
        if (!codigo || !/^\d{7}$/.test(codigo)) return;
        let atual = true;
        fetch(`/api/municipios/${codigo}`).then((r) => (r.ok ? r.json() : null))
            .then((c) => { if (atual && c) setCentroBuscado({ codigo, ...c }); }).catch(() => {});
        return () => { atual = false; };
    }, [valores.codigoMunicipio]);
    const faltando = itensFaltando(valores);

    const definirCidade = useCallback(({ nome, codigo }: { nome: string; codigo: string }) => {
        setValue('cidade', nome, { shouldDirty: true, shouldValidate: isSubmitted });
        setValue('codigoMunicipio', codigo, { shouldDirty: true });
    }, [setValue, isSubmitted]);

    // Cidade escolhida à mão: o CEP digitado antes era de outro lugar e sai. A correção
    // automática de perfil antigo (nome sem acento) não mexe no CEP.
    const escolherCidade = useCallback(({ nome, codigo, automatico }: { nome: string; codigo: string; automatico?: boolean }) => {
        if (!automatico) {
            setValue('cep', '', { shouldDirty: true });
            setStatusCep('');
        }
        definirCidade({ nome, codigo });
    }, [setValue, definirCidade]);

    // CEP completo: a ViaCEP devolve estado, cidade e o código do IBGE. Só quando o produtor
    // digita (e não ao carregar o perfil), para não trocar uma cidade escolhida na lista.
    const buscarCep = async (digitado: string) => {
        const numeros = digitado.replace(/\D/g, '').slice(0, 8);
        const formatado = numeros.length > 5 ? `${numeros.slice(0, 5)}-${numeros.slice(5)}` : numeros;
        if (formatado !== digitado) setValue('cep', formatado);
        if (numeros.length !== 8) { setStatusCep(''); return; }
        setStatusCep('Buscando o CEP...');
        try {
            const data = await (await fetch(`https://viacep.com.br/ws/${numeros}/json/`)).json();
            if (data.erro || !/^\d{7}$/.test(String(data.ibge ?? ''))) {
                setStatusCep('CEP não encontrado. Escolha o estado e a cidade abaixo.');
                return;
            }
            setValue('estado', data.uf, { shouldDirty: true });
            definirCidade({ nome: data.localidade, codigo: String(data.ibge) });
            setStatusCep(`✓ ${data.localidade}/${data.uf}`);
        } catch {
            setStatusCep('Não deu para buscar o CEP agora. Escolha o estado e a cidade abaixo.');
        }
    };

    // Editar: carrega o cultivo. Duplicar (copiarDe): traz só o que vale para uma área vizinha
    // (local, solo, manejo e objetivos); culturas, safras e plano ficam em branco.
    useEffect(() => {
        const origem = id ?? copiarDe;
        if (!origem) return;
        async function carregarCultivo() {
            try {
                const res = await fetch(`/api/cultivos/${origem}`);
                if (res.status === 404) { if (id) setNaoEncontrado(true); return; }
                if (res.ok) {
                    const p = (await res.json()).cultivo;
                    const campos = id ? Object.keys(VALORES_INICIAIS) : CAMPOS_COPIADOS;
                    campos.forEach((key) => {
                        if (p[key] !== undefined && p[key] !== null) setValue(key as any, p[key]);
                    });
                    // Sem ponto, o banco guarda { lat: null, lng: null }
                    setValue('coordenadas', id && p.coordenadas?.lat != null ? { lat: p.coordenadas.lat, lng: p.coordenadas.lng } : null);
                    if (id) setValue('culturasHistorico', semRepetir(p.culturasHistorico));
                    // A lista de etapas (useFieldArray) só se atualiza pelo próprio nome, não pelo de "plano"
                    if (id) setValue('plano.etapas', (p.plano?.etapas ?? []).map((e: any) => ({ quando: e.quando ?? '', cultura: e.cultura ?? '', objetivo: e.objetivo ?? '', feita: Boolean(e.feita) })));
                    else {
                        setNomeDaOrigem(nomeDoCultivo(p));
                        setValue('nome', `${nomeDoCultivo(p)} (cópia)`.slice(0, 60));
                    }
                }
            } catch (err) { }
        }
        carregarCultivo();
    }, [id, copiarDe, setValue]);

    // pedirAnalise: o chat abre sobre este cultivo e já envia a primeira pergunta (gasta uma do limite diário).
    const onSubmit = async (data: PerfilValidado, pedirAnalise: boolean) => {
        setSaving(true);
        setMessage('');
        setMessageErro(false);
        try {
            // As culturas das safras entram também nas "culturas dos últimos anos", que a IA e o ZARC usam.
            const submissionData = { ...data, culturasHistorico: semRepetir([...data.culturasHistorico, ...(data.safras ?? []).map((s) => s.cultura)]) };

            const res = await fetch(id ? `/api/cultivos/${id}` : '/api/cultivos', {
                method: id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            });
            const resposta = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessageErro(true);
                setMessage(resposta.message || 'Não foi possível registrar as alterações.');
                setSaving(false);
                return;
            }
            const cultivoId = id ?? resposta.cultivo?._id;
            if (pedirAnalise) {
                setMessage('Dados salvos! Abrindo o chat com uma primeira análise deste cultivo...');
                try { sessionStorage.setItem(CHAVE_PEDIR_ANALISE, '1'); } catch { }
                setTimeout(() => router.push(`/chatbot?cultivo=${cultivoId}`), 1200);
            } else {
                router.push('/meus-cultivos?salvo=1');
            }
        } catch (err) {
            setMessageErro(true);
            setMessage('Sem resposta do servidor.');
            setSaving(false);
        }
    };

    // Validação falhou: o campo com erro podia estar num bloco fechado, e nada aparecia na tela.
    // Abre o bloco do primeiro erro, rola até ele, dá foco ao campo e diz junto dos botões o que corrigir.
    const abrirPrimeiroErro = (erros: Record<string, any>) => {
        const campo = ['nome', ...Object.keys(BLOCO_DO_CAMPO)].find((c) => erros[c]);
        if (!campo) return;
        setMessageErro(true);
        const mensagem = primeiraMensagem(erros[campo]);
        if (campo === 'nome') {
            setMessage(`Confira o nome do cultivo: ${mensagem}`);
            document.getElementById('nome-cultivo')?.focus();
            return;
        }
        const bloco = BLOCO_DO_CAMPO[campo];
        setOpenSection(bloco);
        setMessage(`Confira o bloco "${TITULO_DO_BLOCO[bloco]}": ${mensagem}`);
        // Depois de o bloco abrir na tela
        setTimeout(() => {
            const secao = document.getElementById(`secao-${bloco}`)?.parentElement;
            secao?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const alvo = secao?.querySelector(`#campo-${campo}, [name="${campo}"]`) ?? secao?.querySelector('input:not([type="hidden"]), select, textarea');
            (alvo as HTMLElement | null)?.focus({ preventScroll: true });
        }, 60);
    };

    const situacaoDo = (bloco: string): Situacao => {
        if (Object.keys(errors).some((campo) => BLOCO_DO_CAMPO[campo] === bloco)) return { tipo: 'erro', texto: 'Corrigir' };
        if (bloco === 'plano') {
            const n = valores.plano?.etapas?.length ?? 0;
            return n ? { tipo: 'ok', texto: `${n} ${n === 1 ? 'etapa' : 'etapas'}` } : { tipo: 'neutro', texto: 'Opcional' };
        }
        const falta = ITENS_DO_BLOCO[bloco].filter((chave) => faltando.some((f) => f.chave === chave)).length;
        return falta ? { tipo: 'falta', texto: falta === 1 ? 'Falta 1' : `Faltam ${falta}` } : { tipo: 'ok', texto: 'Completo' };
    };

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? '' : section);
    };

    if (naoEncontrado) {
        return (
            <div className={styles.paginaFormulario}>
                <Link href="/meus-cultivos" className={styles.voltar}><ArrowLeft size={16} aria-hidden="true" /> Meus Cultivos</Link>
                <h1 className={styles.tituloPagina} style={{ fontWeight: '800', color: 'var(--primary-dark)' }}>Cultivo não encontrado</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.8rem' }}>Ele pode ter sido excluído. Volte para Meus Cultivos para ver os seus cultivos.</p>
            </div>
        );
    }

    const bloco = (nome: string) => ({ id: nome, aberto: openSection === nome, aoAlternar: toggleSection, situacao: situacaoDo(nome) });

    return (
        <div className={styles.paginaFormulario}>
            <Link href="/meus-cultivos" className={styles.voltar}><ArrowLeft size={16} aria-hidden="true" /> Meus Cultivos</Link>
            <h1 className={styles.tituloPagina} style={{ marginBottom: '0.8rem', fontWeight: '800', color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>
                {id ? (valores.nome?.trim() || 'Editar cultivo') : 'Novo cultivo'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: nomeDaOrigem ? '1rem' : '2.5rem', fontSize: '1.1rem', maxWidth: '650px', lineHeight: '1.6' }}>
                Um cultivo é cada área que você planta: um sítio, um talhão, um lote. Quanto mais completo, mais as respostas do assistente levam em conta a realidade dessa área.
            </p>
            {nomeDaOrigem && (
                <p className={styles.lembretePerfil} style={{ marginBottom: '2rem' }}>
                    Cópia de {nomeDaOrigem}: vieram a localização, o solo, o manejo e os objetivos. Marque as culturas desta área e ajuste o que for diferente.
                </p>
            )}

            <div className={styles.progressoPerfil}>
                <Entrada rotulo="Nome do cultivo" obrigatorio id="nome-cultivo" placeholder="Ex.: Sítio Boa Vista, talhão do fundo" maxLength={60}
                    erro={errors.nome?.message} dica="É o nome que aparece na lista, no Painel e no chat, para você saber de qual área está falando."
                    {...register('nome')} />
            </div>

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

            <form onSubmit={(e) => e.preventDefault()} className={styles.blocosDoFormulario}>

                <Bloco {...bloco('localizacao')} icone={MapPin} titulo={TITULO_DO_BLOCO.localizacao} descricao="Para a IA considerar o clima e a época do ano na sua região.">
                    <div className={styles.camposDoBloco}>
                        <div className={styles.linhaInteira}>
                            <Aviso tipo="info" papel={null}>
                                Digite o CEP para preencher o estado e a cidade, ou escolha os dois abaixo. A IA usa a cidade para o clima, a previsão de chuva e a época de plantio oficial (ZARC) do seu município.
                            </Aviso>
                        </div>
                        <div>
                            <Entrada rotulo="CEP" opcional id="campo-cep" placeholder="00000-000" inputMode="numeric" maxLength={9} erro={errors.cep?.message}
                                {...register('cep', { onChange: (e) => buscarCep(e.target.value) })} />
                            {statusCep && <span className={styles.statusCep} role="status">{statusCep}</span>}
                        </div>
                        {/* Trocar o estado à mão apaga a cidade, que era de outro estado */}
                        <Selecao rotulo="Estado" obrigatorio id="campo-estado" erro={errors.estado?.message}
                            {...register('estado', { onChange: () => escolherCidade({ nome: '', codigo: '' }) })}>
                            <option value="">Selecione...</option>
                            {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </Selecao>
                        <Campo rotulo="Cidade" obrigatorio id="campo-cidade" erro={errors.cidade?.message}>
                            {(ligacao) => (
                                <BuscaCidade idCampo={ligacao.id} descritoPor={ligacao['aria-describedby']} classe={ligacao.className} invalido={Boolean(errors.cidade)}
                                    uf={valores.estado} valor={valores.cidade} codigo={valores.codigoMunicipio} aoEscolher={escolherCidade} />
                            )}
                        </Campo>
                        <Entrada rotulo="Tamanho da área (hectares)" id="campo-tamanho" type="number" placeholder="Ex: 50" {...register('tamanho')} />
                        <div className={styles.linhaInteira} role="group" aria-labelledby="rotulo-ponto">
                            <span id="rotulo-ponto" className={styles.rotuloGrupo}>Ponto exato da área <span className={styles.opcionalGrupo}>(opcional)</span></span>
                            <span className={styles.dicaGrupo}>
                                Em município grande, o tempo no centro da cidade pode ser bem diferente do da sua área. Com o ponto marcado, a previsão do tempo usa o lugar exato.
                            </span>
                            <MapaDoPonto valor={valores.coordenadas?.lat != null ? (valores.coordenadas as { lat: number; lng: number }) : null} centro={centro}
                                aoMudar={(p: { lat: number; lng: number } | null) => setValue('coordenadas', p, { shouldDirty: true })} />
                        </div>
                    </div>
                </Bloco>

                <Bloco {...bloco('solo')} icone={Droplets} titulo={TITULO_DO_BLOCO.solo} descricao="Tipo de terra, acidez e drenagem: pesam na escolha da cultura e da adubação.">
                    <div className={styles.camposDoBloco}>
                        <Selecao rotulo="Tipo de Solo" id="campo-tipoSolo" erro={errors.tipoSolo?.message} {...register('tipoSolo')}
                            dica={<>Influencia a retenção de água e nutrientes. Dica: aperte um punhado de terra úmida. Se esfarela, é arenoso; se forma uma &quot;cobrinha&quot; que dobra sem quebrar, é argiloso.</>}>
                            <option value="">Selecione...</option>
                            <option value="arenoso">Arenoso (Aquece rápido, escorrega água)</option>
                            <option value="argiloso">Argiloso (Retém água e nutrientes)</option>
                            <option value="siltoso">Siltoso (Fácil erosão, muito fino)</option>
                            <option value="misto">Misto (Equilíbrio)</option>
                            <option value="nao_sei">Não sei</option>
                        </Selecao>
                        <Entrada rotulo="pH do Solo" opcional="3.5 a 9" id="campo-phSolo" type="number" step="0.1" placeholder="Ex: 6.5" erro={errors.phSolo?.message} {...register('phSolo')} />
                        <Selecao rotulo="Matéria Orgânica" id="campo-materiaOrganica" {...register('materiaOrganica')}>
                            <option value="">Não sei informar</option>
                            <option value="Baixa">Baixa</option>
                            <option value="Média">Média</option>
                            <option value="Alta">Alta</option>
                        </Selecao>
                        <Selecao rotulo="Drenagem (Escoamento da água)" id="campo-drenagem" {...register('drenagem')}>
                            <option value="">Selecione...</option>
                            <option value="Boa">Boa (Seca em tempo adequado)</option>
                            <option value="Média">Média</option>
                            <option value="Ruim">Ruim (Apoça água frequentemente)</option>
                        </Selecao>
                        <Marcar id="analiseSolo" className={styles.linhaInteira} {...register('analiseSolo')}>Possui análise de solo recente? (últimos 12 meses)</Marcar>
                    </div>
                </Bloco>

                <Bloco {...bloco('historico')} icone={History} titulo={TITULO_DO_BLOCO.historico} descricao="Culturas anteriores, forma de plantio, irrigação e desafios.">
                    <div className={styles.camposDoBloco}>
                        <div className={styles.linhaInteira}>
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
                                        <Opcoes rotulo={<>Culturas plantadas nos últimos anos <span className={styles.opcionalGrupo}>(toque para marcar)</span></>}
                                            rotuloId="rotulo-culturas" opcoes={semRepetir([...CULTURAS_COMUNS, ...marcadas])} marcadas={marcadas} alternar={alternar} />
                                        <div className={styles.linhaAcrescentar}>
                                            <input value={novaCultura} onChange={(e) => setNovaCultura(e.target.value)} placeholder="Outra cultura" aria-label="Outra cultura, que não está na lista"
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); acrescentar(); } }} className={classeDoControle(true)} />
                                            <Botao variante="neutro" icone={Plus} onClick={acrescentar}>Acrescentar</Botao>
                                        </div>
                                    </>
                                );
                            }} />
                        </div>
                        <Entrada rotulo="Tempo com as culturas atuais (anos)" id="campo-tempoCulturaAtual" type="number" placeholder="Ex: 3"
                            erro={errors.tempoCulturaAtual?.message} {...register('tempoCulturaAtual')} />
                        <Selecao rotulo="Histórico de uso de fertilizantes" id="campo-usoFertilizantes" {...register('usoFertilizantes')}>
                            <option value="">Selecione...</option>
                            <option value="Baixo">Baixo (Mais orgânico/natural)</option>
                            <option value="Médio">Médio (Uso padrão da região)</option>
                            <option value="Alto">Alto (Sistema intensivo)</option>
                        </Selecao>
                        <Selecao rotulo="Sistema de plantio" id="campo-sistemaPlantio" {...register('sistemaPlantio')}>
                            <option value="">Selecione...</option>
                            <option value="Plantio direto">Plantio direto (sem revolver o solo, sobre a palha)</option>
                            <option value="Convencional">Convencional (aração e gradagem)</option>
                            <option value="Cultivo mínimo">Cultivo mínimo (revolve pouco o solo)</option>
                            <option value="Não sei">Não sei</option>
                        </Selecao>
                        <Selecao rotulo="Irrigação" id="campo-irrigacao" {...register('irrigacao')}>
                            <option value="">Selecione...</option>
                            <option value="Não irrigo">Não irrigo (só chuva)</option>
                            <option value="Aspersão">Aspersão</option>
                            <option value="Gotejamento">Gotejamento</option>
                            <option value="Sulco ou inundação">Sulco ou inundação</option>
                            <option value="Outro">Outro</option>
                        </Selecao>
                        <div className={styles.linhaInteira}>
                            <span id="rotulo-problemas" className={styles.rotuloGrupo}>Problemas recentes observados (múltipla escolha)</span>
                            <div className={styles.grade2} style={{ gap: '1rem' }} role="group" aria-labelledby="rotulo-problemas">
                                {/* "Nenhum" exclui os demais, e marcar um problema desmarca "Nenhum". */}
                                <Controller name="problemasRecentes" control={control} render={({ field }) => {
                                    const marcados = field.value || [];
                                    const alternar = (prob: string, marcar: boolean) => {
                                        if (!marcar) return field.onChange(marcados.filter((x: string) => x !== prob));
                                        field.onChange(prob === SEM_PROBLEMAS ? [SEM_PROBLEMAS] : [...marcados.filter((x: string) => x !== SEM_PROBLEMAS), prob]);
                                    };
                                    return <>{['Queda de produtividade', 'Pragas', 'Doenças', 'Solo fraco', SEM_PROBLEMAS].map(prob => (
                                        <Marcar key={prob} checked={marcados.includes(prob)} onChange={(e) => alternar(prob, e.target.checked)}>{prob}</Marcar>
                                    ))}</>;
                                }} />
                            </div>
                        </div>
                        <div className={styles.linhaInteira} role="group" aria-labelledby="rotulo-safras">
                            <span id="rotulo-safras" className={styles.rotuloGrupo}>Linha do tempo das safras <span className={styles.opcionalGrupo}>(opcional)</span></span>
                            <span className={styles.dicaGrupo}>O que foi plantado em cada safra. Assim o assistente e o Painel mostram a rotação de verdade, na ordem.</span>
                            {safras.fields.map((campo, i) => (
                                <div key={campo.id}>
                                    <div className={styles.linhaSafra}>
                                        <select {...register(`safras.${i}.periodo`)} className={classeDoControle(true)} aria-label="Período da safra">
                                            {PERIODOS_DA_SAFRA.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
                                        </select>
                                        <select {...register(`safras.${i}.ano`, { valueAsNumber: true })} className={classeDoControle(true)} aria-label="Ano do plantio">
                                            {ANOS.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
                                        </select>
                                        <input list="culturas-sugeridas" placeholder="Cultura" {...register(`safras.${i}.cultura`)} className={classeDoControle(true)} aria-label="Cultura plantada"
                                            aria-invalid={errors.safras?.[i]?.cultura ? true : undefined} />
                                        <Botao variante="discreto" apenasIcone icone={X} rotulo="Tirar esta safra" onClick={() => safras.remove(i)} />
                                    </div>
                                    <span className={styles.rotuloSafra}>
                                        {valores.safras?.[i]?.ano ? rotuloDaSafra({ ano: valores.safras[i].ano, periodo: valores.safras[i].periodo }) : ''}
                                        {errors.safras?.[i]?.cultura && <span className={styles.erroDaLinha}>{errors.safras[i]?.cultura?.message}</span>}
                                    </span>
                                </div>
                            ))}
                            <Botao variante="neutro" tamanho="p" icone={Plus} onClick={() => safras.append({ cultura: '', ano: ANO_ATUAL, periodo: 'verao' })}>Acrescentar safra</Botao>
                        </div>
                    </div>
                </Bloco>

                <Bloco {...bloco('objetivo')} icone={Target} titulo={TITULO_DO_BLOCO.objetivo} descricao="O que pretende plantar e aonde quer chegar.">
                    <div className={styles.camposEmColuna}>
                        <Controller name="proximaCultura" control={control} render={({ field }) => (
                            <Opcoes rotulo="O que pretende plantar na próxima safra?" rotuloId="rotulo-proxima"
                                opcoes={[...semRepetir([...CULTURAS_COMUNS, ...(field.value && field.value !== AINDA_NAO_DECIDI ? [field.value] : [])]), AINDA_NAO_DECIDI]}
                                marcadas={field.value ? [field.value] : []}
                                alternar={(c: string) => field.onChange(field.value === c ? '' : c)} />
                        )} />
                        <div>
                            <span id="rotulo-metas" className={styles.rotuloGrupo}>Metas Principais (múltipla escolha)</span>
                            <div className={styles.grade2} style={{ gap: '1rem' }} role="group" aria-labelledby="rotulo-metas">
                                {['Aumentar produtividade', 'Recuperar solo', 'Reduzir custos', 'Diversificar produção', 'Transição para orgânico'].map(obj => (
                                    <Marcar key={obj} value={obj} {...register('objetivos')}>{obj}</Marcar>
                                ))}
                            </div>
                        </div>
                        <AreaTexto rotulo="Observações Adicionais" opcional id="campo-observacoes" rows={4} placeholder="Conte mais sobre sua área se desejar..." {...register('observacoes')} />
                    </div>
                </Bloco>

                <div id="plano">
                    <Bloco {...bloco('plano')} icone={ListChecks} titulo={TITULO_DO_BLOCO.plano} descricao="A sequência que você quer seguir nas próximas safras.">
                        <div className={styles.camposEmColuna} style={{ gap: '1rem' }}>
                            {etapas.fields.length === 0 && (
                                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Ainda não há plano. No chat, peça ao assistente um plano de rotação para este cultivo e toque em &quot;Salvar como plano&quot; na resposta. Ou monte as etapas aqui.
                                </p>
                            )}
                            {etapas.fields.map((campo, i) => (
                                <div key={campo.id} className={styles.etapaPlano}>
                                    <label className={styles.etapaFeita} title="Marque quando esta etapa já tiver sido plantada">
                                        <input type="checkbox" {...register(`plano.etapas.${i}.feita`)} /> Feita
                                    </label>
                                    <input placeholder="Quando (ex.: Safra 2025/26)" {...register(`plano.etapas.${i}.quando`)} className={classeDoControle(true)} aria-label="Quando" />
                                    <input list="culturas-sugeridas" placeholder="Cultura" {...register(`plano.etapas.${i}.cultura`)} className={classeDoControle(true)} aria-label="Cultura"
                                        aria-invalid={errors.plano?.etapas?.[i]?.cultura ? true : undefined} />
                                    <input placeholder="Para quê (ex.: fixar nitrogênio)" {...register(`plano.etapas.${i}.objetivo`)} className={classeDoControle(true)} aria-label="Objetivo da etapa" />
                                    <Botao variante="discreto" apenasIcone icone={X} rotulo="Tirar esta etapa" onClick={() => etapas.remove(i)} />
                                    {errors.plano?.etapas?.[i]?.cultura && <span className={styles.erroDaLinha}>{errors.plano.etapas[i]?.cultura?.message}</span>}
                                </div>
                            ))}
                            <Botao variante="neutro" tamanho="p" icone={Plus} style={{ alignSelf: 'flex-start' }} onClick={() => etapas.append({ quando: '', cultura: '', objetivo: '', feita: false })}>Acrescentar etapa</Botao>
                        </div>
                    </Bloco>
                </div>

                {/* Sugestões de cultura das safras e do plano (fica fora dos blocos, que abrem e fecham) */}
                <datalist id="culturas-sugeridas">
                    {CULTURAS_COMUNS.map((c) => <option key={c} value={c} />)}
                </datalist>

                {/* Presa ao pé da tela, para salvar sem rolar o formulário inteiro */}
                <BarraDeAcoes mensagem={message} erro={messageErro}>
                    <Botao variante="secundario" tamanho="g" pilula disabled={saving} onClick={handleSubmit((d) => onSubmit(d, false), abrirPrimeiroErro)}>
                        {id ? 'Salvar' : 'Cadastrar'}
                    </Botao>
                    <Botao tamanho="g" pilula carregando={saving} textoCarregando="Salvando..." onClick={handleSubmit((d) => onSubmit(d, true), abrirPrimeiroErro)}>
                        <TextoAdaptavel longo="Salvar e pedir análise à IA" curto="Salvar e analisar" />
                    </Botao>
                </BarraDeAcoes>
            </form>

            {id && <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {!confirmandoApagar ? (
                    <Botao variante="perigoDiscreto" tamanho="p" icone={Trash2} ref={excluirRef} onClick={() => setConfirmandoApagar(true)}>
                        Excluir este cultivo
                    </Botao>
                ) : (
                    <ConfirmarNaTela pergunta="Excluir este cultivo? Sua conta e suas conversas continuam." rotuloConfirmar="Excluir" textoOcupado="Excluindo..."
                        aoConfirmar={excluirCultivo} aoCancelar={() => { setConfirmandoApagar(false); requestAnimationFrame(() => excluirRef.current?.focus()); }} />
                )}
            </div>}
        </div>
    );
}
