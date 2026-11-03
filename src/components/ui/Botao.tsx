import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./Botao.module.css";

// Botão do design system (docs/design-system.md). Com href vira link (<Link>; <a> para endereço
// externo ou mailto:), com a mesma aparência; sem href, <button type="button">.
// Sem hooks: funciona também nas páginas que são componentes de servidor (Painel, Meus Cultivos).
export type VarianteBotao = "principal" | "secundario" | "neutro" | "discreto" | "perigo" | "perigoDiscreto" | "claro";
export type TamanhoBotao = "p" | "m" | "g";

type Proprias = {
    variante?: VarianteBotao;
    tamanho?: TamanhoBotao;
    /** Cantos totalmente arredondados */
    pilula?: boolean;
    larguraTotal?: boolean;
    /** Ícone do lucide-react antes do texto */
    icone?: LucideIcon;
    iconeDepois?: LucideIcon;
    /** Sem texto visível: o nome lido pelo leitor de tela vem de `rotulo` */
    apenasIcone?: boolean;
    rotulo?: string;
    /** Desativa e mostra `textoCarregando` (ex.: "Salvando...") */
    carregando?: boolean;
    textoCarregando?: string;
    href?: string;
    target?: string;
    rel?: string;
    ref?: Ref<HTMLButtonElement | HTMLAnchorElement>;
    className?: string;
    children?: ReactNode;
};
export type BotaoProps = Proprias & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Proprias>;

const TAMANHO_DO_ICONE: Record<TamanhoBotao, number> = { p: 16, m: 18, g: 20 };

export default function Botao({
    variante = "principal", tamanho = "m", pilula = false, larguraTotal = false,
    icone: Icone, iconeDepois: IconeDepois, apenasIcone = false, rotulo,
    carregando = false, textoCarregando, href, type = "button", disabled, className, children, ref, ...resto
}: BotaoProps) {
    if (process.env.NODE_ENV !== "production" && apenasIcone && !rotulo) {
        console.error("Botao: apenasIcone precisa de `rotulo`, o nome lido pelo leitor de tela.");
    }
    const classe = [
        styles.botao, styles[variante], styles[tamanho],
        pilula && styles.pilula, larguraTotal && styles.larguraTotal, apenasIcone && styles.apenasIcone, className,
    ].filter(Boolean).join(" ");
    const tamanhoIcone = TAMANHO_DO_ICONE[tamanho];
    const conteudo = (
        <>
            {Icone && <Icone size={tamanhoIcone} aria-hidden="true" />}
            {/* Só ícone e sem `icone`: o próprio filho é o ícone (ex.: alterna entre dois ícones) */}
            {apenasIcone ? !Icone && children : carregando && textoCarregando ? textoCarregando : children}
            {IconeDepois && <IconeDepois size={tamanhoIcone} aria-hidden="true" />}
        </>
    );
    const nome = apenasIcone ? { "aria-label": rotulo, title: resto.title ?? rotulo } : {};

    if (href) {
        // Atributos de botão (onClick, title, aria-*) servem também ao link
        const atributos = resto as Record<string, unknown>;
        return /^(https?:|mailto:)/.test(href)
            ? <a href={href} ref={ref as Ref<HTMLAnchorElement>} className={classe} {...nome} {...atributos}>{conteudo}</a>
            : <Link href={href} ref={ref as Ref<HTMLAnchorElement>} className={classe} {...nome} {...atributos}>{conteudo}</Link>;
    }
    return (
        <button type={type} ref={ref as Ref<HTMLButtonElement>} className={classe} disabled={disabled || carregando} aria-busy={carregando || undefined} {...nome} {...resto}>
            {conteudo}
        </button>
    );
}
