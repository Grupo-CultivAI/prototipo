"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import { useRouter } from "next/navigation";
import Link from "next/link";
import DynamicForm from "@/components/DynamicForm";
import ContadorPerguntas from "@/components/ContadorPerguntas";
import { Copy, Check, Trash2, MessageSquarePlus, Printer, Mic, ThumbsUp, ThumbsDown, History, Volume2, Square } from "lucide-react";
import styles from "../paginas.module.css";
import { itensFaltando, CHAVE_PEDIR_ANALISE, PERGUNTA_DE_ANALISE } from "@/lib/perfil";

// Se a resposta veio só de prática geral, listar os documentos consultados sugeriria uma
// fonte que não foi usada. Por isso as fontes só aparecem quando o texto cita a Embrapa.
const citouEmbrapa = (texto) => /segundo a embrapa/i.test(texto || "");

// O título vem do catálogo (src/lib/documentos.json); sem ele, o nome do arquivo arrumado.
const rotuloFonte = (fonte) => {
  const arquivo = typeof fonte === "string" ? fonte : fonte?.fonte;
  if (!arquivo) return null;
  const nome = fonte?.titulo || String(arquivo).replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const paginas = Array.isArray(fonte?.paginas) && fonte.paginas.length ? ` (p. ${fonte.paginas.join(", ")} do PDF)` : "";
  const titulo = nome.charAt(0).toUpperCase() + nome.slice(1);
  if (/^https:\/\//.test(fonte?.url || "")) {
    return <><a href={fonte.url} target="_blank" rel="noopener noreferrer">{titulo}</a>{paginas}</>;
  }
  return titulo + paginas;
};

// Por que a busca na base da Embrapa não aconteceu (metadata.busca.falha, em /api/llm).
const MOTIVO_SEM_BASE = {
  cota: "a cota mensal gratuita da busca acabou e volta no início do próximo mês. Ela usa só conhecimento geral de agronomia.",
  limite: "muitas buscas ao mesmo tempo. Ela usa só conhecimento geral de agronomia; pergunte de novo em um minuto para a resposta com os documentos.",
  erro: "a busca nos documentos está fora do ar no momento. Ela usa só conhecimento geral de agronomia; tente de novo mais tarde.",
};

// Só respostas gravadas no banco (id do MongoDB) podem ser avaliadas; a saudação inicial e
// as mensagens de erro não têm id.
const respostaGravada = (msg) => msg.sender === "bot" && /^[a-f0-9]{24}$/.test(String(msg.id));

// Atalhos para a primeira pergunta, montados com o que o produtor contou no Meu Cultivo.
function sugestoesDePergunta(p) {
  const cultura = (p?.culturasHistorico || []).find((c) => c && c !== "Nenhum");
  const lugar = p?.cidade ? ` em ${p.cidade}` : "";
  const proxima = p?.proximaCultura && p.proximaCultura !== "Ainda não decidi" ? p.proximaCultura : null;
  const praga = (p?.problemasRecentes || []).some((x) => /praga|nemat|doen/i.test(x));
  return [
    proxima && cultura ? `Plantar ${proxima.toLowerCase()} depois de ${cultura.toLowerCase()} é uma boa rotação${lugar}?`
      : cultura ? `O que plantar depois de ${cultura.toLowerCase()}${lugar}?` : "Como começar a rotação de culturas numa área pequena?",
    p?.tipoSolo && p.tipoSolo !== "nao_sei" ? `Que adubo verde ajuda a recuperar solo ${p.tipoSolo}?` : "Que adubo verde ajuda a recuperar o solo?",
    praga ? "Como a rotação ajuda a controlar pragas e doenças?" : "Como a rotação ajuda a controlar nematoides?",
  ];
}

const SAUDACAO = "Olá! Sou o CultivAI, seu assistente agrícola especializado. Como posso ajudar nas suas colheitas hoje?";
const conversaNova = () => [{ id: crypto.randomUUID(), text: SAUDACAO, sender: "bot" }];

