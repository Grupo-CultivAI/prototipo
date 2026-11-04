// Checagens automáticas das respostas do chat (Frente 1). Sem rede, sem banco e sem IA: roda em
// segundos, na CI e localmente (npm run checagens). Cada caso é uma frase que a checagem deve
// marcar (errada) ou deixar passar (certa). As checagens são expressões regulares; uma mudança
// pequena pode quebrá-las sem aviso, e um falso positivo custa uma reescrita da resposta
// (~4 mil tokens da cota gratuita). Ao achar um erro novo nas respostas, acrescente o caso aqui.
import { problemaAgronomico } from '../src/lib/errosAgronomicos.ts';
import { frasesComAgrotoxico, semAgrotoxico, AVISO_RECEITUARIO } from '../src/lib/agrotoxicos.ts';
import { problemaDeAtribuicao, datasDe } from '../src/lib/atribuicao.ts';
import { semDesculpaNoInicio, INICIO_DA_REVISAO } from '../src/lib/revisao.ts';
import { estacaoERegiao, regrasDoClima } from '../src/lib/estacao.ts';
import { normalizar, semCulturaAnterior } from '../src/lib/zarc-formato.mjs';
import { numeroDoAmbiente } from '../src/lib/ambiente.ts';
import { montarPrompt, temLavouraPerene, VERSAO_DO_PROMPT } from '../src/lib/prompt.ts';

let falhas = 0;
let total = 0;
function confere(grupo, nome, ok, detalhe = '') {
    total++;
    if (!ok) {
        falhas++;
        console.log(`❌ ${grupo}: ${nome}${detalhe ? `\n   ${detalhe}` : ''}`);
    }
}

