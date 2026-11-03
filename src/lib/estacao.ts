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
const COM_INVERNO_SECO = ['MG', 'MS', 'GO', 'DF', 'MT', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'];
const REGRA_DA_GEADA = '- No Sul e nas partes altas do Sudeste, o inverno tem geada: para o inverno, indique só plantas de inverno.';
const REGRA_DO_INVERNO_SECO = '- Onde o inverno é seco (Cerrado, que cobre boa parte de MG, GO, MT, MS, TO e DF, e boa parte do Nordeste), sem irrigação quase nada cresce de maio a setembro: não indique plantio nesses meses, nem de plantas de inverno. Lá a cobertura (milheto, sorgo, braquiária, crotalária) é semeada no fim das chuvas, logo depois da colheita.';
const REGRA_SEM_REGIAO = '- Sem a região no perfil, não indique plantas que só vão bem no frio (aveia, ervilhaca, nabo forrageiro, tremoço, azevém) como se servissem em todo lugar. Prefira as que servem na maior parte do país na época das chuvas, como crotalária, feijão-de-porco, guandu e milheto, e diga que a escolha depende da região.';

/** As linhas de clima do prompt que valem para o estado (ou a de quem não informou a região). */
export function regrasDoClima(estado?: string | null): string[] {
    const uf = String(estado ?? '').trim().toUpperCase();
    if (!uf) return [REGRA_SEM_REGIAO];
    return [COM_GEADA.includes(uf) && REGRA_DA_GEADA, COM_INVERNO_SECO.includes(uf) && REGRA_DO_INVERNO_SECO].filter((r): r is string => Boolean(r));
}

/** Ex.: "primavera (novembro). Clima em PR: inverno frio, com geadas; verão quente e chuvoso (região Sul)." */
export function estacaoERegiao(estado?: string | null, data = new Date()): string {
    const mes = mesEmSaoPaulo(data);
    const estacao = `${ESTACAO_DO_MES[mes]} (${MESES[mes]})`;
    const uf = String(estado ?? '').trim().toUpperCase();
    const clima = CLIMA_DA_REGIAO.find(([ufs]) => ufs.includes(uf))?.[1];
    return clima ? `${estacao}. Clima em ${uf}: ${clima}.` : `${estacao}. Região não informada: a época certa de cada planta muda de uma região para outra.`;
}
