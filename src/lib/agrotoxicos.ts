/**
 * Agrotóxicos nas respostas do chat. O prompt proíbe indicar produto e dose, mas os trechos da
 * Embrapa descrevem experimentos com produto e dose, e o modelo às vezes repassa como
 * recomendação. Em 28/10/2026 ele mandou "tratar as sementes com carbofuran (0,525 kg/ha) e
 * benlate", dois produtos proibidos no Brasil. Esta checagem não depende do modelo.
 */

// A IA escreve com espaços e hífens Unicode: o espaço fino inseparável (U+202F) entre número e
// palavra e o hífen inseparável (U+2011) em "aveia‑preta". Em 03/11/2026, metade das respostas
// tinha um deles, e as expressões abaixo, escritas com espaço e hífen comuns, não as reconheciam.
// Antes de conferir, todo espaço (menos a quebra de linha) vira espaço comum, e todo hífen, "-".
const sem = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\S\n]/g, ' ').replace(/[\u2010-\u2015\u2212]/g, '-').toLowerCase();

// Classes de produto e expressões de uso
const CONTEXTO = /inseticid|fungicid|herbicid|nematicid|acaricid|formicid|agrotoxic|defensivo|tratamento de sementes?|trat\w* (as |das )?sementes|ingrediente ativo|\bi\.\s?a\.|calda/;

// Princípios ativos e marcas que aparecem nos documentos da base ou são comuns no campo
const PRODUTOS = /carbofuran|furadan|benlate|benomil|standak|fipronil|vitavax|thiram|tiram\b|carboxina|imidacloprid|tiametoxam|cruiser|glifosat|roundup|2,4-d|paraquat|atrazin|metomil|endossulfan|endosulfan|abamectin|clorpirif|mancozeb|tebuconazol|azoxistrobin|carbendazim|metamidofos|aldicarb|temik|parationa|monocrotofos|forato|lindano|acefato|lambda.?cialotrin|deltametrin|cipermetrin|diflubenzuron|clorotalonil|propiconazol|epoxiconazol|trifloxistrobin|piraclostrobin/;

// Proibidos no Brasil ou fora do mercado: mesmo sem dose, não podem aparecer como recomendação.
// Revisados em 04/11/2026: o forato está na lista de proibidos da Anvisa (RDC 12/2015); do
// benomil (Benlate) não achamos proibição expressa, mas o fabricante o retirou do mercado em 2001
// e o carbendazim, em que ele se transforma, foi proibido pela Anvisa em 2022. Ele fica na lista:
// o prompt já proíbe citar qualquer produto. Ao mexer aqui, confira no Agrofit (MAPA).
export const PROIBIDOS = /carbofuran|furadan|benlate|benomil|endossulfan|endosulfan|metamidofos|aldicarb|temik|parationa|monocrotofos|forato|lindano|paraquat|carbendazim/;

// Dose: número + unidade, seguida de área, peso de semente ou ingrediente ativo
// ("0,525 kg ha⁻¹", "25 mL i.a./100 kg", "2 L/ha", "200 g por hectare")
const DOSE = /\d+(?:[.,]\d+)?\s*(?:kg|g|l|ml|litros?|gramas?)\b\.?\s*(?:de\s+)?(?:i\.?\s?a\.?|p\.?\s?c\.?|ha\b|ha[⁻-]|\/\s*(?:ha|hectare|100\s*kg|kg)|por\s+(?:ha|hectare|100\s*kg|kg))/;

/** Frases da resposta que indicam agrotóxico com dose, ou citam produto proibido. */
export function frasesComAgrotoxico(resposta: string): string[] {
    const frases = resposta.split(/\n+/).flatMap((linha) => linha.split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ🌱📘🗓*-])/));
    return frases.filter((f) => {
        const n = sem(f);
        if (PROIBIDOS.test(n)) return true;
        return (CONTEXTO.test(n) || PRODUTOS.test(n)) && DOSE.test(n);
    });
}

export function problemaDeAgrotoxico(resposta: string): string | null {
    const frases = frasesComAgrotoxico(resposta);
    if (!frases.length) return null;
    return `A resposta indica agrotóxico com produto ou dose (ou um produto proibido no Brasil): "${frases.map((f) => f.trim().slice(0, 120)).join('" / "')}". Tire o nome do produto e a dose; se o manejo importar, diga só o tipo (por exemplo, "tratamento de sementes") e oriente procurar um engenheiro agrônomo.`;
}

export const AVISO_RECEITUARIO = '> 🧑‍🌾 Para escolher produto e dose de agrotóxicos, procure um engenheiro agrônomo: a compra exige receita agronômica.';

/** Último recurso, se a revisão não resolver: tira as frases e acrescenta o aviso. */
export function semAgrotoxico(resposta: string): string {
    const remover = new Set(frasesComAgrotoxico(resposta).map((f) => f.trim()));
    const linhas = resposta
        .split('\n')
        .map((linha) => linha.split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ🌱📘🗓*-])/).filter((f) => !remover.has(f.trim())).join(' '));
    // Um marcador que ficou sem conteúdo ("🌱 Prática agronômica geral:" seguido de linha
    // vazia, de outro marcador ou do fim) também sai.
    const soMarcador = (l: string | undefined) => /^\s*(?:🌱|📘|🗓)[^.!?]*:\s*$/u.test(l ?? '');
    const marcadorNovo = (l: string | undefined) => l === undefined || !l.trim() || /^\s*(?:🌱|📘|🗓)/u.test(l);
    const limpa = linhas
        .filter((l, i) => !(soMarcador(l) && marcadorNovo(linhas[i + 1])))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return `${limpa}\n\n${AVISO_RECEITUARIO}`;
}
