"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import { useRouter } from "next/navigation";
import DynamicForm from "@/components/DynamicForm";
import { Copy, Check, RefreshCw } from "lucide-react";
import styles from "../paginas.module.css";

// A API devolve os documentos consultados sem filtrar por relevância: numa
// pergunta fora do tema eles não têm relação com a resposta. Por isso as fontes
// só aparecem quando o próprio texto atribuiu algo à Embrapa.
const citouEmbrapa = (texto) => /segundo a embrapa/i.test(texto || "");

const rotuloFonte = (fonte) => {
  const arquivo = typeof fonte === "string" ? fonte : fonte?.fonte;
  if (!arquivo) return null;
  const nome = String(arquivo).replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const pagina = typeof fonte === "object" && fonte?.pagina ? ` (p. ${fonte.pagina} do PDF)` : "";
  return nome.charAt(0).toUpperCase() + nome.slice(1) + pagina;
};

export default function ChatCultivAI() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [propriedade, setPropriedade] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
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

        const resHistory = await fetch('/api/chat/history');
        if (resHistory.ok) {
          const dataH = await resHistory.json();
          if (dataH.history && dataH.history.length > 0) {
            setMessages(dataH.history);
          } else {
            setMessages([{
              id: 1,
              text: "Olá! Sou o CultivAI, seu assistente agrícola especializado. Como posso ajudar nas suas colheitas hoje?",
              sender: "bot"
            }]);
          }
        }

      } catch (err) {
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleRestartChat = async () => {
    if (!confirm("Tem certeza que deseja reiniciar o chat? Todo o histórico atual será apagado.")) return;
    try {
      await fetch('/api/chat/history', { method: 'DELETE' });
      setMessages([{
        id: crypto.randomUUID(),
        text: "Olá! Sou o CultivAI, seu assistente agrícola especializado. Como posso ajudar nas suas colheitas hoje?",
        sender: "bot"
      }]);
    } catch (err) {
      console.error("Erro ao reiniciar chat", err);
    }
  };

  const sendMessageToAPI = async (questionText, currentProp, submittedData = null) => {
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
          submittedData: submittedData
        })
      });

      const data = await response.json();

      let respostaTexto = "Desculpe, ocorreu um erro ao se comunicar com o CultivAI.";
      let formData = null;
      let fontes = [];

      // --- INÍCIO DA ALTERAÇÃO 1 ---
      if (data.success && data.parsedData) {
        respostaTexto = data.parsedData.resposta || "Sem resposta em texto.";
        if (data.parsedData.tipo === "coleta_dados") {
          formData = data.parsedData;
        }
        if (Array.isArray(data.fontes)) fontes = data.fontes;
      } else if (data.message) {
        respostaTexto = data.message; // mostra o motivo real (limite, 401, Groq indisponível...)
      }
      // --- FIM DA ALTERAÇÃO 1 ---

      setMessages((prev) => prev.map(msg => msg.id === loadingId ? { ...msg, text: respostaTexto, form: formData, fontes } : msg));
    } catch (err) {
      setMessages((prev) => prev.map(msg => msg.id === loadingId ? { ...msg, text: "Ocorreu um erro ao conectar com o modelo de linguagem." } : msg));
    }
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === "") return;

    const question = inputValue;
    setInputValue("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text: question, sender: "user" }]);
    
    await sendMessageToAPI(question, propriedade);
  };

  const handleFormSubmit = async (formData, msgId) => {
    // Remove form from the bot message
    setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, form: null } : msg));
    
    const newPropState = { ...propriedade, ...formData };
    setPropriedade(newPropState);

    // Add a specialized USER message that contains the static form summary
    const followUpText = `Forneci os dados solicitados.`; // Hidden text or short label
    setMessages((prev) => [...prev, { 
      id: crypto.randomUUID(), 
      text: followUpText, 
      sender: "user",
      submittedData: formData // Pass the data for static rendering
    }]);

    const contextStr = Object.entries(formData).map(([k,v]) => `${k}: ${v}`).join(', ');
    const apiPrompt = `Usuário forneceu os dados: ${contextStr}. Continue a recomendação.`;
    await sendMessageToAPI(apiPrompt, newPropState, formData);
  };

  const handleFormSkip = async (msgId) => {
    setMessages(prev => prev.map(msg => msg.id === msgId ? { ...msg, form: null } : msg));
    const followUp = `Pulei o preenchimento por enquanto.`;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text: followUp, sender: "user" }]);
    await sendMessageToAPI("Usuário decidiu pular o preenchimento. Prossiga sem esses dados.", propriedade);
  };

  if (loading) return <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Carregando a sua experiência...</div>;

  return (
    <div className={styles.chat} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'transparent' }}>
      <div className={styles.chatCabecalho} style={{ background: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.chatTitulo} style={{ margin: 0, color: 'var(--primary-dark)', fontWeight: '700', letterSpacing: '-0.5px' }}>Assistente CultivAI ✨</h1>
          <p className={styles.chatSubtitulo} style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>Tire suas dúvidas ou peça um plano de plantio com base na sua terra.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={handleRestartChat}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: '600', outline: 'none' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'rgb(239,68,68)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <RefreshCw size={16} />
            <span className={styles.rotuloBotao}>Reiniciar Chat</span>
          </button>
          <button 
            onClick={copyHistory}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: copied ? 'rgba(22,163,74,0.1)' : 'var(--bg)', color: copied ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: '600', outline: 'none' }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span className={styles.rotuloBotao}>{copied ? 'Copiado!' : 'Copiar Log Debug'}</span>
          </button>
        </div>
      </div>

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

              {msg.form && (
                <DynamicForm 
                  data={msg.form} 
                  onSubmit={(data) => handleFormSubmit(data, msg.id)} 
                  onSkip={() => handleFormSkip(msg.id)} 
                />
              )}

              {msg.submittedData && (
                <DynamicForm submittedData={msg.submittedData} />
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: msg.sender === "user" ? 'right' : 'left', padding: '0 8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {msg.sender === "user" ? 'Você' : 'CultivAI'}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatEntrada} style={{ display: 'flex', gap: '12px', background: 'var(--surface)', borderRadius: '100px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Digite sua dúvida..."
          className={styles.campoTexto}
          style={{ flex: 1, minWidth: 0, borderRadius: '100px', border: 'none', background: 'transparent', outline: 'none', fontSize: '1rem', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleSendMessage}
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