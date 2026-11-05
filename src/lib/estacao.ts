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

// Época das chuvas por mesorregião do IBGE (a do cultivo vem de src/lib/mesorregiao.ts). Com a
// regra do estado, a IA não sabia em que parte do Nordeste ficava Cruz das Almas (BA) e chamava
// junho e julho de "estação seca". Os meses saíram do ZARC de 04/11/2026: em quais meses a maioria
// dos municípios de cada mesorregião tem janela de risco 20% para o milho de 1ª safra e o
// feijão-caupi de sequeiro (no Semiárido, onde quase não há janela de 20%, as de até 40%).
// Um agrônomo deve validar os agrupamentos.
type Regime = { resumo: string; regra: string; invernoSeco?: boolean };
const REGIMES: Record<string, Regime> = {
    norteDoNordeste: {
        resumo: 'chove de dezembro a maio, mais ou menos, e o segundo semestre é seco',
        regra: 'chove de dezembro a maio, mais ou menos, e o segundo semestre é seco. Sem irrigação, planta-se de dezembro a abril, conforme o lugar (o milho mais cedo; o feijão-caupi até abril ou maio)',
    },
    cerrado: {
        resumo: 'Cerrado: chove de novembro a março ou abril, e o inverno é seco',
        regra: 'é Cerrado: chove de novembro a março ou abril, e o inverno é seco. Sem irrigação, a soja e o milho vão de novembro a janeiro',
        invernoSeco: true,
    },
    semiaridoDoNorte: {
        resumo: 'Semiárido: chuvas curtas e irregulares, mais ou menos de janeiro a abril',
        regra: 'é Semiárido: as chuvas são curtas e irregulares, mais ou menos de janeiro a abril. Sem irrigação, poucas lavouras têm época segura (o milho quase nunca; o feijão-caupi, em fevereiro e março): prefira as que aguentam seca, como feijão-caupi, sorgo e milheto',
    },
    leste: {
        resumo: 'chove mais no outono e no inverno; a primavera e o verão são mais secos',
        regra: 'chove mais no outono e no inverno, que são a época de plantar sem irrigação (o milho de março a junho; o feijão-caupi de abril a julho). A primavera e o verão são mais secos. Não chame o outono e o inverno de época seca',
    },
    agresteESertaoDoLeste: {
        resumo: 'chove menos que no litoral e de forma irregular, também no outono e no inverno',
        regra: 'chove menos que no litoral e de forma irregular, também no outono e no inverno. Sem irrigação, o plantio vai de abril a julho: o feijão-caupi é o mais seguro, e o milho tem época segura em menos lugares. Não chame o outono e o inverno de época seca',
    },
    sulBaiano: {
        resumo: 'chove em boa parte do ano, mais de fevereiro a julho',
        regra: 'chove em boa parte do ano, mais de fevereiro a julho. Sem irrigação, o milho vai de fevereiro a junho, e o feijão-caupi, em maio e junho',
    },
    veraoIrregular: {
        resumo: 'chuvas curtas e irregulares no verão, de novembro a fevereiro, mais ou menos, e inverno seco',
        regra: 'as chuvas são curtas e irregulares, no verão (de novembro a fevereiro, mais ou menos), e o inverno é seco. Sem irrigação, poucas lavouras têm época segura: prefira as que aguentam seca, como feijão-caupi, sorgo e milheto',
        invernoSeco: true,
    },
    semiaridoMisto: {
        resumo: 'Semiárido: chuvas curtas e irregulares, que vêm no verão numa parte da região e no outono em outra',
        regra: 'é Semiárido: as chuvas são curtas e irregulares, e a época muda de um município para outro, do verão ao outono (de dezembro a maio). Sem irrigação, poucas lavouras têm época segura: prefira as que aguentam seca, como feijão-caupi, sorgo e milheto',
    },
    sulDeMS: {
        resumo: 'a soja e o milho de verão vão de setembro a dezembro; no outono há milho safrinha, aveia e trigo; o inverno tem geada',
        regra: 'a soja e o milho de verão vão de setembro a dezembro, e no outono se planta milho safrinha, aveia e trigo. O inverno tem geada',
    },
    norteDeMS: {
        resumo: 'Cerrado e Pantanal: chove de outubro a março, e o inverno é seco',
        regra: 'é Cerrado e Pantanal: chove de outubro a março, e o inverno é seco. Sem irrigação, a soja e o milho de verão vão de outubro a dezembro',
        invernoSeco: true,
    },
};
// Geocódigo da mesorregião (IBGE) → regime. Os nomes estão em src/lib/dados/mesorregioes.json.
const REGIME_DA_MESORREGIAO: Record<number, string> = {
    // MA: Norte, Oeste, Centro e Leste Maranhense; PI: Norte e Centro-Norte Piauiense;
    // CE: Noroeste, Norte, Metropolitana de Fortaleza e Sul Cearense
    2101: 'norteDoNordeste', 2102: 'norteDoNordeste', 2103: 'norteDoNordeste', 2104: 'norteDoNordeste',
    2201: 'norteDoNordeste', 2202: 'norteDoNordeste', 2301: 'norteDoNordeste', 2302: 'norteDoNordeste',
    2303: 'norteDoNordeste', 2307: 'norteDoNordeste',
    // Sul Maranhense, Sudoeste Piauiense, Extremo Oeste Baiano
    2105: 'cerrado', 2203: 'cerrado', 2901: 'cerrado',
    // Sudeste Piauiense; Sertões Cearenses, Jaguaribe, Centro-Sul Cearense; Oeste e Central
    // Potiguar; Sertão Paraibano, Borborema; Sertão e São Francisco Pernambucano
    2204: 'semiaridoDoNorte', 2304: 'semiaridoDoNorte', 2305: 'semiaridoDoNorte', 2306: 'semiaridoDoNorte',
    2401: 'semiaridoDoNorte', 2402: 'semiaridoDoNorte', 2501: 'semiaridoDoNorte', 2502: 'semiaridoDoNorte',
    2601: 'semiaridoDoNorte', 2602: 'semiaridoDoNorte',
    // Leste Potiguar, Mata Paraibana, Mata Pernambucana, Metropolitana de Recife, Leste Alagoano,
    // Leste Sergipano, Metropolitana de Salvador
    2404: 'leste', 2504: 'leste', 2604: 'leste', 2605: 'leste', 2703: 'leste', 2803: 'leste', 2905: 'leste',
    // Agreste Potiguar, Paraibano, Pernambucano, Alagoano e Sergipano; Sertão Alagoano e
    // Sergipano (no ZARC, seguem o leste: feijão-caupi de abril a julho); Nordeste Baiano
    2403: 'agresteESertaoDoLeste', 2503: 'agresteESertaoDoLeste', 2603: 'agresteESertaoDoLeste',
    2702: 'agresteESertaoDoLeste', 2802: 'agresteESertaoDoLeste', 2701: 'agresteESertaoDoLeste',
    2801: 'agresteESertaoDoLeste', 2904: 'agresteESertaoDoLeste',
    2907: 'sulBaiano',
    // Vale São-Franciscano da Bahia, Centro Sul Baiano; em MG, Norte de Minas, Jequitinhonha,
    // Vale do Mucuri e Vale do Rio Doce (no ZARC, quase sem janela de 20% para o milho)
    2902: 'veraoIrregular', 2906: 'veraoIrregular', 3102: 'veraoIrregular', 3103: 'veraoIrregular',
    3104: 'veraoIrregular', 3108: 'veraoIrregular',
    2903: 'semiaridoMisto', // Centro Norte Baiano
    // MS: Sudoeste; Pantanais, Centro Norte e Leste
    5004: 'sulDeMS', 5001: 'norteDeMS', 5002: 'norteDeMS', 5003: 'norteDeMS',
};
// Em MG, o norte e o nordeste do estado são quentes: a regra da geada não vale lá
const SEM_GEADA_NA_MESORREGIAO = [3102, 3103, 3104, 3108];

