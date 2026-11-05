/**
 * Pedido de reescrita, quando uma checagem acha um problema na resposta do chat. Usado por
 * src/app/api/llm/route.ts. Sem imports, para os testes em node (tests/checagens.mjs) a usarem direto.
 */

// O pedido de revisão vai ao modelo como mensagem de usuário, e o modelo achava que era o
// produtor reclamando: em 03/11/2026 o nemotron da NVIDIA começou a resposta revisada com "Você
// tem toda a razão. Peço desculpas pelo erro." O produtor nunca vê a primeira resposta.
export const INICIO_DA_REVISAO = 'REVISÃO INTERNA DO CULTIVAI (o produtor não vê esta mensagem nem a resposta anterior). Problemas encontrados: ';
export const FIM_DA_REVISAO = ' Escreva a resposta para o produtor como se fosse a primeira: não peça desculpas, não agradeça a correção e não diga que houve erro ou revisão.';
// Se o modelo se desculpar mesmo assim, as frases de desculpa do começo saem.
const DESCULPA_NO_INICIO = /^\s*(?:(?:voc[êe] tem (?:toda a )?raz[ãa]o|tem toda a raz[ãa]o|pe[çc]o desculpas|me desculpe|desculpe(?:-me)? pel[oa] \S+|perd[ãa]o pel[oa] \S+|obrigad[oa] pela corre[çc][ãa]o)[^.!?\n]*[.!?]\s*)+/i;
export const semDesculpaNoInicio = (texto: string) => texto.replace(DESCULPA_NO_INICIO, '');

// Em 05/11/2026 a IA perguntou "Qual é o código do solo da sua fazenda?": o prompt chamava a marca
// [PEDIR: solo] de "código". Para o produtor, é o tipo de solo.
export const semCodigoDoSolo = (texto: string) => texto.replace(/\bc[oó]digo (?:d[oe] )?solo\b/gi, 'tipo de solo');

// Números escritos por extenso. O prompt pede "4,5 milímetros", mas em 05/11/2026 a IA escreveu
// "quatro vírgula cinco milímetros", "mais de quarenta milímetros" e "sacas de sessenta quilos".
// Os números pequenos ("dois dias", "uma saca") são naturais e ficam; os decimais e os grandes,
// antes de uma unidade, não. Só a forma: se a reescrita não resolver, a resposta sai assim mesmo.
const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\S\n]/g, ' ').toLowerCase();
const PEQUENO = 'zero|uma?|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez';
const GRANDE = 'onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzent[ao]s|trezent[ao]s|quatrocent[ao]s|quinhent[ao]s|seiscent[ao]s|setecent[ao]s|oitocent[ao]s|novecent[ao]s|mil';
const UNIDADE = 'milimetros?|quilos?|quilogramas?|sacas?|toneladas?|hectares?|graus|por cento|metros?|centimetros?|litros?|reais|plantas|sementes';
// "quatro virgula cinco"; "quarenta milimetros", "sessenta e cinco quilos" (não depois de algarismo: "200 mil sementes")
const DECIMAL_POR_EXTENSO = new RegExp(`\\b(${PEQUENO}|${GRANDE})\\s+virgula\\s+(${PEQUENO}|${GRANDE})\\b`);
const GRANDE_COM_UNIDADE = new RegExp(`(?<![\\d.,]\\s*)\\b(${GRANDE})(\\s+e\\s+(${PEQUENO}|${GRANDE}))*\\s+(de\\s+)?(${UNIDADE})\\b`);

/** Pedido de reescrita quando a resposta escreve números por extenso, ou null. */
export function problemaDeEscrita(resposta: string): string | null {
    const n = sem(resposta);
    return DECIMAL_POR_EXTENSO.test(n) || GRANDE_COM_UNIDADE.test(n)
        ? 'Escreva os números em algarismos, com a unidade por extenso: "4,5 milímetros", "40 milímetros", "60 quilos", não "quatro vírgula cinco milímetros" nem "sessenta quilos".'
        : null;
}
