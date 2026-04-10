"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown';

import { useRouter } from "next/navigation";

export default function ChatCultivAI() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [propriedade, setPropriedade] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

        setMessages([{
          id: 1,
          text: "Olá! Sou o CultivAI, seu assistente agrícola especializado. Como posso ajudar nas suas colheitas hoje?",
          sender: "bot"
        }]);

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

  const handleSendMessage = async () => {
    if (inputValue.trim() === "") return;

    const newUserMessage = { id: Date.now(), text: inputValue, sender: "user" };
    setMessages((prev) => [...prev, newUserMessage]);
    const question = inputValue;
    setInputValue("");

    const loadingId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: loadingId, text: "Pensando...", sender: "bot" }]);

    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question, user, propriedade })
      });

      console.log(response)

      const data = await response.json();

      let respostaTexto = "Desculpe, ocorreu um erro ao se comunicar com o CultivAI.";
      if (data.success && data.text) {
        respostaTexto = data.text;
      }

      setMessages((prev) => prev.map(msg => msg.id === loadingId ? { ...msg, text: respostaTexto } : msg));

    } catch (err) {
      setMessages((prev) => prev.map(msg => msg.id === loadingId ? { ...msg, text: "Ocorreu um erro ao conectar com o modelo de linguagem." } : msg));
    }
  };

  if (loading) return <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Carregando a sua experiência...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 6rem)', backgroundColor: 'transparent' }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem 2rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary-dark)', fontWeight: '700', letterSpacing: '-0.5px' }}>Assistente CultivAI ✨</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>Tire suas dúvidas ou peça um plano de plantio com base na sua terra.</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ alignSelf: msg.sender === "user" ? 'flex-end' : 'flex-start', maxWidth: '78%', animation: 'fadeIn 0.3s ease' }}>
            <div style={{
              background: msg.sender === "user" ? 'var(--primary-dark)' : 'var(--bg)',
              color: msg.sender === "user" ? 'var(--white)' : 'var(--text-primary)',
              boxShadow: msg.sender === "user" ? '0 4px 12px rgba(6,64,43,0.15)' : 'var(--shadow-sm)',
              border: msg.sender === "user" ? 'none' : '1px solid var(--border)',
              padding: '1.25rem 1.5rem',
              borderRadius: msg.sender === "user" ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              fontSize: '1rem',
              fontWeight: msg.sender === "user" ? '400' : '500'
            }}>
              <ReactMarkdown
                components={{ p: ({ node, ...props }) => <p style={{ margin: 0, paddingBottom: '0.5rem', color: 'inherit' }} {...props} /> }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: msg.sender === "user" ? 'right' : 'left', padding: '0 8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {msg.sender === "user" ? 'Você' : 'CultivAI'}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '12px', background: 'var(--surface)', padding: '1rem', borderRadius: '100px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Comece digitando sua dúvida..."
          style={{ flex: 1, padding: '0.8rem 1.5rem', borderRadius: '100px', border: 'none', background: 'transparent', outline: 'none', fontSize: '1rem', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleSendMessage}
          style={{ padding: '0 2rem', background: 'var(--primary)', color: 'white', borderRadius: '100px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '1rem', transition: 'all 0.3s', boxShadow: '0 4px 10px rgba(22,163,74,0.2)' }}
          onMouseOver={(e) => { e.target.style.transform = 'scale(1.02)'; e.target.style.background = 'var(--primary-dark)'; }}
          onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.background = 'var(--primary)'; }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}