// "hoje", "ontem" ou a data, para a lista de conversas.
function quando(data) {
  const d = new Date(data);
  const dias = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}

// A conversa aberta fica guardada neste navegador, para voltar a ela ao recarregar a página.
// Um id que não é da pessoa (outra conta no mesmo navegador) é ignorado pela API.
const CHAVE_CONVERSA_ABERTA = "cultivai:conversaAberta";
const lerConversaAberta = () => {
  try { return localStorage.getItem(CHAVE_CONVERSA_ABERTA); } catch { return null; }
};

const reconhecimentoDeVoz = () => typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const sinteseDeFala = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

// A resposta vem em markdown: a leitura em voz alta pula os símbolos e emojis, e vira
// frases curtas. O Chrome interrompe falas longas (cerca de 15 segundos) sem avisar;
// em pedaços, cada fala termina antes disso.
function frasesParaFala(markdown) {
  return String(markdown || "")
    .split("\n")
    .map((linha) => linha
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
      .replace(/[*_`#>|]+/g, "")
      .replace(/\p{Extended_Pictographic}|️/gu, "")
      .replace(/\s*→\s*/g, ", depois ")
      .replace(/\s+/g, " ")
      .trim())
    .filter((linha) => /[\p{L}\d]/u.test(linha))
    .flatMap((linha) => (/[.!?:;]$/.test(linha) ? linha : `${linha}.`).match(/[^.!?]+(?:[.!?]+|$)/g) || [])
    .flatMap(quebrarFraseLonga)
    .map((frase) => frase.trim())
    .filter(Boolean);
}

// Frase com mais de ~10 segundos de fala é dividida nas vírgulas.
const MAXIMO_POR_FALA = 160;
function quebrarFraseLonga(frase) {
  if (frase.length <= MAXIMO_POR_FALA) return [frase];
  const pedacos = [];
  let atual = "";
  for (const parte of frase.split(/(?<=[,;])\s+/)) {
    if (atual && (atual + " " + parte).length > MAXIMO_POR_FALA) {
      pedacos.push(atual);
      atual = parte;
    } else {
      atual = atual ? `${atual} ${parte}` : parte;
    }
  }
  return atual ? [...pedacos, atual] : pedacos;
}

export default function ChatCultivAI() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [propriedade, setPropriedade] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [restantes, setRestantes] = useState(null);
  // Limite diário (renova à meia-noite), vindo da API (RATE_LIMIT_PER_DAY; padrão 40)
  const [limiteDiario, setLimiteDiario] = useState(40);
  // Conversa aberta. null até a primeira pergunta de quem nunca usou o chat: a API cria.
  const [conversaId, setConversaId] = useState(null);
  // Lista das conversas guardadas: null enquanto não foi aberta.
  const [conversas, setConversas] = useState(null);
  const [listaAberta, setListaAberta] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  // O reconhecimento de fala do navegador funciona no Chrome e no Edge (inclusive no Android),
  // sem custo. Onde não existe, o botão do microfone não aparece.
  const [temVoz] = useState(() => !!reconhecimentoDeVoz());
  // Leitura das respostas em voz alta, pela voz do próprio aparelho (sem custo e sem internet).
  const [temFala] = useState(() => !!sinteseDeFala());
  const [falandoId, setFalandoId] = useState(null);
  const falaRef = useRef(0);
  const reconhecimentoRef = useRef(null);
  const enviarRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const resUser = await fetch('/api/user');
        if (resUser.ok) {
          const dataU = await resUser.json();
          setUser(dataU.user);
        } else {
          router.push('/login');
          return;
        }

        const resProp = await fetch('/api/propriedade');
        if (resProp.ok) {
          const dataP = await resProp.json();
          setPropriedade(dataP.propriedade);
        }

        const aberta = lerConversaAberta();
        const resHistory = await fetch(`/api/chat/history${aberta ? `?conversa=${encodeURIComponent(aberta)}` : ""}`);
        // Uma carga que ficou para trás (a página foi montada de novo, o que o React faz em
        // desenvolvimento) não pode sobrescrever a conversa nem consumir a marca de análise.
        if (!ativo) return;
        if (resHistory.ok) {
          const dataH = await resHistory.json();
          if (!ativo) return;
          if (typeof dataH.restantesHoje === "number") setRestantes(dataH.restantesHoje);
          if (typeof dataH.limiteDiario === "number") setLimiteDiario(dataH.limiteDiario);
          setConversaId(dataH.conversaId ?? null);
          if (dataH.history && dataH.history.length > 0) {
            setMessages(dataH.history);
          } else {
            setMessages(conversaNova());
          }
        }

        // "Salvar e pedir análise" no Meu Cultivo: a primeira pergunta sai sozinha. A marca é
        // removida antes de enviar, para não repetir ao recarregar.
        let pedirAnalise = false;
        try {
          pedirAnalise = sessionStorage.getItem(CHAVE_PEDIR_ANALISE) === "1";
          sessionStorage.removeItem(CHAVE_PEDIR_ANALISE);
        } catch { }
        // Pela ref: este efeito é declarado antes de handleSendMessage (ver o efeito abaixo dela).
        if (pedirAnalise) enviarRef.current?.(PERGUNTA_DE_ANALISE);

      } catch (err) {
      } finally {
        if (ativo) setLoading(false);
      }
    }
    let ativo = true;
    loadData();
    return () => { ativo = false; };
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sair da página não deixa a leitura continuando.
  useEffect(() => () => { if (sinteseDeFala()) window.speechSynthesis.cancel(); }, []);

  useEffect(() => {
    if (!conversaId) return;
    try { localStorage.setItem(CHAVE_CONVERSA_ABERTA, conversaId); } catch { }
  }, [conversaId]);

  const copyHistory = () => {
    const debugData = {
      timestamp: new Date().toISOString(),
      user: user,
      propriedade: propriedade,
      history: messages.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        hasForm: !!m.form
      }))
    };
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pararFala = () => {
    falaRef.current += 1;
    if (sinteseDeFala()) window.speechSynthesis.cancel();
    setFalandoId(null);
  };

  const ouvir = (msg) => {
    const estava = falandoId === msg.id;
    pararFala();
    if (estava) return; // o mesmo botão para a leitura
    const frases = frasesParaFala(msg.text);
    if (!frases.length) return;
    // Um número por leitura: o cancel() acima dispara o onerror da leitura anterior, que não
    // pode apagar o estado desta.
    const leitura = falaRef.current;
    const vozes = window.speechSynthesis.getVoices();
    const voz = vozes.find((v) => v.lang.replace("_", "-") === "pt-BR") || vozes.find((v) => v.lang.startsWith("pt"));
    const terminar = () => { if (falaRef.current === leitura) setFalandoId(null); };
    frases.forEach((frase, i) => {
      const fala = new SpeechSynthesisUtterance(frase);
      fala.lang = "pt-BR";
      if (voz) fala.voice = voz;
      fala.onerror = terminar;
      if (i === frases.length - 1) fala.onend = terminar;
      window.speechSynthesis.speak(fala);
    });
    setFalandoId(msg.id);
  };

  // A lista é buscada a cada abertura: muda a cada pergunta feita.
  const alternarLista = async () => {
    if (listaAberta) { setListaAberta(false); return; }
    setListaAberta(true);
    try {
      const r = await fetch('/api/conversas');
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setConversas(d.conversas);
    } catch (err) {
      console.error("Erro ao listar conversas", err);
      setConversas([]);
    }
  };

  const abrirConversa = async (id) => {
    setListaAberta(false);
    pararFala();
    if (id === conversaId) return;
    try {
      const r = await fetch(`/api/chat/history?conversa=${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setConversaId(d.conversaId ?? null);
      setMessages(d.history?.length ? d.history : conversaNova());
    } catch (err) {
      console.error("Erro ao abrir conversa", err);
    }
  };

  // Começa do zero sem apagar nada: a conversa anterior fica guardada no banco.
  const novaConversa = async () => {
    try {
      const r = await fetch('/api/conversas', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setListaAberta(false);
      pararFala();
      setConversaId(d.conversaId);
      setMessages(conversaNova());
    } catch (err) {
      console.error("Erro ao abrir nova conversa", err);
    }
  };

  const apagarConversa = async () => {
    if (!confirm("Apagar esta conversa? As mensagens dela não poderão ser recuperadas.")) return;
    try {
      const r = await fetch(`/api/chat/history${conversaId ? `?conversa=${conversaId}` : ""}`, { method: 'DELETE' });
      const d = await r.json();
      setListaAberta(false);
      pararFala();
      setConversaId(d.conversaId ?? null);
      setMessages(conversaNova());
    } catch (err) {
      console.error("Erro ao apagar conversa", err);
    }
  };

  const sendMessageToAPI = async (questionText, currentProp, submittedData = null, respostaAoPedido = false) => {
    const loadingId = crypto.randomUUID();
    
    // Get history before adding the new bot message
    const history = messages.map(m => ({
      text: m.text,
      sender: m.sender
    }));

    setMessages((prev) => [...prev, { id: loadingId, text: "Pensando...", sender: "bot" }]);

    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: questionText, 
          user, 
          propriedade: currentProp,
          history: history, // Pass history
          submittedData: submittedData,
          respostaAoPedido,
          conversaId
        })
      });

      const data = await response.json();

      let respostaTexto = "Desculpe, ocorreu um erro ao se comunicar com o CultivAI.";
      let formData = null;
      let fontes = [];
      let epoca = null;
      let semBase = null;

      // --- INÍCIO DA ALTERAÇÃO 1 ---
      if (data.success && data.parsedData) {
        respostaTexto = data.parsedData.resposta || "Sem resposta em texto.";
        if (data.parsedData.tipo === "coleta_dados") {
          formData = data.parsedData;
        }
        if (Array.isArray(data.fontes)) fontes = data.fontes;
        if (data.epoca) epoca = data.epoca;
        if (data.semBase) semBase = data.semBase;
        if (typeof data.restantesHoje === "number") setRestantes(data.restantesHoje);
        if (data.conversaId) setConversaId(data.conversaId);
      } else if (data.message) {
        respostaTexto = data.message; // mostra o motivo real (limite, 401, Groq indisponível...)
      }
      // --- FIM DA ALTERAÇÃO 1 ---

      // O id do banco substitui o provisório, para a resposta poder ser avaliada.
      setMessages((prev) => prev.map(msg => msg.id === loadingId ? { ...msg, id: data.mensagemId || loadingId, text: respostaTexto, form: formData, fontes, epoca, semBase } : msg));
    } catch (err) {
      setMessages((prev) => prev.map(msg => msg.id === loadingId ? { ...msg, text: "Ocorreu um erro ao conectar com o modelo de linguagem." } : msg));
    }
  };

  const handleSendMessage = async (texto = inputValue) => {
    if (texto.trim() === "") return;

    reconhecimentoRef.current?.stop();
    const question = texto;
    setInputValue("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text: question, sender: "user" }]);
    
    await sendMessageToAPI(question, propriedade);
  };

  // A carga inicial roda antes desta linha existir; ela chama o envio por esta ref.
  useEffect(() => { enviarRef.current = handleSendMessage; });

  const handleFormSubmit = async (formData, msgId, form) => {
    // Remove form from the bot message
    setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, form: null } : msg));

    const newPropState = { ...propriedade, ...formData };
    setPropriedade(newPropState);

    // Resumo com os rótulos do formulário ("Tipo de solo: Arenoso"), não as chaves do banco
    const resumo = {};
    for (const campo of form?.campos_necessarios || []) {
      const valor = formData[campo.chave];
      if (!valor) continue;
      const opcao = campo.opcoes?.find((op) => (op.valor ?? op) === valor);
      resumo[campo.label.replace(/\s*\(.*\)$/, "")] = String(opcao?.rotulo ?? valor).replace(/\s*\(.*\)$/, "");
    }

    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      text: "",
      sender: "user",
      submittedData: resumo // Pass the data for static rendering
    }]);

    const apiPrompt = `Informei: ${Object.entries(resumo).map(([k, v]) => `${k}: ${v}`).join("; ")}.`;
    await sendMessageToAPI(apiPrompt, newPropState, resumo, true);
  };

  const handleFormSkip = async (msgId) => {
    setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, form: null } : msg));
    const followUp = "Prefiro não informar agora. Responda com o que já sabe.";
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text: followUp, sender: "user" }]);
    await sendMessageToAPI(followUp, propriedade, null, true);
  };

  const avaliar = async (msg, valor) => {
    const avaliacao = msg.avaliacao === valor ? null : valor; // clicar de novo desfaz
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, avaliacao } : m)));
    try {
      const r = await fetch("/api/chat/avaliacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: msg.id, avaliacao }) });
      if (!r.ok) throw new Error();
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, avaliacao: msg.avaliacao } : m)));
    }
  };

  // O texto ditado vai para o campo, sem enviar: o produtor confere antes.
  const alternarVoz = () => {
    if (ouvindo) { reconhecimentoRef.current?.stop(); return; }
    const Reconhecimento = reconhecimentoDeVoz();
    const r = new Reconhecimento();
    r.lang = "pt-BR";
    r.interimResults = true;
    const inicio = inputValue.trim() ? `${inputValue.trim()} ` : "";
    r.onresult = (e) => setInputValue(inicio + Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onerror = (e) => {
      if (e.error === "not-allowed") alert("Para falar sua pergunta, permita o uso do microfone para este site.");
    };
    r.onend = () => setOuvindo(false);
    reconhecimentoRef.current = r;
    r.start();
    setOuvindo(true);
  };

  const conversaVazia = !messages.some((m) => m.sender === "user");
  const faltando = itensFaltando(propriedade);

  if (loading) return <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Carregando a sua experiência...</div>;

  return (
    <div className={styles.chat} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'transparent' }}>
      <div className={styles.chatCabecalho} style={{ background: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.chatTitulo} style={{ margin: 0, color: 'var(--primary-dark)', fontWeight: '700', letterSpacing: '-0.5px' }}>Assistente CultivAI ✨</h1>
          <p className={styles.chatSubtitulo} style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>Tire suas dúvidas ou peça um plano de plantio com base na sua terra.</p>
          {restantes !== null && <ContadorPerguntas restantes={restantes} limite={limiteDiario} />}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={alternarLista}
            title="Ver as conversas anteriores"
            aria-expanded={listaAberta}
            aria-controls="lista-conversas"
            className={`${styles.botaoCabecalho} ${listaAberta ? styles.botaoCabecalhoAtivo : ""}`}
          >
            <History size={16} />
            <span className={styles.rotuloBotao}>Conversas</span>
          </button>
          <button
            onClick={novaConversa}
            title="Começar uma conversa nova. Esta fica guardada."
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--primary)', background: 'rgba(22,163,74,0.08)', color: 'var(--primary-dark)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', outline: 'none' }}
          >
            <MessageSquarePlus size={16} />
            <span className={styles.rotuloBotao}>Nova conversa</span>
          </button>
          <button
            onClick={apagarConversa}
            title="Apagar esta conversa"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: '600', outline: 'none' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'rgb(239,68,68)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Trash2 size={16} />
            <span className={styles.rotuloBotao}>Apagar conversa</span>
          </button>
          <button
            onClick={() => window.print()}
            title="Imprimir ou salvar a conversa em PDF"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', outline: 'none' }}
          >
            <Printer size={16} />
            <span className={styles.rotuloBotao}>Imprimir</span>
          </button>
          {/* Ferramenta da equipe: só no npm run dev. Na Vercel, NODE_ENV é "production". */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={copyHistory}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: copied ? 'rgba(22,163,74,0.1)' : 'var(--bg)', color: copied ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: '600', outline: 'none' }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span className={styles.rotuloBotao}>{copied ? 'Copiado!' : 'Copiar Log Debug'}</span>
            </button>
          )}
        </div>
      </div>

      {listaAberta && (
        <nav id="lista-conversas" aria-label="Conversas anteriores" className={styles.listaConversas}>
          {conversas === null ? (
            <p>Carregando...</p>
          ) : conversas.length === 0 ? (
            <p>Nenhuma conversa guardada ainda. Elas aparecem aqui depois da primeira pergunta.</p>
          ) : (
            <ul>
              {conversas.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => abrirConversa(c.id)} aria-current={c.id === conversaId ? "true" : undefined}>
                    <span className={styles.tituloConversa}>{c.titulo}</span>
                    <span className={styles.detalheConversa}>
                      {quando(c.ultimaMensagemEm)} · {c.perguntas} {c.perguntas === 1 ? "pergunta" : "perguntas"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )}

      <div className={styles.chatMensagens} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)' }}>
        {messages.map((msg) => (
          <div key={msg.id} className={styles.bolha} style={{ alignSelf: msg.sender === "user" ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.3s ease', width: (msg.form || msg.submittedData) ? '100%' : 'auto' }}>
            <div className={styles.balao} style={{
              background: msg.sender === "user" ? 'var(--primary-dark)' : 'var(--bg)',
              color: msg.sender === "user" ? 'var(--white)' : 'var(--text-primary)',
              boxShadow: msg.sender === "user" ? '0 4px 12px rgba(6,64,43,0.15)' : 'var(--shadow-sm)',
              border: msg.sender === "user" ? 'none' : '1px solid var(--border)',
              borderRadius: msg.sender === "user" ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              lineHeight: '1.6',
              fontSize: '1rem',
              fontWeight: msg.sender === "user" ? '400' : '500'
            }}>
              {/* Only show text if it's not a pure form-response, or show both if preferred */}
              {!msg.submittedData ? (
                <ReactMarkdown
                  components={{ p: ({ node, ...props }) => <p style={{ margin: 0, paddingBottom: '0.5rem', color: 'inherit' }} {...props} /> }}
                >
                  {msg.text}
                </ReactMarkdown>
              ) : null}

              {msg.sender === "bot" && msg.fontes?.length > 0 && citouEmbrapa(msg.text) && (
                <div className={styles.fontes}>
                  <span className={styles.fontesTitulo}>📚 Documentos da Embrapa consultados</span>
                  <ul>
                    {msg.fontes.map(rotuloFonte).filter(Boolean).map((rotulo, i) => <li key={i}>{rotulo}</li>)}
                  </ul>
                </div>
              )}

              {/* A busca nos documentos não aconteceu: a resposta veio só de conhecimento geral. */}
              {msg.sender === "bot" && msg.semBase && (
                <p className={styles.avisoSemBase} role="note">
                  ⚠️ Esta resposta não consultou os documentos da Embrapa: {MOTIVO_SEM_BASE[msg.semBase] ?? MOTIVO_SEM_BASE.erro}
                </p>
              )}

              {/* Vem dos dados do ZARC, não do texto da IA: aparece mesmo se ela não citar. */}
              {msg.sender === "bot" && msg.epoca && (
                <div className={styles.quadroZarc}>
                  <span className={styles.fontesTitulo}>
                    🗓️ Época de plantio oficial (ZARC){msg.epoca.local ? ` · ${msg.epoca.local}` : ""}
                  </span>
                  {msg.epoca.linhas?.length > 0 && (
                    <ul>
                      {msg.epoca.linhas.map((linha) => {
                        const [cultura, ...janela] = linha.split(": ");
                        return <li key={linha}><strong>{cultura}:</strong> {janela.join(": ")}</li>;
                      })}
                    </ul>
                  )}
                  {msg.epoca.aviso && <p>{msg.epoca.aviso}</p>}
                  <p className={styles.notaZarc}>
                    ℹ️ O risco é a chance de perder a lavoura por clima (seca, geada, calor); 20% é o menor. Plantar dentro da janela do ZARC é condição para o Proagro e o seguro rural. Para conferir a janela da sua cultivar e do seu solo, use o aplicativo gratuito <strong>Zarc Plantio Certo</strong>, da Embrapa.
                  </p>
                </div>
              )}

              {msg.form && (
                <DynamicForm 
                  data={msg.form} 
                  onSubmit={(data) => handleFormSubmit(data, msg.id, msg.form)}
                  onSkip={() => handleFormSkip(msg.id)} 
                />
              )}

              {msg.submittedData && (
                <DynamicForm submittedData={msg.submittedData} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: msg.sender === "user" ? 'flex-end' : 'flex-start', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', padding: '0 8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {msg.sender === "user" ? 'Você' : 'CultivAI'}
              {msg.sender === "bot" && (
                <span className={styles.acoesMensagem}>
                  {temFala && msg.text !== "Pensando..." && (
                    <button type="button" onClick={() => ouvir(msg)} aria-pressed={falandoId === msg.id} title={falandoId === msg.id ? "Parar a leitura" : "Ouvir a resposta"} className={falandoId === msg.id ? styles.avaliada : undefined}>
                      {falandoId === msg.id ? <Square size={15} /> : <Volume2 size={15} />}
                    </button>
                  )}
                  {respostaGravada(msg) && <>
                  <button type="button" onClick={() => avaliar(msg, "boa")} aria-pressed={msg.avaliacao === "boa"} title="Resposta útil" className={msg.avaliacao === "boa" ? styles.avaliada : undefined}>
                    <ThumbsUp size={15} />
                  </button>
                  <button type="button" onClick={() => avaliar(msg, "ruim")} aria-pressed={msg.avaliacao === "ruim"} title="Resposta ruim ou errada" className={msg.avaliacao === "ruim" ? styles.avaliada : undefined}>
                    <ThumbsDown size={15} />
                  </button>
                  </>}
                </span>
              )}
            </div>
          </div>
        ))}
        {conversaVazia && faltando.length > 0 && (
          <div className={styles.lembretePerfil}>
            💡 {propriedade
              ? `Para respostas mais certeiras, complete no Meu Cultivo: ${faltando.slice(0, 3).map((i) => i.rotulo).join(", ")}${faltando.length > 3 ? ` e mais ${faltando.length - 3}` : ""}.`
              : "Preencha o Meu Cultivo para receber respostas pensadas para a sua área."}{" "}
            <Link href="/perfil-propriedade">{propriedade ? "Completar perfil" : "Preencher agora"}</Link>
          </div>
        )}
        {conversaVazia && (
          <div className={styles.sugestoes}>
            {sugestoesDePergunta(propriedade).map((s) => (
              <button key={s} type="button" onClick={() => handleSendMessage(s)}>{s}</button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatEntrada} style={{ display: 'flex', gap: '12px', background: 'var(--surface)', borderRadius: '100px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder={ouvindo ? "Pode falar..." : "Digite sua dúvida..."}
          className={styles.campoTexto}
          style={{ flex: 1, minWidth: 0, borderRadius: '100px', border: 'none', background: 'transparent', outline: 'none', fontSize: '1rem', color: 'var(--text-primary)' }}
        />
        {temVoz && (
          <button
            type="button"
            onClick={alternarVoz}
            title={ouvindo ? "Parar de ouvir" : "Falar a pergunta"}
            aria-pressed={ouvindo}
            className={`${styles.botaoVoz} ${ouvindo ? styles.ouvindo : ""}`}
          >
            <Mic size={20} />
          </button>
        )}
        <button
          onClick={() => handleSendMessage()}
          className={styles.botaoEnviar}
          style={{ background: 'var(--primary)', color: 'white', borderRadius: '100px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '1rem', transition: 'all 0.3s', boxShadow: '0 4px 10px rgba(22,163,74,0.2)' }}
          onMouseOver={(e) => { e.target.style.transform = 'scale(1.02)'; e.target.style.background = 'var(--primary-dark)'; }}
          onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.background = 'var(--primary)'; }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}