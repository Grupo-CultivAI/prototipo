"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import styles from "./cultivos.module.css";

// "Excluir" no cartão do cultivo, com confirmação na própria linha (sem janela do navegador).
export default function ExcluirCultivo({ id, nome }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  const excluir = async () => {
    setExcluindo(true);
    setErro("");
    try {
      const res = await fetch(`/api/cultivos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.replace("/meus-cultivos?excluido=1");
      router.refresh();
    } catch {
      setErro("Não deu para excluir agora. Tente de novo.");
      setExcluindo(false);
    }
  };

  if (!confirmando) {
    return (
      <button type="button" className={styles.acaoPerigo} onClick={() => setConfirmando(true)}>
        <Trash2 size={16} aria-hidden="true" /> Excluir
      </button>
    );
  }
  return (
    <span role="group" aria-label={`Confirmar exclusão de ${nome}`} className={styles.confirmar}>
      <span>Excluir {nome}? As conversas continuam.</span>
      <button type="button" className={styles.botaoPerigo} onClick={excluir} disabled={excluindo}>{excluindo ? "Excluindo..." : "Excluir"}</button>
      <button type="button" className={styles.acao} onClick={() => setConfirmando(false)} disabled={excluindo}>Cancelar</button>
      {erro && <span role="alert" className={styles.erro}>{erro}</span>}
    </span>
  );
}
