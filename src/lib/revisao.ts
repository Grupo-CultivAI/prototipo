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