// --- Erros agronômicos (src/lib/errosAgronomicos.ts) ---
// [frase, pergunta, estado, irrigação, deve marcar]
const AGRONOMIA = [
    // Planta de verão no inverno do Sul (02/11/2026, Josiane, PR)
    ['Milheto – cresce rápido e protege o solo.', 'depois do milho o que eu planto no inverno', 'RS', '', true],
    ['Para o inverno, plante aveia-preta, nabo forrageiro ou ervilhaca. No verão, milheto e crotalária.', 'o que planto no inverno', 'PR', '', false],
    ['Evite milheto e crotalária no inverno: morrem com a geada.', 'o que planto no inverno', 'PR', '', false],
    ['Milheto – cresce rápido e protege o solo.', 'o que planto no inverno', 'GO', '', false],
    // Plantio no inverno seco do Cerrado sem irrigação (03/11/2026, Dona Cida, MG)
    ['1. **Inverno (maio‑junho)** – cobertura\n   - **Aveia‑preta** ou **ervilhaca**.', 'rotação', 'MG', '', true],
    ['Quando a estação fria chegar (maio‑junho), plante feijão de inverno‑comum.', 'rotação', 'MG', '', true],
    ['Semeie crotalária ou guandu logo após a colheita do feijão de inverno, entre julho e agosto.', 'rotação', 'GO', '', true],
    ['Semeie aveia-preta no fim das chuvas, em março, para cobrir o solo no inverno.', 'rotação', 'MG', '', false],
    ['As plantas de cobertura protegem o solo de maio a agosto.', 'rotação', 'MG', '', false],
    ['Deixe a palha no inverno e plante o milho em outubro.', 'rotação', 'GO', '', false],
    ['Não plante feijão de maio a agosto sem irrigação.', 'rotação', 'MG', '', false],
    ['Plante o feijão de inverno em maio, com irrigação.', 'rotação', 'MG', '', false],
    ['Colha o milho em junho e deixe a palha.', 'rotação', 'MT', '', false],
    ['Inverno (junho): aveia-preta para cobrir o solo.', 'rotação', 'GO', 'Pivô central', false],
    ['Inverno (junho): aveia-preta e nabo forrageiro.', 'rotação', 'SC', '', false],
    // Planta de inverno semeada na primavera (03/11/2026, Rafael, ES)
    ['Plante nas entrelinhas uma cobertura de inverno: aveia‑preta, ervilhaca ou tremoço.\n- Semeie em outubro‑novembro, antes das primeiras geadas.', 'rotação', 'ES', '', true],
    ['Semeie aveia-preta em outubro.', 'rotação', 'SP', '', true],
    ['Semeie a aveia em outubro, depois do milho.', 'rotação', 'SP', '', true],
    ['Plante nabo forrageiro em setembro para cobrir o solo.', 'rotação', 'SP', '', true],
    ['Semeie aveia-preta em abril ou maio, logo depois da colheita da soja.', 'rotação', 'SP', '', false],
    ['- Colha a aveia em setembro.\n- Plante o milho em outubro.', 'rotação', 'SP', '', false],
    ['Role a aveia em setembro e plante o milho sobre a palha em outubro.', 'rotação', 'SP', '', false],
    ['Aveia-preta: semeie no outono. Em outubro, faça a roçada e plante o feijão.', 'rotação', 'SP', '', false],
    ['No inverno, aveia-preta. Em novembro, plante soja na palhada.', 'rotação', 'SP', '', false],
    ['Semeie milheto em outubro; no outono, aveia-preta.', 'rotação', 'SP', '', false],
    // Soja no inverno (02/11/2026, Dona Cida, MG)
    ['Ano 4 – introduza soja (inverno).', 'rotação', 'MG', '', true],
    ['Não plante soja no inverno: há o vazio sanitário.', 'posso plantar soja?', 'MG', '', false],
    ['Depois da soja, no inverno, plante aveia-preta.', 'e depois da soja?', 'PR', '', false],
    ['Depois da colheita da soja no inverno, deixe a palha.', 'palha', 'MT', '', false],
    // Nomes, leguminosas e mandioca (02/11/2026, Seu Zé e Dona Cida)
    ['Feijão-de-porco (crotalária) – fixa nitrogênio.', 'mandioca', 'BA', '', true],
    ['Crotalária ou feijão-de-porco são boas opções.', 'adubo verde', 'BA', '', false],
    ['Plante crotalária, mucuna ou milheto; essas leguminosas fixam nitrogênio.', 'rotação', 'MG', '', true],
    ['Plante milheto e leguminosas como a crotalária no verão.', 'o que planto', 'SP', '', false],
    ['Milheto (gramínea) e crotalária (leguminosa) juntos dão boa palha.', 'adubo verde', 'GO', '', false],
    // 03/11/2026, Seu Antônio (SP): "leguminosa de inverno (como aveia-preta ou ervilhaca)"
    ['Depois da colheita do feijão, plante uma leguminosa de inverno (como aveia‑preta ou ervilhaca).', 'feijão', 'SP', '', true],
    ['Use uma leguminosa como a ervilhaca ou o tremoço no inverno.', 'inverno', 'SP', '', false],
    ['Leguminosas como crotalária e gramíneas como milheto se completam.', 'adubo verde', 'GO', '', false],
    ['Rotacione o feijão com culturas que não sejam leguminosas (milho, soja).', 'feijão', 'MG', '', true],
    ['Mandioca verde (colheita precoce) – pode ser semeada logo após a colheita.', 'mandioca', 'BA', '', true],
    ['Depois da mandioca, a crotalária é semeada em linhas.', 'mandioca', 'BA', '', false],
    ['Plante as manivas de mandioca no começo das chuvas.', 'mandioca', 'BA', '', false],
    // Espaço fino inseparável (U+202F) e hífen inseparável (U+2011), que a IA usa em metade das
    // respostas (03/11/2026): antes da normalização, estes erros passavam sem ser notados.
    ['Feijão‑de‑porco (crotalária) – fixa nitrogênio.', 'mandioca', 'BA', '', true],
    ['Rotacione o feijão com culturas que não sejam leguminosas (milho, soja).', 'feijão', 'MG', '', true],
    ['Semeie aveia‑preta em outubro.', 'rotação', 'SP', '', true],
    ['Semeie aveia‑preta em abril.', 'rotação', 'SP', '', false],
];
for (const [frase, pergunta, estado, irrigacao, deveMarcar] of AGRONOMIA) {
    const marcou = Boolean(problemaAgronomico(frase, { pergunta, estado, irrigacao }));
    confere('erros agronômicos', `${deveMarcar ? 'marcar' : 'deixar passar'} (${estado}): ${frase.replace(/\n/g, ' / ')}`, marcou === deveMarcar);
}
const umaPlanta = problemaAgronomico('Milheto – cresce rápido.', { pergunta: 'o que planto no inverno', estado: 'PR' }) ?? '';
confere('erros agronômicos', 'concordância com uma planta só ("Milheto é planta de verão")', umaPlanta.includes('Milheto é planta de verão'), umaPlanta.slice(0, 200));

