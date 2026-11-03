import { redirect } from 'next/navigation';
import mongoose from 'mongoose';
import { Plus, MapPin, Pencil, Copy, MessageCircle, LayoutDashboard, CalendarDays, Sprout, History, ListChecks } from 'lucide-react';
import dbConnect from '@/lib/mongodb';
import { getUserIdFromToken } from '@/lib/auth';
import { cultivosDoUsuario, nomeDoCultivo, LIMITE_DE_CULTIVOS } from '@/lib/cultivos';
import { calendarioDePlantio } from '@/lib/zarc';
import { emDias, situacaoDaJanela } from '@/lib/janelaDePlantio';
import { ITENS_DO_PERFIL, itensFaltando, tamanhoEmTexto, ordenarSafras, rotuloDaSafra, proximaEtapa } from '@/lib/perfil';
import { DIAS_PARA_AVISAR_FECHAMENTO } from '@/lib/avisos';
import Conversa from '@/models/Conversa';
import Botao from '@/components/ui/Botao';
import Aviso from '@/components/ui/Aviso';
import ExcluirCultivo from './ExcluirCultivo';
import styles from './cultivos.module.css';

// Meus Cultivos: as áreas do produtor (sítio, talhão, lote), cada uma com cidade, solo e
// culturas próprias. Cada cartão leva a editar, perguntar ao assistente sobre aquele cultivo
// (a conversa usa o perfil dele) e ver o cultivo no Painel.

export const metadata = { title: 'Meus Cultivos · CultivAI' };

const SEM_CULTURA = ['Nenhum', 'Ainda não decidi'];
const LINHAS_DE_EPOCA = 2;
const SOLO = { arenoso: 'Solo arenoso', argiloso: 'Solo argiloso', siltoso: 'Solo siltoso', misto: 'Solo misto' };

// As janelas do ZARC de hoje, em até duas linhas (a próxima cultura primeiro).
async function epocaDoCultivo(cultivo) {
    if (!cultivo.cidade || !cultivo.estado) return { aviso: 'Informe a cidade para ver a época de plantio.' };
    const calendario = await calendarioDePlantio(cultivo);
    if (!calendario) return null;
    if (!calendario.encontrado) return { aviso: `Não encontramos ${calendario.local} no ZARC. Confira a cidade.` };
    if (!calendario.linhas.length) return { aviso: 'Escolha as culturas para ver a época de plantio.' };
    return {
        linhas: calendario.linhas.slice(0, LINHAS_DE_EPOCA).map((l) => {
            const s = situacaoDaJanela(l.riscos);
            const fechaLogo = s.agora && s.fechaEmDias != null && s.fechaEmDias <= DIAS_PARA_AVISAR_FECHAMENTO;
            const texto = s.texto.charAt(0).toLowerCase() + s.texto.slice(1) + (fechaLogo ? `. Fecha ${emDias(s.fechaEmDias)}!` : '');
            return { cultura: l.cultura, agora: s.agora, fechaLogo, texto };
        }),
    };
}

