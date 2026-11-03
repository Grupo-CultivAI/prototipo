import type { ReactNode } from "react";
import styles from "./BarraDeAcoes.module.css";

// Barra com os botões de salvar, presa no pé da tela enquanto se rola o formulário (no celular,
// logo acima da navegação). A mensagem do último envio fica ao lado: anunciada na hora quando é
// erro, sem interromper quando é sucesso.
//
// Enquanto a barra existe, a página reserva espaço embaixo para o foco (scroll-padding): um
// campo levado à tela pelo Tab ou pelo erro do formulário não fica escondido atrás dela.
// No celular, os botões ficam mais baixos e com texto curto (TextoAdaptavel), para a barra não
// tomar um quarto da tela quando a letra do aparelho está aumentada.
export default function BarraDeAcoes({ mensagem, erro = false, children, className }: {
    mensagem?: ReactNode;
    erro?: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={[styles.barra, className].filter(Boolean).join(" ")}>
            <div role={erro ? "alert" : "status"} className={erro ? styles.mensagemErro : styles.mensagem}>{mensagem}</div>
            <div className={styles.acoes}>{children}</div>
        </div>
    );
}

/** Texto do botão em duas versões: a longa no computador, a curta no celular. A que está
 *  escondida (display: none) também some para o leitor de tela, que lê só a outra. */
export function TextoAdaptavel({ longo, curto }: { longo: string; curto: string }) {
    return (
        <>
            <span className={styles.longo}>{longo}</span>
            <span className={styles.curto}>{curto}</span>
        </>
    );
}
