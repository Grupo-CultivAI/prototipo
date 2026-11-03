import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import styles from "./Opcoes.module.css";

// Opções clicáveis (culturas, próxima safra): botões que ligam e desligam (aria-pressed), num
// grupo com nome, como pede a norma para conjuntos de opções. Quem usa decide se é uma ou
// várias: `alternar` recebe a opção tocada.
export default function Opcoes({ rotulo, rotuloId, opcoes, marcadas, alternar, className }: {
    /** Nome do grupo, mostrado acima. Ou `rotuloId`, quando o rótulo já está na página. */
    rotulo?: ReactNode;
    rotuloId?: string;
    opcoes: string[];
    marcadas: string[];
    alternar: (opcao: string) => void;
    className?: string;
}) {
    const idDoRotulo = rotuloId ?? (rotulo ? `opcoes-${opcoes.join("-").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}` : undefined);
    return (
        <div className={className}>
            {rotulo && <span id={idDoRotulo} className={styles.rotulo}>{rotulo}</span>}
            <div className={styles.opcoes} role="group" aria-labelledby={idDoRotulo}>
                {opcoes.map((o) => (
                    <button key={o} type="button" aria-pressed={marcadas.includes(o)} onClick={() => alternar(o)} className={styles.opcao}>
                        {o}
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Caixa de marcar com o texto ao lado, num cartão que inteiro responde ao toque. */
export function Marcar({ children, className, ref, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode; ref?: Ref<HTMLInputElement> }) {
    return (
        <label className={[styles.marcar, className].filter(Boolean).join(" ")}>
            <input type="checkbox" ref={ref} {...input} />
            <span>{children}</span>
        </label>
    );
}
