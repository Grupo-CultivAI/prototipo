"use client";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import Botao, { type TamanhoBotao } from "./Botao";
import styles from "./ConfirmarNaTela.module.css";

// Confirmação na própria tela, no lugar da janela do navegador (confirm()), para apagar ou
// excluir algo. O foco vai para "Cancelar" ao abrir (o caminho seguro), e Esc também cancela.
// Se `aoConfirmar` falhar (lançar um erro), a mensagem aparece aqui mesmo e nada some.
// Quem abre a confirmação devolve o foco ao botão de origem em `aoCancelar`.
//
// aparencia: "linha" (dentro de um cartão ou de um texto) | "faixa" (destacada, em vermelho-claro)
export default function ConfirmarNaTela({
    pergunta, rotuloConfirmar = "Confirmar", textoOcupado = "Aguarde...", aoConfirmar, aoCancelar,
    aparencia = "linha", tamanho = "p", icone, className,
}: {
    /** Texto da pergunta; também nomeia o grupo para o leitor de tela */
    pergunta: string;
    /** Ícone ao lado da pergunta (só na faixa) */
    icone?: LucideIcon;
    rotuloConfirmar?: string;
    textoOcupado?: string;
    aoConfirmar: () => Promise<void> | void;
    aoCancelar: () => void;
    aparencia?: "linha" | "faixa";
    tamanho?: TamanhoBotao;
    className?: string;
}) {
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState("");
    const cancelarRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { cancelarRef.current?.focus(); }, []);
    const Icone = icone;

    const confirmar = async () => {
        setOcupado(true);
        setErro("");
        try {
            await aoConfirmar();
        } catch (e) {
            setErro(e instanceof Error && e.message ? e.message : "Não deu certo agora. Confira a internet e tente de novo.");
            setOcupado(false);
        }
    };

    return (
        <div role="group" aria-label={pergunta} className={[styles.confirmar, styles[aparencia], className].filter(Boolean).join(" ")}
            onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) aoCancelar(); }}>
            <p className={styles.pergunta}>{Icone && <Icone size={16} aria-hidden="true" />}{pergunta}</p>
            <div className={styles.botoes}>
                <Botao variante="perigo" tamanho={tamanho} onClick={confirmar} carregando={ocupado} textoCarregando={textoOcupado}>
                    {rotuloConfirmar}
                </Botao>
                <Botao variante="neutro" tamanho={tamanho} ref={cancelarRef} onClick={aoCancelar} disabled={ocupado}>Cancelar</Botao>
            </div>
            {erro && <p role="alert" className={styles.erro}>{erro}</p>}
        </div>
    );
}