/** Onde fica o cultivo: a mesorregião do IBGE (src/lib/mesorregiao.ts). */
export type Mesorregiao = { mesorregiao: number; nomeDaMesorregiao: string } | null | undefined;

const regimeDe = (uf: string, local: Mesorregiao) => {
    const chave = local ? REGIME_DA_MESORREGIAO[local.mesorregiao] : undefined;
    // A tabela só tem mesorregiões do Nordeste, de MG e de MS; confere o estado por segurança
    return chave && ([...NORDESTE, 'MG', 'MS'].includes(uf)) ? REGIMES[chave] : null;
};

/** As linhas de clima do prompt que valem para o estado e a mesorregião (ou a de quem não informou a região). */
export function regrasDoClima(estado?: string | null, local?: Mesorregiao): string[] {
    const uf = String(estado ?? '').trim().toUpperCase();
    if (!uf) return [REGRA_SEM_REGIAO];
    const regime = regimeDe(uf, local);
    const semGeada = local && SEM_GEADA_NA_MESORREGIAO.includes(local.mesorregiao);
    return [
        COM_GEADA.includes(uf) && !semGeada && REGRA_DA_GEADA,
        (COM_INVERNO_SECO.includes(uf) || regime?.invernoSeco) && REGRA_DO_INVERNO_SECO,
        // Sem a mesorregião (perfil sem município reconhecido), fica a regra geral do estado
        NORDESTE.includes(uf) && !regime && REGRA_DO_NORDESTE,
        uf === 'MS' && !regime && REGRA_DO_MS,
        regime && local && `- Na mesorregião ${local.nomeDaMesorregiao} (${uf}), onde fica o cultivo, ${regime.regra}. Para dizer quando plantar, siga as janelas do ZARC do município quando houver: um mês dentro da janela de risco 20% tem chuva para plantar.`,
        uf === 'RR' && REGRA_DE_RORAIMA,
        SEM_FRIO.includes(uf) && REGRA_SEM_FRIO,
    ].filter((r): r is string => Boolean(r));
}

/** Ex.: "primavera (novembro). Clima em PR: inverno frio, com geadas; verão quente e chuvoso (região Sul)." */
export function estacaoERegiao(estado?: string | null, data = new Date(), local?: Mesorregiao): string {
    const mes = mesEmSaoPaulo(data);
    const estacao = `${ESTACAO_DO_MES[mes]} (${MESES[mes]})`;
    const uf = String(estado ?? '').trim().toUpperCase();
    const regime = regimeDe(uf, local);
    // Com o regime da mesorregião, a descrição geral do estado sai: no Nordeste, "no litoral,
    // mais no outono e no inverno; no Semiárido..." deixava a IA escolher a parte errada.
    if (regime && local) return `${estacao}. Clima em ${uf}, na mesorregião ${local.nomeDaMesorregiao}: ${regime.resumo}.`;
    const clima = CLIMA_DA_REGIAO.find(([ufs]) => ufs.includes(uf))?.[1];
    if (!clima) return `${estacao}. Região não informada: a época certa de cada planta muda de uma região para outra.`;
    return `${estacao}. Clima em ${uf}${local ? `, na mesorregião ${local.nomeDaMesorregiao}` : ''}: ${clima}.`;
}
