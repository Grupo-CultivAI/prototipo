"use client";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./Input.module.css";

// Campo de formulário das telas de conta (login, cadastro, senha).
// - label ligado ao campo (htmlFor/id): o leitor de tela anuncia o nome do campo, e tocar
//   no rótulo foca o campo;
// - invalido: marca o campo (aria-invalid) e deixa a borda vermelha;
// - dica: texto abaixo do campo, também anunciado pelo leitor de tela;
// - type="password" ganha o botão de mostrar/esconder a senha;
// - ref chega ao <input> (React 19), para levar o foco ao campo com erro.
export default function Input({ label, dica, invalido = false, acessorio, type = "text", id, ...props }) {
  const gerado = useId();
  const campoId = id || gerado;
  const idDica = dica ? `${campoId}-dica` : undefined;
  const [mostrar, setMostrar] = useState(false);
  const ehSenha = type === "password";

  return (
    <div className={styles.campo}>
      {(label || acessorio) && (
        <div className={styles.cabecalho}>
          {label && <label htmlFor={campoId} className={styles.rotulo}>{label}</label>}
          {acessorio}
        </div>
      )}
      <div className={styles.caixa}>
        <input
          id={campoId}
          type={ehSenha && mostrar ? "text" : type}
          aria-invalid={invalido || undefined}
          aria-describedby={idDica}
          className={`${styles.entrada} ${ehSenha ? styles.comBotao : ""}`}
          {...props}
        />
        {ehSenha && (
          <button
            type="button"
            className={styles.olho}
            onClick={() => setMostrar((m) => !m)}
            aria-label={mostrar ? "Esconder a senha" : "Mostrar a senha"}
            aria-pressed={mostrar}
          >
            {mostrar ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {dica && <span id={idDica} className={styles.dica}>{dica}</span>}
    </div>
  );
}
