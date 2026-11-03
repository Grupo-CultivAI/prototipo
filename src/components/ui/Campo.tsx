"use client";
import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./Campo.module.css";

// Campo de formulário do design system (docs/design-system.md): o rótulo, a dica e o erro já
// chegam ligados ao controle (htmlFor/id, aria-describedby, aria-invalid). Assim o leitor de tela
// lê o nome do campo e a mensagem, e tocar no rótulo leva ao campo.
//
// Campo recebe o controle como função, para servir a qualquer um (input, select, BuscaCidade);
// para os casos comuns, use Entrada, Selecao e AreaTexto.

type Ligacao = { id: string; "aria-describedby"?: string; "aria-invalid"?: true; "aria-required"?: true; className: string };

export type CampoProps = {
    rotulo: ReactNode;
    /** Id do controle. Sem ele, um é gerado. */
    id?: string;
    /** Texto de ajuda embaixo do campo, lido junto com o nome */
    dica?: ReactNode;
    /** Mensagem de erro: marca o campo e aparece embaixo dele */
    erro?: string;
    /** Marca o campo com erro sem mostrar mensagem aqui (ex.: a mensagem está num Aviso) */
    invalido?: boolean;
    obrigatorio?: boolean;
    /** Mostra "(opcional)", ou o texto dado, ao lado do rótulo */
    opcional?: boolean | string;
    /** Algo ao lado do rótulo, à direita (ex.: link "Esqueci a senha") */
    acessorio?: ReactNode;
    /** Controle mais baixo, para linhas com vários campos */
    compacto?: boolean;
    /** Rótulo só para o leitor de tela (a linha já mostra do que se trata) */
    rotuloOculto?: boolean;
    className?: string;
};

export default function Campo({
    rotulo, id, dica, erro, invalido, obrigatorio, opcional, acessorio, compacto, rotuloOculto, className, children,
}: CampoProps & { children: (ligacao: Ligacao) => ReactNode }) {
    const gerado = useId();
    const campoId = id ?? `campo-${gerado.replace(/[^a-zA-Z0-9]/g, "")}`;
    const idErro = erro ? `${campoId}-erro` : undefined;
    const idDica = dica ? `${campoId}-dica` : undefined;
    const descritoPor = [idErro, idDica].filter(Boolean).join(" ") || undefined;
    return (
        <div className={[styles.campo, className].filter(Boolean).join(" ")}>
            <div className={[styles.cabecalho, rotuloOculto && styles.somenteLeitor].filter(Boolean).join(" ")}>
                <label htmlFor={campoId} className={styles.rotulo}>
                    {rotulo}
                    {obrigatorio && <span aria-hidden="true"> *</span>}
                    {opcional && <span className={styles.opcional}> ({opcional === true ? "opcional" : opcional})</span>}
                </label>
                {acessorio}
            </div>
            {children({
                id: campoId,
                "aria-describedby": descritoPor,
                "aria-invalid": erro || invalido ? true : undefined,
                "aria-required": obrigatorio || undefined,
                className: [styles.controle, compacto && styles.compacto].filter(Boolean).join(" "),
            })}
            {erro && <span id={idErro} className={styles.erro}>{erro}</span>}
            {dica && <span id={idDica} className={styles.dica}>{dica}</span>}
        </div>
    );
}

// As props do campo saem antes; o resto vai para o controle
function separar<T extends CampoProps>(props: T) {
    const { rotulo, id, dica, erro, invalido, obrigatorio, opcional, acessorio, compacto, rotuloOculto, className, ...controle } = props;
    return [{ rotulo, id, dica, erro, invalido, obrigatorio, opcional, acessorio, compacto, rotuloOculto, className }, controle] as const;
}

type SemConflito<T> = Omit<T, "id" | "className">;

/** Campo de texto. type="password" ganha o botão de mostrar e esconder a senha. */
export function Entrada(props: CampoProps & SemConflito<InputHTMLAttributes<HTMLInputElement>> & { ref?: Ref<HTMLInputElement> }) {
    const [campo, { ref, type = "text", ...controle }] = separar(props);
    const [mostrar, setMostrar] = useState(false);
    const senha = type === "password";
    return (
        <Campo {...campo}>
            {(ligacao) => (
                <div className={styles.caixa}>
                    <input {...ligacao} {...controle} ref={ref} type={senha && mostrar ? "text" : type}
                        className={[ligacao.className, senha && styles.comBotao].filter(Boolean).join(" ")} />
                    {senha && (
                        <button type="button" className={styles.olho} onClick={() => setMostrar((m) => !m)}
                            aria-label={mostrar ? "Esconder a senha" : "Mostrar a senha"} aria-pressed={mostrar}>
                            {mostrar ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                        </button>
                    )}
                </div>
            )}
        </Campo>
    );
}

/** Lista de escolha (select); as opções vão como filhos. */
export function Selecao(props: CampoProps & SemConflito<SelectHTMLAttributes<HTMLSelectElement>> & { ref?: Ref<HTMLSelectElement> }) {
    const [campo, { ref, children, ...controle }] = separar(props);
    return <Campo {...campo}>{(ligacao) => <select {...ligacao} {...controle} ref={ref}>{children}</select>}</Campo>;
}

/** Texto longo (textarea). */
export function AreaTexto(props: CampoProps & SemConflito<TextareaHTMLAttributes<HTMLTextAreaElement>> & { ref?: Ref<HTMLTextAreaElement> }) {
    const [campo, { ref, ...controle }] = separar(props);
    return <Campo {...campo}>{(ligacao) => <textarea {...ligacao} {...controle} ref={ref} className={`${ligacao.className} ${styles.area}`} />}</Campo>;
}

/** Aparência de controle para quem monta o próprio (linhas compactas sem rótulo visível). */
export const classeDoControle = (compacto = false) => [styles.controle, compacto && styles.compacto].filter(Boolean).join(" ");
