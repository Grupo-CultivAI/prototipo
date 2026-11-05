/**
 * Erros agronômicos conhecidos nas respostas do chat. O prompt já ensina época, região e nomes
 * das plantas, mas o modelo às vezes erra assim mesmo. No teste com personas de 02/11/2026 ele
 * indicou milheto e crotalária para o inverno do sul do Paraná (morrem com a geada), soja no
 * inverno, "feijão-de-porco (crotalária)", milheto como leguminosa e "mandioca semeada"; em
 * 03/11, plantio no inverno seco de Minas Gerais, sem irrigação, e aveia semeada em outubro.
 * Como em src/lib/agrotoxicos.ts, a checagem não depende do modelo: achado um erro, a rota pede
 * que ele reescreva a resposta. Sem imports, para os testes em node (tests/) a usarem direto.
 */

// Inverno com geada (o mesmo grupo de src/lib/estacao.ts)
const ESTADOS_DO_SUL = ['PR', 'SC', 'RS'];

// A IA escreve com espaços e hífens Unicode: o espaço fino inseparável (U+202F) entre número e
// palavra e o hífen inseparável (U+2011) em "aveia‑preta". Em 03/11/2026, metade das respostas
// tinha um deles, e as expressões abaixo, escritas com espaço e hífen comuns, não as reconheciam.
// Antes de conferir, todo espaço (menos a quebra de linha) vira espaço comum, e todo hífen, "-".
const sem = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\S\n]/g, ' ').replace(/[\u2010-\u2015\u2212]/g, '-').toLowerCase();

const DE_VERAO = /\b(milheto|crotalarias?|mucuna|feijao[- ]de[- ]porco|guandu|sorgo)\b/g;
const NOME: Record<string, string> = { milheto: 'milheto', crotalaria: 'crotalária', mucuna: 'mucuna', 'feijao de porco': 'feijão-de-porco', guandu: 'guandu', sorgo: 'sorgo' };
// Parágrafo que fala da planta no verão, ou que avisa que ela não serve para o inverno
const VERAO_OU_AVISO = /\bverao\b|primavera|geada|\bfrio\b|nao (aguenta|tolera|resiste)|evite|morre/;
const NAO_LEGUMINOSAS = 'milheto|sorgo|aveia|centeio|braquiarias?|nabo forrageiro|trigo';

// Inverno seco do Cerrado: sem irrigação, não dá para plantar de maio a setembro. Em 03/11/2026, para
// Patos de Minas (MG), a IA indicou aveia-preta e ervilhaca em maio-junho; o ZARC só tem janela
// da aveia lá em março, no fim das chuvas.
const ESTADOS_DO_CERRADO = ['MG', 'GO', 'DF', 'MT', 'TO'];
const DE_INVERNO = /\b(aveia|ervilhaca|nabo forrageiro|tremoco|centeio|azevem)\b/;
const MESES_SECOS = /\binverno\b|\b(maio|junho|julho|agosto)\b/;
const PLANTAR = /\b(plante|plantar|plantio|semeie|semear|semeadura|semeado|semeada)\b/;
const PLANTAR_NO_INVERNO = /\b(plante|plantar|plantio|semeie|semear|semeadura|semeado|semeada)\b[^.]{0,40}\b(no|de) inverno\b/;

// Mesorregiões de inverno seco fora desses estados (as com invernoSeco em src/lib/estacao.ts):
// Sul Maranhense, Sudoeste Piauiense, Extremo Oeste Baiano, Vale São-Franciscano da Bahia,
// Centro Sul Baiano e o norte de MS (Pantanais, Centro Norte e Leste)
const MESORREGIOES_DE_INVERNO_SECO = [2105, 2203, 2901, 2902, 2906, 5001, 5002, 5003];

type Contexto = { pergunta: string; estado?: string | null; irrigacao?: string | null; mesorregiao?: number | null };

