/**
 * Estação do ano e clima da região, para o prompt do chat. Em 02/11/2026, no teste com personas,
 * a IA indicou milheto e crotalária (plantas de verão, que morrem com a geada) para o inverno do
 * sul do Paraná, e soja no inverno de Minas Gerais. Com a estação e a região escritas no prompt,
 * o modelo não precisa deduzir de "novembro" e "PR" que lá é primavera e que o inverno gela.
 */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// Hemisfério sul: o verão vai de dezembro a fevereiro
const ESTACAO_DO_MES = ['verão', 'verão', 'outono', 'outono', 'outono', 'inverno', 'inverno', 'inverno', 'primavera', 'primavera', 'primavera', 'verão'];

const ESTADOS_DO_SUL = ['PR', 'SC', 'RS'];

// Descrições gerais: dentro de um estado o clima varia, por isso "nas partes altas" e afins.
const CLIMA_DA_REGIAO: [string[], string][] = [
    [ESTADOS_DO_SUL, 'inverno frio, com geadas; verão quente e chuvoso (região Sul)'],
    [['SP', 'MS'], 'inverno seco e mais frio, com geada possível no sul do estado e nas partes altas; verão quente e chuvoso'],
    [['MG'], 'chuvas de outubro a março e inverno seco; em boa parte do estado é Cerrado, onde sem irrigação quase nada se planta de maio a setembro; geada possível nas serras e no sul do estado'],
    [['RJ', 'ES'], 'chuvas de outubro a março e inverno mais seco; geada possível nas serras e partes altas'],
    [['GO', 'DF', 'MT', 'TO'], 'chuvas de outubro a abril e seca de maio a setembro; sem irrigação, quase nada se planta na seca (Cerrado)'],
    [['RR'], 'quente o ano todo, sem geada; ao norte da linha do equador, chove de abril a setembro e o fim do ano é seco (região Norte)'],
    [['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'], 'chuvas concentradas em poucos meses, que mudam conforme a parte do estado: no litoral, mais no outono e no inverno; no Semiárido, curtas e irregulares, com seca longa (região Nordeste)'],
    [['AC', 'AM', 'AP', 'PA', 'RO', 'RR'], 'quente o ano todo, sem geada, com uma época de muita chuva e outra mais seca (região Norte)'],
];

function mesEmSaoPaulo(data: Date): number {
    const mes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', month: 'numeric' }).format(data);
    return Number(mes) - 1;
}

