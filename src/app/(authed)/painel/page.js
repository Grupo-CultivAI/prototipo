import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sprout, MessageCircle, MessagesSquare, ClipboardCheck, MapPin, CalendarDays, CloudSun, Repeat, ArrowRight } from 'lucide-react';
import dbConnect from '@/lib/mongodb';
import { getUserIdFromToken } from '@/lib/auth';
import { LIMITE_POR_DIA, perguntasDeHoje } from '@/lib/limites';
import { ITENS_DO_PERFIL, itensFaltando, tamanhoEmTexto } from '@/lib/perfil';
import { calendarioDePlantio, codigoDoMunicipio } from '@/lib/zarc';
import { cultivosDoUsuario, nomeDoCultivo } from '@/lib/cultivos';
import User from '@/models/User';
import Conversa from '@/models/Conversa';
import ChatMessage from '@/models/ChatMessage';
import MapaPropriedade from './MapaPropriedade';
import CalendarioPlantio from './CalendarioPlantio';
import Previsao from './Previsao';
import styles from './painel.module.css';

// Painel: a tela de entrada depois do login. Mostra os cultivos no mapa e, do cultivo escolhido
// (?cultivo=id; sem ele, o primeiro), a época de plantio, a chuva e a rotação, além do uso do
// assistente. Leva a Meus Cultivos quem ainda não cadastrou nada.

export const metadata = { title: 'Painel · CultivAI' };

const CONVERSAS_RECENTES = 3;
const SEM_CULTURA = ['Nenhum', 'Ainda não decidi'];

// Para quem ainda não cadastrou a cidade ver o que o calendário mostra. Janelas inventadas,
// parecidas com as do Cerrado (36 decêndios: 1 = 1 a 10 de janeiro).
const riscosDeExemplo = (faixas) => Array.from({ length: 36 }, (_, i) => faixas.find(([ini, fim]) => i + 1 >= ini && i + 1 <= fim)?.[2] ?? 0);
const CALENDARIO_DE_EXEMPLO = [
    { cultura: 'Milho', manejo: 'sequeiro', proxima: true, riscos: riscosDeExemplo([[29, 29, 30], [30, 36, 20], [1, 1, 30], [2, 2, 40]]) },
    { cultura: 'Feijão', manejo: 'sequeiro', proxima: false, riscos: riscosDeExemplo([[2, 6, 20], [7, 7, 30], [8, 8, 40]]) },
];

