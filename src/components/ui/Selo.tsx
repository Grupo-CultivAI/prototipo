import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";
import styles from "./Selo.module.css";

// Selo curto de situação ("Completo", "Falta 1", "Corrigir", "próxima"). O ícone acompanha a cor
// em ok e erro, para a situação não depender só dela.
// destaque: verde cheio (ex.: "próxima" no calendário de plantio)
export type TipoSelo = "ok" | "falta" | "erro" | "neutro" | "destaque";

const ICONE: Partial<Record<TipoSelo, typeof Check>> = { ok: Check, erro: AlertCircle };

export default function Selo({ tipo = "neutro", icone = true, className, children }: {
    tipo?: TipoSelo; icone?: boolean; className?: string; children: ReactNode;
}) {
    const Icone = icone ? ICONE[tipo] : undefined;
    return (
        <span className={[styles.selo, styles[tipo], className].filter(Boolean).join(" ")}>
            {Icone && <Icone size={14} aria-hidden="true" />}
            {children}
        </span>
    );
}
