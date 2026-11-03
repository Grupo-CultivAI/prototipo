import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import styles from "./Aviso.module.css";

// Aviso do design system: sempre ícone + texto, para a cor não ser a única pista (WCAG 1.4.1).
// Erro e alerta são anunciados na hora pelo leitor de tela (role="alert"); sucesso e info,
// sem interromper (role="status"). `papel` troca o papel: "note" para um aviso que já vem na
// página e não deve ser anunciado, null para nenhum.
export type TipoAviso = "erro" | "alerta" | "sucesso" | "info";

const ICONE = { erro: AlertCircle, alerta: TriangleAlert, sucesso: CheckCircle2, info: Info };

export default function Aviso({ tipo = "info", papel, className, children }: {
    tipo?: TipoAviso; papel?: string | null; className?: string; children: ReactNode;
}) {
    const Icone = ICONE[tipo];
    const role = papel === null ? undefined : papel ?? (tipo === "erro" || tipo === "alerta" ? "alert" : "status");
    return (
        <div role={role} className={[styles.aviso, styles[tipo], className].filter(Boolean).join(" ")}>
            <Icone size={18} aria-hidden="true" className={styles.icone} />
            <div className={styles.texto}>{children}</div>
        </div>
    );
}