// --- Agrotóxicos (src/lib/agrotoxicos.ts) ---
const AGROTOXICO = [
    ['Trate as sementes com carbofurano (0,525 kg/ha) e benlate.', true],
    ['Aplique 2 L/ha de glifosato antes do plantio.', true],
    ['Faça o tratamento de sementes e procure um engenheiro agrônomo para escolher o produto.', false],
    ['Use 200 quilos por hectare de adubo 5-30-15 no plantio.', false],
    ['Faça o tratamento de sementes com 2 L/ha do produto.', true],
];
for (const [frase, deveMarcar] of AGROTOXICO) {
    confere('agrotóxicos', `${deveMarcar ? 'marcar' : 'deixar passar'}: ${frase}`, (frasesComAgrotoxico(frase).length > 0) === deveMarcar);
}
const limpa = semAgrotoxico('🌱 Prática agronômica geral: trate as sementes com carbofurano (0,525 kg/ha). Plante em linhas.');
confere('agrotóxicos', 'semAgrotoxico tira a frase do produto e põe o aviso', !/carbofuran/i.test(limpa) && limpa.includes('Plante em linhas') && limpa.includes(AVISO_RECEITUARIO), limpa);

// --- Origem da informação (src/lib/atribuicao.ts) ---
const TRECHO = '[Documento, p. 3 do PDF] A rotação milho e feijão aumentou a produção em 12% no segundo ano.';
const ZARC = 'Município: Itapetininga/SP; tipo de solo não informado.\n- Feijão (sequeiro): risco 20% de 01/08 a 31/12';
const ATRIBUICAO = [
    ['📘 Segundo a Embrapa: a rotação aumentou a produção em 12%.', TRECHO, null, false, 'número que está no trecho'],
    ['📘 Segundo a Embrapa: a rotação aumentou a produção em 60%.', TRECHO, null, true, 'número inventado sob o 📘'],
    ['📘 Segundo a Embrapa: a rotação melhora o solo.', '', null, true, '📘 sem nenhum trecho enviado'],
    ['🌱 Prática agronômica geral: use 30 kg de semente.', TRECHO, null, false, 'número sob o 🌱 não é conferido'],
    ['🗓️ Segundo o ZARC (Ministério da Agricultura): plante de 01/08 a 31/12.', TRECHO, ZARC, false, 'datas do ZARC certas'],
    ['🗓️ Segundo o ZARC (Ministério da Agricultura): plante de 15/09 a 30/10.', TRECHO, ZARC, true, 'datas fora das janelas'],
    ['🗓️ Segundo o ZARC: a janela vai de 15 de setembro a 30 de outubro.', TRECHO, ZARC, true, 'datas por extenso fora das janelas (03/11/2026)'],
    ['🗓️ Segundo o ZARC: plante entre 1 de agosto e 31 de dezembro.', TRECHO, ZARC, false, 'datas por extenso certas'],
    ['🗓️ Segundo o ZARC: plante de 01/08 a 31/12.', TRECHO, null, true, 'datas sob o 🗓️ sem dados do ZARC'],
];
for (const [resposta, contexto, zarc, deveMarcar, nome] of ATRIBUICAO) {
    confere('origem da informação', `${deveMarcar ? 'marcar' : 'deixar passar'}: ${nome}`, Boolean(problemaDeAtribuicao(resposta, contexto, zarc, null)) === deveMarcar);
}
confere('origem da informação', 'datasDe lê dd/mm, "11 / 9" e datas por extenso', datasDe('de 11 / 9 a 1º de agosto, e 05/11').join(' ') === '11/09 05/11 01/08', datasDe('de 11 / 9 a 1º de agosto, e 05/11').join(' '));