function plantioNoInvernoSeco(resposta: string, { estado, irrigacao, mesorregiao }: Contexto): string | null {
    const invernoSeco = ESTADOS_DO_CERRADO.includes(String(estado ?? '').trim().toUpperCase()) || MESORREGIOES_DE_INVERNO_SECO.includes(Number(mesorregiao));
    if (!invernoSeco) return null;
    if (irrigacao && irrigacao !== 'Não irrigo') return null;
    // "sem irrigação, plante ... (final de maio)" não é ressalva: em 04/11/2026 a IA mandou plantar
    // milheto e sorgo em Patos de Minas assim, "logo após o fim das chuvas de outono (final de maio)".
    // "Não é indicado plantar feijão em maio" (Juazeiro, BA, 04/11/2026) também é ressalva
    const ressalva = /(?<!sem )\birriga|\bmarco\b|\babril\b|nao (plant|seme)|nao (e|esta) (a )?(indicad|recomendad|aconselhav|epoca|hora|bom)|evite/;
    const blocos = sem(resposta).split(/\n\s*\n/);
    // Bloco = item da lista com as linhas de baixo (a época fica no título, a planta embaixo)
    const deInverno = blocos.some((bloco) => DE_INVERNO.test(bloco) && MESES_SECOS.test(bloco) && !ressalva.test(bloco));
    // Qualquer plantio nos meses secos: na mesma resposta de 03/11/2026, depois de corrigida a
    // aveia, vieram "feijão de inverno" em maio-junho e crotalária em julho-agosto.
    // O verbo, não o substantivo: "as plantas de cobertura protegem o solo de maio a agosto" está certo.
    const nosMesesSecos = blocos.flatMap((b) => b.split(/[.!?;\n]+/)).some((frase) =>
        (PLANTAR.test(frase) && /\b(maio|junho|julho|agosto)\b/.test(frase) || PLANTAR_NO_INVERNO.test(frase))
        && !ressalva.test(frase));
    return deInverno || nosMesesSecos ? 'Na região da propriedade, o inverno é seco: sem irrigação, não dá para plantar de maio a setembro, nem feijão nem plantas de cobertura. Não indique plantio nesses meses. Indique o plantio na época das chuvas (outubro a março) e a cobertura no fim das chuvas (março e abril), ou diga que só dá com irrigação.' : null;
}

function deVeraoNoInvernoDoSul(resposta: string, { pergunta, estado }: Contexto): string | null {
    if (!ESTADOS_DO_SUL.includes(String(estado ?? '').trim().toUpperCase()) || !/\binverno\b/.test(sem(pergunta))) return null;
    const plantas = new Set<string>();
    for (const paragrafo of sem(resposta).split(/\n+/)) {
        if (VERAO_OU_AVISO.test(paragrafo)) continue;
        for (const m of paragrafo.matchAll(DE_VERAO)) plantas.add(NOME[m[1].replace(/s$/, '').replace(/-/g, ' ')]);
    }
    if (!plantas.size) return null;
    const nomes = [...plantas];
    const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0];
    const verao = nomes.length > 1 ? 'são plantas de verão e morrem com a geada: não as indique' : 'é planta de verão e morre com a geada: não a indique';
    return `A pergunta é sobre o inverno e a propriedade fica no Sul, onde o inverno tem geada. ${lista[0].toUpperCase()}${lista.slice(1)} ${verao} para o inverno. Para o inverno, indique plantas de inverno, como aveia-preta, nabo forrageiro, ervilhaca ou centeio. Se citar as de verão, diga que são para o verão.`;
}

