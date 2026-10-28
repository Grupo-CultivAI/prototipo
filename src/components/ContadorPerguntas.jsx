"use client";
import { useId, useState } from "react";
import styles from "@/app/(authed)/paginas.module.css";

// Perguntas do dia num anel que vai enchendo conforme são usadas, com a explicação ao passar
// o mouse, ao focar pelo teclado ou ao tocar no celular. O limite conta as perguntas das
// últimas 24 horas (src/lib/limites.ts), então cada uma volta 24 horas depois de feita.
const RAIO = 8;
const VOLTA = 2 * Math.PI * RAIO;

export default function ContadorPerguntas({ restantes, limite }) {
  const id = useId();
  const [aberta, setAberta] = useState(false);
  const usadas = Math.max(0, limite - restantes);
  const fracao = limite > 0 ? Math.min(1, usadas / limite) : 0;
  const cor = restantes <= 5 ? "rgb(185, 28, 28)" : restantes <= 10 ? "rgb(217, 119, 6)" : "var(--primary)";

  const resumo = restantes === 0
    ? "Limite de perguntas de hoje atingido"
    : `${restantes} ${restantes === 1 ? "pergunta restante" : "perguntas restantes"} hoje`;
  const dica = restantes === 0
    ? `Você usou as ${limite} perguntas das últimas 24 horas. Cada uma volta a ficar disponível 24 horas depois de feita.`
    : `Você usou ${usadas} de ${limite} perguntas nas últimas 24 horas. Cada uma volta a ficar disponível 24 horas depois de feita.`;

  return (
    <span className={styles.contador}>
      <button
        type="button"
        className={styles.anelPerguntas}
        aria-describedby={id}
        onMouseEnter={() => setAberta(true)}
        onMouseLeave={() => setAberta(false)}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        // No celular o toque dispara foco e clique: alternar fecharia na hora. Tocar fora fecha (blur).
        onClick={() => setAberta(true)}
        onKeyDown={(e) => e.key === "Escape" && setAberta(false)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r={RAIO} fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="10" cy="10" r={RAIO} fill="none" stroke={cor} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={VOLTA} strokeDashoffset={VOLTA * (1 - fracao)} transform="rotate(-90 10 10)"
          />
        </svg>
        <span style={{ color: restantes <= 5 ? cor : undefined }}>{resumo}</span>
      </button>
      {/* Sempre no DOM (o leitor de tela lê pelo aria-describedby); visível só quando aberta */}
      <span id={id} role="tooltip" className={styles.dicaPerguntas} hidden={!aberta}>{dica}</span>
    </span>
  );
}