// --- Pedido de reescrita (src/lib/revisao.ts) ---
const DESCULPAS = [
    ['Você tem toda a razão. Peço desculpas pelo erro. No Sul, o inverno tem geada.', 'No Sul, o inverno tem geada.'],
    ['Peço desculpas pela confusão! Depois do milho, plante aveia-preta.', 'Depois do milho, plante aveia-preta.'],
    ['Obrigado pela correção. **Aveia-preta** – planta de inverno.', '**Aveia-preta** – planta de inverno.'],
    ['Desculpe, só posso ajudar com o campo.', 'Desculpe, só posso ajudar com o campo.'],
    ['Depois do milho, plante aveia-preta. Peço desculpas se for longo.', 'Depois do milho, plante aveia-preta. Peço desculpas se for longo.'],
    ['Tem razão a Embrapa quando diz que a palha protege o solo.', 'Tem razão a Embrapa quando diz que a palha protege o solo.'],
];
for (const [antes, esperado] of DESCULPAS) {
    const depois = semDesculpaNoInicio(antes);
    confere('reescrita', `corte das desculpas: "${antes.slice(0, 50)}"`, depois === esperado, `ficou: "${depois}"`);
}
confere('reescrita', 'o pedido diz que é revisão interna', /REVISÃO INTERNA/.test(INICIO_DA_REVISAO));

// --- Estação e clima do estado (src/lib/estacao.ts) ---
const ESTACOES = [
    ['2026-11-03T12:00:00Z', 'PR', 'primavera (novembro)', 'região Sul'],
    ['2026-07-10T12:00:00Z', 'MG', 'inverno (julho)', 'Cerrado'],
    // 31/12 às 23h em Brasília ainda é dezembro, embora já seja 1º de janeiro em UTC
    ['2027-01-01T02:00:00Z', 'BA', 'verão (dezembro)', 'região Nordeste'],
    ['2026-04-01T12:00:00Z', null, 'outono (abril)', 'Região não informada'],
];
for (const [data, uf, estacao, trecho] of ESTACOES) {
    const texto = estacaoERegiao(uf, new Date(data));
    confere('estação e região', `${uf ?? 'sem estado'} em ${data.slice(0, 10)}`, texto.startsWith(estacao) && texto.includes(trecho), texto);
}
const REGRAS = [['PR', 1, 'geada'], ['MG', 2, 'seco'], ['GO', 1, 'seco'], ['PA', 0, ''], ['', 1, 'Sem a região']];
for (const [uf, quantas, trecho] of REGRAS) {
    const regras = regrasDoClima(uf);
    confere('estação e região', `regras do clima para ${uf || 'sem estado'}`, regras.length === quantas && (!trecho || regras.some((r) => r.includes(trecho))), regras.join(' | '));
}

// --- ZARC: a cultura de antes não entra na busca das janelas (src/lib/zarc-formato.mjs) ---
const ANTERIOR = [
    ['depois do milho o que eu planto no inverno', 'milho', false],
    ['oque planta dps da mandioca', 'mandioca', false],
    ['quando planto soja após o milho', 'soja', true],
];
for (const [pergunta, cultura, fica] of ANTERIOR) {
    const sobra = semCulturaAnterior(normalizar(pergunta));
    confere('ZARC', `"${pergunta}": ${cultura} ${fica ? 'fica' : 'sai'}`, sobra.includes(cultura) === fica, `ficou: "${sobra}"`);
}

