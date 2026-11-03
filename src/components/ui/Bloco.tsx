import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import Selo, { type TipoSelo } from "./Selo";
import styles from "./Bloco.module.css";

// Bloco que abre e fecha (sanfona) do formulário do cultivo. O cabeçalho é um botão dentro de um
// título (h3), e não uma div clicável, para abrir também pelo teclado e pelo leitor de tela.
// O título tem id "secao-<id>" (o formulário rola até ele quando há erro no bloco).
//
// O selo de situação fica embaixo da descrição, e o texto quebra linha: com a letra do celular
// aumentada, o selo à direita do título empurrava a página para os lados (ela ficava mais larga
// que a tela, o celular reduzia o zoom e a letra grande se perdia).
export default function Bloco({ id, titulo, descricao, icone: Icone, aberto, aoAlternar, situacao, children }: {
    id: string;
    titulo: string;
    descricao?: string;
    icone: LucideIcon;
    aberto: boolean;
    aoAlternar: (id: string) => void;
    /** Situação curta no cabeçalho ("Completo", "Falta 1"), para ver o que falta sem abrir */
    situacao?: { texto: string; tipo: TipoSelo };
    children: ReactNode;
}) {
    const Seta = aberto ? ChevronUp : ChevronDown;
    return (
        <div className={styles.bloco}>
            <h3 id={`secao-${id}`} className={styles.titulo}>
                <button type="button" onClick={() => aoAlternar(id)} aria-expanded={aberto} className={styles.cabecalho}>
                    <span className={styles.icone}><Icone size={24} aria-hidden="true" /></span>
                    <span className={styles.textos}>
                        <span className={styles.nome}>{titulo}</span>
                        {descricao && <span className={styles.descricao}>{descricao}</span>}
                        {situacao && <Selo tipo={situacao.tipo} className={styles.selo}>{situacao.texto}</Selo>}
                    </span>
                    <Seta size={24} aria-hidden="true" className={styles.seta} />
                </button>
            </h3>
            {aberto && <div className={styles.conteudo}>{children}</div>}
        </div>
    );
}
