import { inicioDoDecendio, fimDoDecendio } from '@/lib/zarc-formato.mjs';

// A janela do ZARC em relação a hoje, em frase. Usada no calendário do Painel e nos cartões de
// Meus Cultivos. riscos: 36 decêndios (0 = plantio não indicado); null = não indicado no solo.

// Decêndio de hoje (0 a 35), no horário de Brasília.
export function decendioDeHoje() {
    const [dia, mes] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'numeric' })
        .format(new Date()).split('/').map(Number);
    return (mes - 1) * 3 + (dia <= 10 ? 0 : dia <= 20 ? 1 : 2);
}

// Dentro da janela (até quando) ou quando ela abre. abreEm: daqui a quantos decêndios.
export function situacaoDaJanela(riscos, hoje = decendioDeHoje()) {
    if (!riscos) return { agora: false, texto: 'Não indicado para o seu tipo de solo' };
    if (!riscos.some(Boolean)) return { agora: false, texto: 'Plantio não indicado no município' };
    if (riscos[hoje]) {
        let fim = hoje;
        while (fim - hoje < 35 && riscos[(fim + 1) % 36]) fim++;
        return { agora: true, ate: fimDoDecendio((fim % 36) + 1), risco: riscos[hoje], texto: `Época de plantio agora, até ${fimDoDecendio((fim % 36) + 1)} (risco ${riscos[hoje]}%)` };
    }
    for (let k = 1; k < 36; k++) {
        const i = (hoje + k) % 36;
        if (riscos[i]) return { agora: false, abreEm: k, inicio: inicioDoDecendio(i + 1), texto: `A janela abre em ${inicioDoDecendio(i + 1)}` };
    }
    return { agora: false, texto: '' };
}