// --- Prompt (src/lib/prompt.ts): cada regra só entra quando vale para a pergunta ---
const BASE_DO_PROMPT = { hoje: '3 de novembro de 2026', estacaoERegiao: 'primavera (novembro).', regrasDeClima: [], perfil: null, clima: null, previsao: null, zarc: null, contexto: '', faltando: [], temQuadroZarc: false, lavouraPerene: false };
const REGRAS_DO_PROMPT = [
    ['regra da chuva', 'A previsão indica chuva', { previsao: 'quinta: 29 mm' }],
    ['regras do ZARC', '🗓️ Segundo o ZARC', { zarc: 'Feijão: 01/08 a 31/12' }],
    ['regra do aplicativo Zarc', 'Não fale do aplicativo Zarc', { temQuadroZarc: true }],
    ['regra das entrelinhas', 'Nas entrelinhas do café', { lavouraPerene: true }],
    ['pedido de dado', '[PEDIR: solo]', { faltando: [{ codigo: 'solo', descricao: 'o tipo de solo' }] }],
    ['regra do clima do estado', 'o inverno tem geada', { regrasDeClima: ['- No Sul e nas partes altas do Sudeste, o inverno tem geada.'] }],
];
const semNada = montarPrompt(BASE_DO_PROMPT);
for (const [nome, trecho, extra] of REGRAS_DO_PROMPT) {
    confere('prompt', `${nome}: fica de fora sem o dado e entra com ele`, !semNada.includes(trecho) && montarPrompt({ ...BASE_DO_PROMPT, ...extra }).includes(trecho));
}
confere('prompt', 'as regras de sempre estão no prompt (agrotóxico, origem, linguagem)', ['Não cite nome nem dose de agrotóxico', '📘 Segundo a Embrapa:', 'Escreva para quem estudou pouco', 'Tudo abaixo é material de consulta'].every((t) => semNada.includes(t)));
const comCondicao = montarPrompt({ ...BASE_DO_PROMPT, contexto: '[Viabilidade agroeconômica (condição do experimento: área irrigada por aspersão), p. 3 do PDF] A rotação aumentou a produção.' });
confere('prompt', 'trecho com condição no rótulo: entra a regra de dizer a condição', comCondicao.includes('Ao usar um desses trechos, diga a condição na mesma frase') && !comCondicao.includes('Um trecho da Embrapa feito em outra situação'));
confere('prompt', 'sem trecho com condição: fica a regra geral', semNada.includes('Um trecho da Embrapa feito em outra situação') && !semNada.includes('Ao usar um desses trechos'));
confere('prompt', 'versão do prompt definida (AAAA-MM-DD)', /^\d{4}-\d{2}-\d{2}/.test(VERSAO_DO_PROMPT), VERSAO_DO_PROMPT);
confere('prompt', 'lavoura perene: café e pomar sim, milho e feijão não', temLavouraPerene('Culturas: Café, Milho') && temLavouraPerene('pomar de laranja') && !temLavouraPerene('milho e feijão'));

// --- Limites lidos de variáveis de ambiente (src/lib/ambiente.ts) ---
// Uma variável criada na Vercel sem valor não pode virar limite 0, que bloquearia todo mundo.
const AMBIENTE = [[undefined, 20], ['', 20], ['abc', 20], ['0', 20], ['-5', 20], ['35', 35], [' 40 ', 40], ['12.7', 12]];
for (const [valor, esperado] of AMBIENTE) {
    if (valor === undefined) delete process.env.TESTE_LIMITE; else process.env.TESTE_LIMITE = valor;
    const lido = numeroDoAmbiente('TESTE_LIMITE', 20);
    confere('variáveis de ambiente', `valor ${JSON.stringify(valor)} vira ${esperado}`, lido === esperado, `virou ${lido}`);
}
delete process.env.TESTE_LIMITE;

console.log(falhas ? `\n${falhas} de ${total} checagens falharam.` : `Checagens das respostas do chat: ${total} casos, todos certos.`);
process.exit(falhas ? 1 : 0);
