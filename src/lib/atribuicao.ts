/**
 * Origem da informação nas respostas do chat: o que vem depois de "📘 Segundo a Embrapa" e de
 * "🗓️ Segundo o ZARC" precisa estar no material enviado ao modelo. Usado por
 * src/app/api/llm/route.ts. Sem imports, para os testes em node (tests/checagens.mjs) a usarem direto.
 */

// Números sob "📘 Segundo a Embrapa" precisam constar dos trechos enviados. Em 25/10/2026 o
// modelo atribuiu à Embrapa uma redução de "60%" que não existe em nenhum documento da base.
const NUMERO = /\d+(?:[.,]\d+)*\s?%?/g;
const numerosRelevantes = (texto: string) =>
    (texto.match(NUMERO) ?? []).map((n) => n.replace(/\s/g, '')).filter((n) => /\d{2,}|[.,]\d|%/.test(n));
const semSeparador = (n: string) => n.replace(/[.,%]/g, '');
// Texto sob um marcador de origem, até o próximo marcador
const blocosAtribuidos = (resposta: string, marcador: '📘' | '🗓') =>
    [...resposta.matchAll(marcador === '📘' ? /📘([\s\S]*?)(?=📘|🌱|🗓|$)/gu : /🗓([\s\S]*?)(?=📘|🌱|🗓|$)/gu)].map((m) => m[1]).join('\n');
const numerosSemRespaldo = (atribuido: string, fonte: string) => {
    const daFonte = new Set(numerosRelevantes(fonte).map(semSeparador));
    return [...new Set(numerosRelevantes(atribuido).filter((n) => !daFonte.has(semSeparador(n))))];
};

// "11 / 9", "11/09" e "11 de setembro" viram "11/09". Em 03/11/2026 a IA escreveu sob "🗓️" uma
// janela por extenso ("15 de setembro a 30 de outubro") que não estava no ZARC, e a checagem,
// que só lia dd/mm, deixou passar.
const MES_POR_NOME: Record<string, string> = { janeiro: '01', fevereiro: '02', 'março': '03', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };
export const datasDe = (texto: string) => [
    ...[...texto.matchAll(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/g)].map((m) => `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}`),
    ...[...texto.matchAll(/\b(\d{1,2})º?\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi)]
        .map((m) => `${m[1].padStart(2, '0')}/${MES_POR_NOME[m[2].toLowerCase()]}`),
];

// O mesmo vale para as datas sob "🗓️ Segundo o ZARC": precisam estar nas janelas enviadas.
export function problemaDeAtribuicao(resposta: string, contexto: string, zarc: string | null, previsao: string | null): string | null {
    const problemas: string[] = [];
    const daEmbrapa = blocosAtribuidos(resposta, '📘');
    if (daEmbrapa.trim()) {
        if (!contexto) {
            problemas.push('Nenhum trecho da Embrapa foi fornecido para esta pergunta, então o marcador "📘 Segundo a Embrapa" não pode ser usado; use "🌱 Prática agronômica geral".');
        } else {
            // O bloco vai até o próximo marcador e pode pegar a frase da previsão de chuva.
            const semRespaldo = numerosSemRespaldo(daEmbrapa, `${contexto}\n${previsao ?? ''}`);
            if (semRespaldo.length && zarc && !numerosSemRespaldo(semRespaldo.join(' '), zarc).length) {
                problemas.push('As datas de plantio vêm do ZARC, do Ministério da Agricultura, e não da Embrapa: tire-as de depois de "📘" e coloque-as depois de "🗓️ Segundo o ZARC (Ministério da Agricultura):".');
            } else if (semRespaldo.length) problemas.push(`Estes números aparecem depois de "📘 Segundo a Embrapa", mas não constam dos trechos da Embrapa fornecidos: ${semRespaldo.join(', ')}. Tire esses números.`);
        }
    }
    // Sob "🗓️" só as datas (dd/mm) são conferidas. O bloco vai até o próximo marcador e pode
    // pegar a frase da previsão de chuva, cujas datas também valem. Indicar o aplicativo com o
    // marcador, sem datas, não é problema.
    const doZarc = blocosAtribuidos(resposta, '🗓');
    const validas = new Set(datasDe(`${zarc ?? ''}\n${previsao ?? ''}`));
    const datasSemRespaldo = [...new Set(datasDe(doZarc).filter((d) => !validas.has(d)))];
    if (datasSemRespaldo.length) {
        problemas.push(zarc
            ? `Estas datas aparecem depois de "🗓️ Segundo o ZARC", mas não constam das janelas do ZARC fornecidas: ${datasSemRespaldo.join(', ')}. Copie as datas exatamente como estão nas janelas.`
            : 'Não há dados do ZARC para esta pergunta, então nenhuma data oficial pode ser dada depois de "🗓️"; indique o aplicativo Zarc Plantio Certo.');
    }
    return problemas.length ? `${problemas.join(' ')} Reescreva a resposta completa. Não invente valores.` : null;
}
