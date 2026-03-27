"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./chat.module.css";

export default function ChatCultivAI() {

  const router = useRouter();

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [dadosFormulario, setDadosFormulario] = useState(null);

  // proteção + carregar dados
  useEffect(() => {

    const usuarioLogado = localStorage.getItem("usuarioLogado");

    if(!usuarioLogado){
      router.push("/login");
      return;
    }

    const dados = JSON.parse(
      localStorage.getItem("cultivAI_user_input")
    );

    setDadosFormulario(dados);

    // SOMENTE primeira mensagem
    const mensagemInicial = {
      id: 1,
      text: "Olá! Posso te ajudar com recomendações agrícolas personalizadas 🌱",
      sender: "bot"
    };

    setMessages([mensagemInicial]);

  }, []);

  // envio de mensagens
  const handleSendMessage = () => {

    if (inputValue.trim() === "") return;

    const newUserMessage = {
      id: Date.now(),
      text: inputValue,
      sender: "user"
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue("");

    setTimeout(() => {

      let respostaTexto = "⚠️ Nenhuma informação da propriedade foi encontrada.";

      if(dadosFormulario){
        respostaTexto = `🔎 (Protótipo)

Com base nas informações fornecidas:

- Tamanho da propriedade: ${dadosFormulario.tamanho}
- Tipo de solo: ${dadosFormulario.tipoSolo}
- Culturas: ${dadosFormulario.culturas}
- Objetivo: ${dadosFormulario.objetivo}

Esses dados serão utilizados para gerar recomendações agrícolas personalizadas futuramente.`;
      }

      const botResponse = {
        id: Date.now() + 1,
        text: respostaTexto,
        sender: "bot"
      };

      setMessages((prev) => [...prev, botResponse]);

    }, 1500);

  };

  // logout
  const sair = () => {
    localStorage.removeItem("usuarioLogado");
    router.push("/login");
  };

  return (
    <div className={styles.chatContainer}>

      <header className={styles.header}>
        <h1 className={styles.headerTitle}>CultivAI</h1>

        <button onClick={sair} className={styles.logoutButton}>
          Sair
        </button>
      </header>

      <main className={styles.chatArea}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageWrapper} ${
              msg.sender === "user"
                ? styles.messageUser
                : styles.messageBot
            }`}
          >
            <div
              className={`${styles.bubble} ${
                msg.sender === "user"
                  ? styles.bubbleUser
                  : styles.bubbleBot
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </main>

      <footer className={styles.footer}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && handleSendMessage()
          }
          placeholder="Digite sua mensagem..."
          className={styles.inputField}
        />

        <button
          onClick={handleSendMessage}
          className={styles.sendButton}
        >
          Enviar
        </button>
      </footer>

    </div>
  );
}