function sojaNoInverno(resposta: string, { estado }: Contexto): string | null {
    // Em Roraima, ao norte da linha do equador, a soja é semeada de abril a junho, com as chuvas
    if (String(estado ?? '').trim().toUpperCase() === 'RR') return null;
    const n = sem(resposta);
    const achou = [...n.matchAll(/\bsoja\s*(?:\(\s*|de\s+|no\s+|em\s+)inverno\b|\binverno\s*[:–—-]\s*soja\b/g)]
        // "depois da soja no inverno" fala da cultura anterior; "não plante soja no inverno", do vazio sanitário
        .some((m) => !/\b(depois|apos|colh\w*|nao|evite|nunca|proib\w*)\b[^.\n]{0,15}$/.test(n.slice(Math.max(0, m.index - 25), m.index))
            && !/vazio sanitario/.test(n.slice(Math.max(0, m.index - 150), m.index + 150)));
    return achou ? 'A soja é lavoura de verão. Não a indique para o inverno: na maioria dos estados há o vazio sanitário, meses sem soja no campo, exigidos por lei contra a ferrugem asiática.' : null;
}

function nomesTrocados(resposta: string): string | null {
    const n = sem(resposta);
    return /feijao[- ]de[- ]porco\s*\(\s*crotalaria|crotalarias?\s*\(\s*feijao[- ]de[- ]porco/.test(n)
        ? 'Feijão-de-porco e crotalária são plantas diferentes: não use um nome como sinônimo do outro.'
        : null;
}

function leguminosaErrada(resposta: string): string | null {
    const n = sem(resposta);
    const erros: string[] = [];
    // "crotalária, mucuna ou milheto; essas leguminosas", "milheto (leguminosa)", "milheto é uma
    // leguminosa" e, desde 03/11/2026, "uma leguminosa de inverno (como aveia-preta ou ervilhaca)":
    // a primeira planta depois de "como" é a que foi chamada de leguminosa.
    if (new RegExp(`\\b(${NAO_LEGUMINOSAS})\\b[^.\\n]{0,60}\\b(essas|estas|ambas|todas) (as )?leguminosas\\b|\\b(${NAO_LEGUMINOSAS})\\s*(\\(\\s*|e uma\\s+)leguminosa|\\bleguminosas?\\b[^.\\n,;]{0,25}\\b(como|tipo)\\s+(o |a |os |as )?(${NAO_LEGUMINOSAS})\\b`).test(n)) {
        erros.push('Milheto, sorgo, aveia, centeio, trigo, braquiária e nabo forrageiro não são leguminosas: não chame essas plantas de leguminosas nem diga que elas fixam nitrogênio do ar.');
    }
    // "culturas que não sejam leguminosas (milho, soja)"
    if (/\bnao (sejam|sao|e|forem) leguminosas?\b[^.\n]{0,40}\bsoja\b|\bsoja\b[^.\n]{0,20}\bnao (e|sao) (uma )?leguminosas?\b/.test(n)) {
        erros.push('A soja é leguminosa, como o feijão. Para quebrar o ciclo de doenças do feijão, indique plantas que não são leguminosas, como milho, sorgo ou milheto.');
    }
    return erros.length ? erros.join(' ') : null;
}

function mandiocaSemeada(resposta: string): string | null {
    const n = sem(resposta);
    return /\bmandioca\b[^.,;\n]{0,40}\b(pode ser|e|deve ser|sao|sera) semead|\bsementes? de mandioca\b|\bsem(eie|ear) (a )?mandioca\b/.test(n)
        ? 'Mandioca não é semeada: é plantada com pedaços do caule (manivas).'
        : null;
}

// Planta de clima quente apresentada como planta de frio. Em 04/11/2026, para Cruz das Almas (BA):
// "Feijão caupi – planta de inverno, tolera clima mais frio". No Nordeste, "inverno" também é o nome
// da época das chuvas ("o caupi é cultura de inverno" está certo lá): só "tolera frio" conta.
const NORDESTE = ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'];
const DE_CLIMA_QUENTE = /\b(feijao[- ]caupi|caupi|milheto|crotalarias?|mucuna|feijao[- ]de[- ]porco|guandu|sorgo)\b/g;
const NOME_QUENTE: Record<string, string> = { ...NOME, 'feijao caupi': 'feijão-caupi', caupi: 'feijão-caupi' };
const TOLERA_FRIO = /\b(toler|aguent|resist|suport)\w*\s+(bem\s+)?(ao?\s+)?(clima\s+)?(mais\s+)?(frio|geada)\b/;
const DE_INVERNO_NA_FRASE = /\b(planta|cultura|cobertura|leguminosa|opcao) de inverno\b/;
// Entre a planta e a afirmação: negação, ou outra planta de quem a frase passa a falar
const OUTRO_ASSUNTO = new RegExp(`\\b(nao|nem|mas|porem)\\b|${DE_INVERNO.source}|${DE_CLIMA_QUENTE.source}`);

function quenteComoDeFrio(resposta: string, { estado }: Contexto): string | null {
    const n = sem(resposta);
    const doNordeste = NORDESTE.includes(String(estado ?? '').trim().toUpperCase());
    const plantas = new Set<string>();
    for (const m of n.matchAll(DE_CLIMA_QUENTE)) {
        const frase = n.slice(m.index + m[0].length).split(/[.;!?\n]/)[0].slice(0, 80);
        const frio = [TOLERA_FRIO, ...(doNordeste ? [] : [DE_INVERNO_NA_FRASE])].map((r) => frase.match(r)).find(Boolean);
        if (!frio || OUTRO_ASSUNTO.test(frase.slice(0, frio.index))) continue;
        plantas.add(NOME_QUENTE[m[1].replace(/s$/, '').replace(/-/g, ' ')]);
    }
    if (!plantas.size) return null;
    const nomes = [...plantas];
    const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0];
    return `${lista[0].toUpperCase()}${lista.slice(1)} ${nomes.length > 1 ? 'são plantas' : 'é planta'} de clima quente: não aguenta${nomes.length > 1 ? 'm' : ''} frio nem geada. Não diga que tolera${nomes.length > 1 ? 'm' : ''} frio${doNordeste ? '' : ' nem chame de planta de inverno'}.`;
}

// Planta de inverno semeada na primavera ou no verão. Em 03/11/2026 o plano do Rafael (ES) mandou
// semear aveia, ervilhaca ou tremoço "em outubro-novembro"; em todo o país elas vão no fim do
// verão ou no outono (de fevereiro a junho, conforme a região). Vale qualquer estado.
const MESES_QUENTES = /\b(setembro|outubro|novembro|dezembro|janeiro)\b/;
// Manejo da planta já crescida ("role a aveia em setembro") não é semeadura
const MANEJO = /\b(colh\w*|ro[cç]\w*|cort\w*|dessec\w*|rol\w*|manej\w*|incorpor\w*)\b/;
const OUTRA_CULTURA = /\b(milho|soja|feijao|milheto|crotalari\w*|sorgo|mandioca|arroz|algodao|mucuna|guandu|feijao[- ]de[- ]porco|amendoim|girassol)\b/;

// A planta semeada é a primeira citada depois do verbo ("semeie a aveia em outubro, depois do
// milho"); sem planta depois dele, a última antes ("aveia-preta: semeie em outubro"); sem
// nenhuma na frase ("semeie em outubro-novembro"), a das duas linhas de cima.
const PLANTA = new RegExp(`${DE_INVERNO.source}|${OUTRA_CULTURA.source}`, 'g');
const deInvernoOuNao = (trecho: string, ultima = false) => {
    const achadas = [...trecho.matchAll(PLANTA)].map((m) => DE_INVERNO.test(m[0]));
    return achadas.length ? (ultima ? achadas.at(-1) : achadas[0]) : null;
};

function invernoNaPrimavera(resposta: string): string | null {
    const achou = sem(resposta).split(/\n\s*\n/).some((bloco) => {
        const linhas = bloco.split('\n');
        return linhas.some((linha, i) => linha.split(/[.;!?]+/).some((frase) => {
            const verbo = frase.match(PLANTAR);
            if (!verbo || !MESES_QUENTES.test(frase) || MANEJO.test(frase)) return false;
            const depois = deInvernoOuNao(frase.slice(verbo.index! + verbo[0].length));
            if (depois !== null) return depois;
            const antes = deInvernoOuNao(frase.slice(0, verbo.index), true);
            if (antes !== null) return antes;
            return linhas.slice(Math.max(0, i - 2), i).some((l) => DE_INVERNO.test(l));
        }));
    });
    return achou ? 'Aveia, ervilhaca, nabo forrageiro, tremoço, centeio e azevém são plantas de inverno: são semeadas de fevereiro a junho, conforme a região (no Cerrado, logo depois da colheita da soja), não na primavera nem no verão. Corrija a época de semeadura.' : null;
}

/** Instrução de revisão quando a resposta tem um erro agronômico conhecido, ou null. */
export function problemaAgronomico(resposta: string, contexto: Contexto): string | null {
    const erros = [
        deVeraoNoInvernoDoSul(resposta, contexto),
        plantioNoInvernoSeco(resposta, contexto),
        invernoNaPrimavera(resposta),
        sojaNoInverno(resposta, contexto),
        nomesTrocados(resposta),
        leguminosaErrada(resposta),
        mandiocaSemeada(resposta),
        quenteComoDeFrio(resposta, contexto),
    ].filter(Boolean);
    return erros.length ? `A resposta tem erros agronômicos: ${erros.join(' ')} Reescreva a resposta completa, sem esses erros.` : null;
}

export const AVISO_AGRONOMICO = '> ⚠️ Parte desta resposta pode não servir para a época ou a região da sua propriedade. Confirme com a assistência técnica local, como a Emater, antes de plantar.';
