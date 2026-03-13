// src/app/chat/page.js
"use client";

import { useState } from "react";
import styles from "./chat.module.css"; // Importando o CSS puro

export default function ChatCultivAI() {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: "Olá! Posso ajudar com isso. Quais informações você pode me fornecer sobre o seu campo?", 
      sender: "bot" 
    }
  ]);
  
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = () => {
    if (inputValue.trim() === "") return;

    const newUserMessage = { 
      id: Date.now(), 
      text: inputValue, 
      sender: "user" 
    };
    
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setInputValue("");

    setTimeout(() => {
      const botResponse = { 
        id: Date.now() + 1, 
        text: "Essa é uma resposta simulada para testar o fluxo. As cores já estão padronizadas com o CultivAI!", 
        sender: "bot" 
      };
      setMessages((prevMessages) => [...prevMessages, botResponse]);
    }, 1500);
  };

  return (
    <div className={styles.chatContainer}>
      
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>CultivAI</h1>
      </header>

      <main className={styles.chatArea}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`${styles.messageWrapper} ${msg.sender === 'user' ? styles.messageUser : styles.messageBot}`}
          >
            <div className={`${styles.bubble} ${msg.sender === 'user' ? styles.bubbleUser : styles.bubbleBot}`}>
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
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Digite sua mensagem..."
          className={styles.inputField}
        />
        <button onClick={handleSendMessage} className={styles.sendButton}>
          Enviar
        </button>
      </footer>
      
    </div>
  );
}
