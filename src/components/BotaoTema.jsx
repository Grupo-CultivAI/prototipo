"use client";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import Botao from "@/components/ui/Botao";
import { aplicarTema, definirTema, temaAtual, temaInicial } from "@/lib/tema";

// Botão de tema claro / escuro: no topo das páginas públicas, na barra lateral do computador e em
// Minha Conta (no celular, a navegação do rodapé não tem espaço para mais um item).
// O texto diz o tema para onde o botão leva ("Tema escuro" quando a tela está clara).
// As outras props vão para o Botao (variante, tamanho, larguraTotal, apenasIcone...).

// Vários botões na mesma tela (barra lateral e Minha Conta) ficam iguais: todos observam o atributo
// data-tema do <html>, que é a fonte da verdade.
function observar(avisar) {
    const observador = new MutationObserver(avisar);
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => observador.disconnect();
}

export default function BotaoTema({ variante = "neutro", ...props }) {
    // No servidor não há tema: ele desenha "claro", e o React acerta logo depois de carregar
    const tema = useSyncExternalStore(observar, temaAtual, () => "claro");

    // Em desenvolvimento, o React remonta a página uma vez e limpa os atributos do <html>, inclusive
    // o que o script do <head> pôs. Aplica de novo antes de pintar; em produção não muda nada.
    useLayoutEffect(() => {
        aplicarTema(temaInicial());
    }, []);

    const proximo = tema === "escuro" ? "claro" : "escuro";
    const texto = proximo === "escuro" ? "Tema escuro" : "Tema claro";
    return (
        <Botao
            variante={variante}
            icone={proximo === "escuro" ? Moon : Sun}
            rotulo={`Mudar para o tema ${proximo}`}
            title={`Mudar para o tema ${proximo}`}
            onClick={() => definirTema(proximo)}
            {...props}
        >
            {texto}
        </Botao>
    );
}
