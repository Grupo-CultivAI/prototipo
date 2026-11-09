// Tema claro e escuro. O tema vai no atributo data-tema do <html> ("escuro"; sem atributo, claro),
// e as cores de cada um estão em src/styles/variables.css.
//
// A escolha fica salva no navegador (localStorage). Sem escolha, vale o tema do aparelho
// (prefers-color-scheme). O SCRIPT_DO_TEMA roda no <head> antes da página aparecer, para não
// piscar o tema claro antes do escuro (guia do Next: "Preventing flash before hydration").

export const CHAVE_DO_TEMA = 'cultivai-tema';

// Mesmo critério de temaInicial(), em JavaScript simples: vai como texto para o <script>.
export const SCRIPT_DO_TEMA = `(function(){try{var t=localStorage.getItem("${CHAVE_DO_TEMA}");if(t!=="claro"&&t!=="escuro")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro";if(t==="escuro")document.documentElement.setAttribute("data-tema","escuro")}catch(e){}})()`;

/** Tema salvo ou, sem escolha salva, o do aparelho */
export function temaInicial() {
    try {
        const salvo = localStorage.getItem(CHAVE_DO_TEMA);
        if (salvo === 'claro' || salvo === 'escuro') return salvo;
    } catch { /* navegador sem localStorage (janela anônima de alguns celulares) */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

/** Tema que está na tela agora */
export function temaAtual() {
    return document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro';
}

export function aplicarTema(tema) {
    if (tema === 'escuro') document.documentElement.setAttribute('data-tema', 'escuro');
    else document.documentElement.removeAttribute('data-tema');
}

/** Troca o tema e guarda a escolha */
export function definirTema(tema) {
    aplicarTema(tema);
    try {
        localStorage.setItem(CHAVE_DO_TEMA, tema);
    } catch { /* sem localStorage: vale só até fechar a página */ }
}
