import { inicioDoDecendio, fimDoDecendio } from '@/lib/zarc-formato.mjs';

// A janela do ZARC em relação a hoje, em frase. Usada no calendário do Painel, nos cartões de
// Meus Cultivos e nos avisos de janela. riscos: 36 decêndios (0 = plantio não indicado);
// null = não indicado no solo.

const DIA_MS = 86_400_000;
const ULTIMO_DIA = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Hoje no horário de Brasília, como data UTC à meia-noite (para contar dias inteiros).
function hojeEmBrasilia(agora = new Date()) {
    const [dia, mes, ano] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'numeric', year: 'numeric' })
        .format(agora).split('/').map(Number);
    return Date.UTC(ano, mes - 1, dia);
}

// Decêndio de hoje (0 a 35), no horário de Brasília.
export function decendioDeHoje(agora = new Date()) {
    const hoje = new Date(hojeEmBrasilia(agora));
    const dia = hoje.getUTCDate();
    return hoje.getUTCMonth() * 3 + (dia <= 10 ? 0 : dia <= 20 ? 1 : 2);
}

// Dias de hoje até o dia/mês dado, na próxima vez que ele chegar (0 = hoje).
function diasAte(mes, dia, hoje) {
    const ano = new Date(hoje).getUTCFullYear();
    let alvo = Date.UTC(ano, mes, dia);
    if (alvo < hoje) alvo = Date.UTC(ano + 1, mes, dia);
    return Math.round((alvo - hoje) / DIA_MS);
}
const primeiroDia = (i) => ({ mes: Math.floor(i / 3), dia: [1, 11, 21][i % 3] });
const ultimoDia = (i) => ({ mes: Math.floor(i / 3), dia: [10, 20, ULTIMO_DIA[Math.floor(i / 3)]][i % 3] });

export const emDias = (n) => (n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`);

// Dentro da janela (até quando e quantos dias faltam para fechar) ou quando ela abre (e em
// quantos dias). fechaEmDias conta até o último dia da janela, inclusive.
export function situacaoDaJanela(riscos, agora = new Date()) {
    if (!riscos) return { agora: false, texto: 'Não indicado para o seu tipo de solo' };
    if (!riscos.some(Boolean)) return { agora: false, texto: 'Plantio não indicado no município' };
    const hoje = hojeEmBrasilia(agora);
    const d = decendioDeHoje(agora);
    if (riscos.every(Boolean)) return { agora: true, risco: riscos[d], fechaEmDias: null, texto: `Plantio indicado o ano todo (risco ${riscos[d]}% agora)` };
    if (riscos[d]) {
        let fim = d;
        while (fim - d < 35 && riscos[(fim + 1) % 36]) fim++;
        const ultimo = ultimoDia(fim % 36);
        const fechaEmDias = diasAte(ultimo.mes, ultimo.dia, hoje);
        const ate = fimDoDecendio((fim % 36) + 1);
        return { agora: true, ate, risco: riscos[d], fechaEmDias, texto: `Época de plantio agora, até ${ate} (risco ${riscos[d]}%)` };
    }
    for (let k = 1; k < 36; k++) {
        const i = (d + k) % 36;
        if (riscos[i]) {
            const { mes, dia } = primeiroDia(i);
            const abreEmDias = diasAte(mes, dia, hoje);
            const inicio = inicioDoDecendio(i + 1);
            return { agora: false, inicio, abreEmDias, texto: `A janela abre em ${inicio} (${emDias(abreEmDias).replace(/^em /, 'daqui a ')})` };
        }
    }
    return { agora: false, texto: '' };
}