function saudacao() {
    const hora = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

const hojePorExtenso = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

const quando = (data) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(data);

// Atalhos para o chat: a pergunta fica pronta no campo, e a pessoa decide se envia.
function perguntasSugeridas(p) {
    const lista = [];
    // Meus Cultivos guarda as culturas na ordem em que foram marcadas, não por ano.
    const plantadas = (p?.culturasHistorico ?? []).filter((c) => !SEM_CULTURA.includes(c)).slice(0, 2).map((c) => c.toLowerCase());
    const proxima = SEM_CULTURA.includes(p?.proximaCultura) ? null : p?.proximaCultura;
    if (proxima) lista.push(`Quando é a melhor época para plantar ${proxima.toLowerCase()} na minha cidade?`);
    if (plantadas.length) lista.push(`O que plantar depois de ${plantadas.join(' e ')}?`);
    lista.push('Como melhorar a fertilidade do meu solo com adubação verde?');
    if (!proxima) lista.push('Que rotação de culturas você recomenda para a minha área?');
    return lista.slice(0, 3);
}

// A conversa aberta pelo atalho é sobre o cultivo escolhido no Painel.
const linkPergunta = (texto, cultivoId) => `/chatbot?pergunta=${encodeURIComponent(texto)}${cultivoId ? `&cultivo=${cultivoId}` : ''}`;

function Cartao({ icone: Icone, titulo, acao, children, className = '' }) {
    return (
        <section className={`${styles.cartao} ${className}`}>
            <header className={styles.cartaoTopo}>
                <h2><Icone size={20} aria-hidden="true" /> {titulo}</h2>
                {acao}
            </header>
            {children}
        </section>
    );
}

function Numero({ icone: Icone, valor, rotulo, detalhe, progresso }) {
    return (
        <li className={styles.numero}>
            <span className={styles.numeroIcone}><Icone size={20} aria-hidden="true" /></span>
            <strong>{valor}</strong>
            <span className={styles.numeroRotulo}>{rotulo}</span>
            {progresso !== undefined && (
                <span className={styles.barra} aria-hidden="true"><span style={{ width: `${Math.round(progresso * 100)}%` }} /></span>
            )}
            {detalhe && <span className={styles.numeroDetalhe}>{detalhe}</span>}
        </li>
    );
}

export default async function Painel({ searchParams }) {
    const userId = await getUserIdFromToken();
    if (!userId) redirect('/login');
    const { cultivo: escolhido } = await searchParams;

    await dbConnect();
    const [user, cultivos, totalConversas, totalPerguntas, feitasHoje, recentes] = await Promise.all([
        User.findById(userId).select('nome').lean(),
        cultivosDoUsuario(userId),
        Conversa.countDocuments({ userId, perguntas: { $gt: 0 } }),
        ChatMessage.countDocuments({ userId, sender: 'user' }),
        perguntasDeHoje(userId),
        Conversa.find({ userId, perguntas: { $gt: 0 } }).sort({ ultimaMensagemEm: -1 }).limit(CONVERSAS_RECENTES)
            .select('titulo perguntas ultimaMensagemEm createdAt').lean(),
    ]);
    // Conta excluída com o cookie ainda válido (ver src/proxy.ts)
    if (!user) redirect('/login');

    const selecionado = cultivos.find((c) => String(c._id) === escolhido) ?? cultivos[0] ?? null;
    const p = selecionado ?? {};
    const idSelecionado = selecionado ? String(selecionado._id) : null;
    const nome = selecionado ? nomeDoCultivo(selecionado) : null;
    const editar = selecionado ? `/meus-cultivos/${idSelecionado}` : '/meus-cultivos/novo';
    const totalCulturas = new Set(cultivos.flatMap((c) => (c.culturasHistorico ?? []).filter((x) => !SEM_CULTURA.includes(x)))).size;
    const culturas = (p.culturasHistorico ?? []).filter((c) => !SEM_CULTURA.includes(c));
    const proxima = SEM_CULTURA.includes(p.proximaCultura) ? null : p.proximaCultura || null;
    const temLocal = Boolean(p.cidade && p.estado);
    const semCadastro = cultivos.length === 0;
    const faltando = itensFaltando(p);
    const completo = (ITENS_DO_PERFIL.length - faltando.length) / ITENS_DO_PERFIL.length;
    const restantes = Math.max(0, LIMITE_POR_DIA - feitasHoje);
    // O mapa mostra todos os cultivos; o código do IBGE dos perfis antigos vem do ZARC, pelo nome.
    const [calendario, codigos] = await Promise.all([
        temLocal ? calendarioDePlantio(p) : null,
        Promise.all(cultivos.map(codigoDoMunicipio)),
    ]);
    const pontos = cultivos.map((c, i) => ({ c, codigo: codigos[i] })).filter(({ c }) => c.cidade && c.estado).map(({ c, codigo }) => ({
        uf: String(c.estado).toUpperCase(),
        codigo,
        rotulo: `${nomeDoCultivo(c)} (${c.cidade}/${String(c.estado).toUpperCase()})`,
        ativo: c === selecionado,
    }));
    const local = temLocal ? `${p.cidade}/${String(p.estado).toUpperCase()}` : null;
    const primeiroNome = String(user.nome ?? '').trim().split(/\s+/)[0];

    return (
        <div className={styles.painel}>
            <header className={styles.cabecalho}>
                <div>
                    <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
                    <p className={styles.subtitulo}>
                        <span className={styles.data}>{hojePorExtenso()}</span>
                        {local && <> · <MapPin size={14} aria-hidden="true" /> {local}</>}
                    </p>
                </div>
                <Link href="/chatbot" className={styles.botaoPrincipal}>
                    <MessageCircle size={18} aria-hidden="true" /> Perguntar ao assistente
                </Link>
            </header>

            {semCadastro ? (
                <section className={styles.boasVindas}>
                    <div>
                        <h2>Cadastre o seu primeiro cultivo para montar o seu painel</h2>
                        <p>Conte onde fica a sua área e o que você plantou nos últimos anos. Leva poucos minutos e, com isso, o CultivAI passa a mostrar aqui:</p>
                        <ul>
                            <li><CalendarDays size={18} aria-hidden="true" /> a época oficial de plantio (ZARC) de cada cultura na sua cidade;</li>
                            <li><CloudSun size={18} aria-hidden="true" /> a chuva prevista para os próximos dias;</li>
                            <li><Repeat size={18} aria-hidden="true" /> a sua rotação de culturas, e respostas do assistente feitas para a sua terra.</li>
                        </ul>
                        <div className={styles.botoes}>
                            <Link href="/meus-cultivos/novo" className={styles.botaoClaro}>Cadastrar meu cultivo <ArrowRight size={18} aria-hidden="true" /></Link>
                            <Link href="/chatbot" className={styles.linkClaro}>Ou faça uma pergunta agora</Link>
                        </div>
                    </div>
                    <Sprout size={120} strokeWidth={1.2} aria-hidden="true" className={styles.boasVindasIcone} />
                </section>
            ) : faltando.length > 0 && (
                <p className={styles.lembrete}>
                    O cultivo {nome} está {Math.round(completo * 100)}% completo. Falta informar: {faltando.map((i) => i.rotulo).join(', ')}.{' '}
                    <Link href={editar}>Completar o cultivo</Link>
                </p>
            )}

            <ul className={styles.numeros}>
                <Numero icone={Sprout} valor={cultivos.length} rotulo={cultivos.length === 1 ? 'cultivo cadastrado' : 'cultivos cadastrados'}
                    detalhe={cultivos.length ? `${totalCulturas} ${totalCulturas === 1 ? 'cultura' : 'culturas'} ao todo` : 'Nenhum ainda'} />
                <Numero icone={MessageCircle} valor={`${restantes} de ${LIMITE_POR_DIA}`} rotulo="perguntas restantes hoje"
                    progresso={restantes / LIMITE_POR_DIA} detalhe="Renova à meia-noite" />
                <Numero icone={MessagesSquare} valor={totalConversas} rotulo={totalConversas === 1 ? 'conversa' : 'conversas'}
                    detalhe={`${totalPerguntas} ${totalPerguntas === 1 ? 'pergunta feita' : 'perguntas feitas'} ao todo`} />
                <Numero icone={ClipboardCheck} valor={`${Math.round(completo * 100)}%`} rotulo={nome ? `do perfil de ${nome}` : 'do perfil preenchido'}
                    progresso={completo} detalhe={faltando.length ? `Faltam ${faltando.length} ${faltando.length === 1 ? 'item' : 'itens'}` : 'Tudo preenchido'} />
            </ul>

            {cultivos.length > 1 && (
                <nav className={styles.seletor} aria-label="Escolher o cultivo">
                    <span>Mostrando:</span>
                    {cultivos.map((c) => (
                        <Link key={String(c._id)} href={`/painel?cultivo=${c._id}`} aria-current={c === selecionado ? 'true' : undefined}>
                            {nomeDoCultivo(c)}
                        </Link>
                    ))}
                </nav>
            )}

            <div className={styles.grade}>
                <Cartao icone={MapPin} titulo={cultivos.length > 1 ? 'Seus cultivos' : 'Sua propriedade'} className={styles.cartaoMapa}
                    acao={<Link href={editar} className={styles.linkCartao}>{temLocal ? 'Editar' : 'Informar'}</Link>}>
                    <MapaPropriedade pontos={pontos} />
                    {nome && <h3 className={styles.subtituloCartao}>{nome}</h3>}
                    {temLocal ? (
                        <dl className={styles.ficha}>
                            <div><dt>Local</dt><dd>{local}</dd></div>
                            {p.tamanho && <div><dt>Tamanho</dt><dd>{tamanhoEmTexto(p.tamanho)}</dd></div>}
                            {p.tipoSolo && <div><dt>Solo</dt><dd>{p.tipoSolo === 'nao_sei' ? 'não sei' : p.tipoSolo}</dd></div>}
                            {p.irrigacao && <div><dt>Irrigação</dt><dd>{p.irrigacao}</dd></div>}
                            {p.sistemaPlantio && <div><dt>Plantio</dt><dd>{p.sistemaPlantio}</dd></div>}
                        </dl>
                    ) : (
                        <p className={styles.vazio}>
                            Informe a cidade da sua área para ela aparecer no mapa. <Link href={editar}>{selecionado ? 'Editar o cultivo' : 'Cadastrar um cultivo'}</Link>
                        </p>
                    )}
                </Cartao>

                <Cartao icone={CalendarDays} titulo={nome && cultivos.length > 1 ? `Época de plantio (ZARC) · ${nome}` : 'Época de plantio (ZARC)'} className={styles.cartaoCalendario}>
                    {!temLocal ? (
                        <>
                            <p className={styles.vazio}>
                                Com a cidade e as culturas cadastradas, aqui aparece o calendário oficial de plantio do Ministério da Agricultura
                                para cada cultura, com o risco de perda por clima. <Link href={editar}>{selecionado ? 'Informar a cidade' : 'Cadastrar'}</Link>
                            </p>
                            <div className={styles.exemplo} aria-label="Exemplo de calendário">
                                <p>Exemplo</p>
                                <CalendarioPlantio linhas={CALENDARIO_DE_EXEMPLO} />
                            </div>
                        </>
                    ) : !calendario ? (
                        <p className={styles.vazio}>O calendário de plantio não está disponível agora. Tente de novo mais tarde.</p>
                    ) : !calendario.encontrado ? (
                        <p className={styles.vazio}>
                            Não encontramos {calendario.local} entre os municípios do ZARC. <Link href={editar}>Confira a cidade do cultivo</Link>
                        </p>
                    ) : !calendario.linhas.length ? (
                        <p className={styles.vazio}>
                            {culturas.length || proxima
                                ? `O ZARC não tem calendário para ${[proxima, ...culturas].filter(Boolean).join(', ')}.`
                                : 'Escolha as culturas do cultivo para ver as janelas de plantio.'}{' '}
                            <Link href={editar}>Editar o cultivo</Link>
                        </p>
                    ) : (
                        <>
                            <p className={styles.calendarioLocal}>
                                {calendario.local} · {calendario.solo ? `solo ${calendario.solo}` : 'tipo de solo não informado: mostra o melhor caso'}
                            </p>
                            <CalendarioPlantio linhas={calendario.linhas} />
                            {calendario.semZarc.length > 0 && (
                                <p className={styles.nota}>Sem calendário no ZARC: {calendario.semZarc.join(', ')}.</p>
                            )}
                            <p className={styles.nota}>
                                Fonte: ZARC, Ministério da Agricultura. Para contratar Proagro ou seguro rural, confirme no aplicativo Zarc Plantio Certo.
                            </p>
                        </>
                    )}
                </Cartao>

                {temLocal && (
                    <Cartao icone={CloudSun} titulo={`Previsão do tempo em ${p.cidade}`} className={styles.cartaoLargo}>
                        <Suspense fallback={<p className={styles.vazio}>Carregando a previsão...</p>}>
                            <Previsao cidade={p.cidade} />
                        </Suspense>
                    </Cartao>
                )}

                <Cartao icone={Repeat} titulo={nome && cultivos.length > 1 ? `Rotação · ${nome}` : 'Sua rotação'}
                    acao={<Link href={editar} className={styles.linkCartao}>Editar</Link>}>
                    {culturas.length || proxima ? (
                        <>
                            {culturas.length > 0 && (
                                <>
                                    <h3 className={styles.subtituloCartao}>Plantadas nos últimos anos</h3>
                                    <ul className={styles.rotacao}>
                                        {culturas.map((c) => <li key={c}>{c}</li>)}
                                    </ul>
                                </>
                            )}
                            {proxima && (
                                <>
                                    <h3 className={styles.subtituloCartao}>Próxima cultura</h3>
                                    <ul className={styles.rotacao}>
                                        <li className={styles.rotacaoProxima}><Sprout size={16} aria-hidden="true" /> {proxima}</li>
                                    </ul>
                                </>
                            )}
                            {!proxima && <p className={styles.vazio}>Ainda não sabe o que plantar depois? <Link href={linkPergunta('Que rotação de culturas você recomenda para a minha área?', idSelecionado)}>Peça uma sugestão ao assistente</Link></p>}
                        </>
                    ) : (
                        <p className={styles.vazio}>Cadastre as culturas dos últimos anos para acompanhar a sua rotação. <Link href={editar}>{selecionado ? 'Editar o cultivo' : 'Cadastrar'}</Link></p>
                    )}
                </Cartao>

                <Cartao icone={MessagesSquare} titulo="Assistente"
                    acao={<Link href={idSelecionado ? `/chatbot?cultivo=${idSelecionado}` : '/chatbot'} className={styles.linkCartao}>Abrir</Link>}>
                    {recentes.length > 0 && (
                        <>
                            <h3 className={styles.subtituloCartao}>Continue de onde parou</h3>
                            <ul className={styles.conversas}>
                                {recentes.map((c) => (
                                    <li key={String(c._id)}>
                                        <Link href={`/chatbot?conversa=${c._id}`}>
                                            <span className={styles.conversaTitulo}>{c.titulo || 'Conversa sem título'}</span>
                                            <span className={styles.conversaDetalhe}>
                                                {quando(c.ultimaMensagemEm ?? c.createdAt)} · {c.perguntas} {c.perguntas === 1 ? 'pergunta' : 'perguntas'}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    <h3 className={styles.subtituloCartao}>Sugestões de pergunta</h3>
                    <ul className={styles.sugestoes}>
                        {perguntasSugeridas(p).map((texto) => (
                            <li key={texto}><Link href={linkPergunta(texto, idSelecionado)}>{texto}</Link></li>
                        ))}
                    </ul>
                </Cartao>
            </div>
        </div>
    );
}
