"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import Botao from "@/components/ui/Botao";
import ConfirmarNaTela from "@/components/ui/ConfirmarNaTela";

// "Excluir" no cartão do cultivo, com confirmação na própria linha (sem janela do navegador).
export default function ExcluirCultivo({ id, nome }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const origemRef = useRef(null);

  const excluir = async () => {
    const res = await fetch(`/api/cultivos/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) throw new Error("Não deu para excluir agora. Tente de novo.");
    router.replace("/meus-cultivos?excluido=1");
    router.refresh();
  };

  const cancelar = () => {
    setConfirmando(false);
    // O botão "Excluir" volta à tela depois da troca; o foco vai para ele em seguida
    requestAnimationFrame(() => origemRef.current?.focus());
  };

  if (!confirmando) {
    return (
      <Botao variante="perigoDiscreto" tamanho="p" icone={Trash2} ref={origemRef} onClick={() => setConfirmando(true)}>
        Excluir
      </Botao>
    );
  }
  return (
    <ConfirmarNaTela pergunta={`Excluir ${nome}? As conversas continuam.`} rotuloConfirmar="Excluir" textoOcupado="Excluindo..."
      aoConfirmar={excluir} aoCancelar={cancelar} />
  );
}