// Regras do prompt que só valem em parte do país. Mandar só a do estado do produtor economiza
// tokens (a Groq gratuita aguenta 8 mil por minuto por modelo) sem tirar nada que se aplique.
const COM_GEADA = [...ESTADOS_DO_SUL, 'SP', 'RJ', 'ES', 'MG', 'MS'];
const COM_INVERNO_SECO = ['MG', 'GO', 'DF', 'MT', 'TO'];
// No Nordeste e em MS a época das chuvas muda dentro do estado. Até 04/11/2026 eles recebiam a
// regra do inverno seco, mas no leste do Nordeste o outono e o inverno são a época de plantar:
// o ZARC de Cruz das Almas (BA) tem as janelas de risco 20% do feijão-caupi de maio a julho e
// as do milho de abril a junho.
const NORDESTE = ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'];
const REGRA_DA_GEADA = '- No Sul e nas partes altas do Sudeste, o inverno tem geada: para o inverno, indique só plantas de inverno.';
const REGRA_DO_INVERNO_SECO = '- Onde o inverno é seco (Cerrado, que cobre boa parte de MG, GO, MT, TO e DF), sem irrigação quase nada cresce de maio a setembro: não indique plantio nesses meses, nem de plantas de inverno. Lá a cobertura (milheto, sorgo, braquiária, crotalária) é semeada no fim das chuvas, logo depois da colheita. Se perguntarem o que plantar nesses meses, diga que sem irrigação não é época de plantio e diga o que fazer até as chuvas voltarem (manter a palha no solo, preparar o plantio de outubro).';
const REGRA_DO_NORDESTE = '- No Nordeste, a época das chuvas muda de uma parte do estado para outra: no litoral e na Zona da Mata chove mais no outono e no inverno, e é quando se planta milho, feijão e mandioca; no Semiárido as chuvas são curtas e irregulares; no oeste (Cerrado) chove no verão e o inverno é seco. Para dizer quando plantar, siga as janelas do ZARC do município: um mês dentro da janela de risco 20% tem chuva para plantar, então não o chame de época seca. Sem as janelas, diga que a época depende da parte do estado e oriente confirmar com a assistência técnica local.';
const REGRA_DO_MS = '- Em MS, o norte do estado é Cerrado, com inverno seco: lá, sem irrigação, quase nada se planta de maio a setembro. No sul, há plantio no outono (milho safrinha, aveia, trigo). Para dizer quando plantar, siga as janelas do ZARC do município; sem elas, diga que a época depende da parte do estado.';
// Ao norte da linha do equador, as chuvas vêm no meio do ano. No teste de 04/11/2026, com a
// primeira redação, a IA disse que plantar soja em maio em Boa Vista "costuma ser arriscado".
// No ZARC de Boa Vista, o risco 20% da soja vai de 11/04 a 30/06, e o do milho, de 21/04 a 30/06.
const REGRA_DE_RORAIMA = '- Em Roraima, ao norte da linha do equador, chove de abril a setembro, e é nessa época que se planta sem irrigação: de abril a junho é a época da soja e do milho. Lá, a regra de não indicar soja no inverno não vale.';
// No mesmo teste, a IA indicou aveia-preta e ervilhaca para junho em Cruz das Almas (BA)
const SEM_FRIO = [...NORDESTE, 'AC', 'AM', 'AP', 'PA', 'RO', 'RR'];
const REGRA_SEM_FRIO = '- No Norte e no Nordeste não faz frio que baste para as plantas de cobertura de inverno: não indique aveia, ervilhaca, nabo forrageiro, tremoço, centeio nem azevém. Indique as de clima quente, como crotalária, feijão-de-porco, guandu, mucuna e milheto, na época das chuvas.';
const REGRA_SEM_REGIAO = '- Sem a região no perfil, não indique plantas que só vão bem no frio (aveia, ervilhaca, nabo forrageiro, tremoço, azevém) como se servissem em todo lugar. Prefira as que servem na maior parte do país na época das chuvas, como crotalária, feijão-de-porco, guandu e milheto, e diga que a escolha depende da região.';

/** As linhas de clima do prompt que valem para o estado (ou a de quem não informou a região). */
export function regrasDoClima(estado?: string | null): string[] {
    const uf = String(estado ?? '').trim().toUpperCase();
    if (!uf) return [REGRA_SEM_REGIAO];
    return [
        COM_GEADA.includes(uf) && REGRA_DA_GEADA,
        COM_INVERNO_SECO.includes(uf) && REGRA_DO_INVERNO_SECO,
        NORDESTE.includes(uf) && REGRA_DO_NORDESTE,
        uf === 'MS' && REGRA_DO_MS,
        uf === 'RR' && REGRA_DE_RORAIMA,
        SEM_FRIO.includes(uf) && REGRA_SEM_FRIO,
    ].filter((r): r is string => Boolean(r));
}

/** Ex.: "primavera (novembro). Clima em PR: inverno frio, com geadas; verão quente e chuvoso (região Sul)." */
export function estacaoERegiao(estado?: string | null, data = new Date()): string {
    const mes = mesEmSaoPaulo(data);
    const estacao = `${ESTACAO_DO_MES[mes]} (${MESES[mes]})`;
    const uf = String(estado ?? '').trim().toUpperCase();
    const clima = CLIMA_DA_REGIAO.find(([ufs]) => ufs.includes(uf))?.[1];
    return clima ? `${estacao}. Clima em ${uf}: ${clima}.` : `${estacao}. Região não informada: a época certa de cada planta muda de uma região para outra.`;
}