export default async function MeusCultivos({ searchParams }) {
    const userId = await getUserIdFromToken();
    if (!userId) redirect('/login');
    const aviso = await searchParams;

    await dbConnect();
    const [cultivos, conversas] = await Promise.all([
        cultivosDoUsuario(userId),
        Conversa.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), perguntas: { $gt: 0 }, propriedadeId: { $ne: null } } },
            { $group: { _id: '$propriedadeId', total: { $sum: 1 } } },
        ]),
    ]);
    const conversasDe = new Map(conversas.map((c) => [String(c._id), c.total]));
    const epocas = await Promise.all(cultivos.map(epocaDoCultivo));

    return (
        <div className={styles.pagina}>
            <header className={styles.cabecalho}>
                <div>
                    <h1>Meus Cultivos</h1>
                    <p>Cada área que você planta, com a cidade, o solo e as culturas dela. O assistente usa esses dados para responder sobre cada uma.</p>
                </div>
                {cultivos.length < LIMITE_DE_CULTIVOS && (
                    <Botao href="/meus-cultivos/novo" pilula icone={Plus} className={styles.botaoCadastrar}>Cadastrar cultivo</Botao>
                )}
            </header>

            {aviso?.salvo && <Aviso tipo="sucesso">Cultivo salvo.</Aviso>}
            {aviso?.excluido && <Aviso tipo="sucesso">Cultivo excluído.</Aviso>}

            {cultivos.length === 0 ? (
                <section className={styles.vazio}>
                    <Sprout size={48} strokeWidth={1.5} aria-hidden="true" />
                    <h2>Você ainda não cadastrou nenhum cultivo</h2>
                    <p>
                        Cadastre cada área que você planta: um sítio, um talhão, um lote. Com a cidade e as culturas, o CultivAI mostra a
                        época oficial de plantio, a chuva prevista e responde pensando na realidade de cada uma.
                    </p>
                    <Botao href="/meus-cultivos/novo" pilula icone={Plus}>Cadastrar o primeiro cultivo</Botao>
                </section>
            ) : (
                <ul className={styles.lista}>
                    {cultivos.map((c, i) => {
                        const id = String(c._id);
                        const nome = nomeDoCultivo(c);
                        const culturas = (c.culturasHistorico ?? []).filter((x) => !SEM_CULTURA.includes(x));
                        const proxima = SEM_CULTURA.includes(c.proximaCultura) ? null : c.proximaCultura || null;
                        const faltando = itensFaltando(c);
                        const completo = Math.round(((ITENS_DO_PERFIL.length - faltando.length) / ITENS_DO_PERFIL.length) * 100);
                        const totalConversas = conversasDe.get(id) ?? 0;
                        const epoca = epocas[i];
                        const ultimaSafra = ordenarSafras(c.safras).at(-1);
                        const etapa = proximaEtapa(c.plano);
                        const etapasFeitas = (c.plano?.etapas ?? []).filter((e) => e.feita).length;
                        const detalhes = [
                            c.tamanho && tamanhoEmTexto(c.tamanho),
                            SOLO[c.tipoSolo],
                            c.irrigacao && (c.irrigacao === 'Não irrigo' ? 'Sem irrigação' : `Irrigação: ${c.irrigacao.toLowerCase()}`),
                        ].filter(Boolean);
                        return (
                            <li key={id} className={styles.cartao}>
                                <div className={styles.cartaoTopo}>
                                    <div>
                                        <h2>{nome}</h2>
                                        <p className={styles.local}>
                                            <MapPin size={15} aria-hidden="true" />
                                            {c.cidade && c.estado ? `${c.cidade}/${String(c.estado).toUpperCase()}` : 'Cidade não informada'}
                                        </p>
                                    </div>
                                    <Botao href={`/meus-cultivos/${id}`} variante="neutro" tamanho="p" icone={Pencil}>Editar</Botao>
                                </div>

                                {detalhes.length > 0 && <p className={styles.detalhes}>{detalhes.join(' · ')}</p>}

                                {(culturas.length > 0 || proxima) && (
                                    <ul className={styles.culturas} aria-label="Culturas">
                                        {proxima && <li className={styles.proxima}><Sprout size={14} aria-hidden="true" /> Próxima: {proxima}</li>}
                                        {culturas.map((cultura) => <li key={cultura}>{cultura}</li>)}
                                    </ul>
                                )}

                                {(ultimaSafra || c.plano?.etapas?.length > 0) && (
                                    <ul className={styles.extras}>
                                        {ultimaSafra && (
                                            <li><History size={15} aria-hidden="true" /> Última safra: <strong>{ultimaSafra.cultura}</strong> ({rotuloDaSafra(ultimaSafra)})</li>
                                        )}
                                        {c.plano?.etapas?.length > 0 && (
                                            <li>
                                                <ListChecks size={15} aria-hidden="true" />
                                                {etapa
                                                    ? <>Plano: próxima etapa <strong>{etapa.cultura}</strong>{etapa.quando ? ` (${etapa.quando})` : ''} · {etapasFeitas} de {c.plano.etapas.length} feitas</>
                                                    : 'Plano de rotação concluído'}
                                            </li>
                                        )}
                                    </ul>
                                )}

                                {epoca && (
                                    <div className={styles.epoca}>
                                        <CalendarDays size={16} aria-hidden="true" />
                                        {epoca.aviso ? <span>{epoca.aviso}</span> : (
                                            <ul>
                                                {epoca.linhas.map((l) => (
                                                    <li key={l.cultura} className={l.fechaLogo ? styles.fechaLogo : l.agora ? styles.agora : undefined}><strong>{l.cultura}:</strong> {l.texto}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                <div className={styles.perfil}>
                                    <span>Perfil {completo}% preenchido{faltando.length ? ` · falta: ${faltando.slice(0, 2).map((x) => x.rotulo).join(', ')}${faltando.length > 2 ? '...' : ''}` : ''}</span>
                                    <span className={styles.barra} aria-hidden="true"><span style={{ width: `${completo}%` }} /></span>
                                </div>

                                <div className={styles.acoes}>
                                    <Botao href={`/chatbot?cultivo=${id}`} variante="secundario" tamanho="p" icone={MessageCircle}>Perguntar sobre este cultivo</Botao>
                                    <Botao href={`/painel?cultivo=${id}`} variante="neutro" tamanho="p" icone={LayoutDashboard}>Ver no Painel</Botao>
                                    {cultivos.length < LIMITE_DE_CULTIVOS && (
                                        <Botao href={`/meus-cultivos/novo?copiar=${id}`} variante="neutro" tamanho="p" icone={Copy} title="Novo cultivo com a mesma localização, solo e manejo">Duplicar</Botao>
                                    )}
                                    <span className={styles.conversas}>{totalConversas} {totalConversas === 1 ? 'conversa' : 'conversas'}</span>
                                    <ExcluirCultivo id={id} nome={nome} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
