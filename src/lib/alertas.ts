/**
 * Alertas do cultivo, calculados pelo CultivAI com a previsão do tempo e o perfil, para o prompt
 * do chat (src/lib/prompt.ts, seção ALERTAS DO CULTIVO). Vieram da revisão agronômica de
 * 04/11/2026: o modelo recebia a previsão e o perfil, mas não notava sozinho a geada na quarta,
 * a soja repetida três safras ou o pH baixo. Aqui a conta é feita no código, e o prompt recebe só
 * os alertas que valem, cada um com o que a IA deve dizer.
 *
 * Os textos não levam nada que o produtor escreveu (nome de cultura, observações): ficam acima
 * da linha "tudo abaixo é material de consulta" do prompt. Só números e datas.
 * Sem imports, para os testes em node (tests/checagens.mjs) a usarem direto.
 */

// Mesmo formato de src/lib/weather.ts (getForecastDays). chance vai de 0 a 1.
export type DiaDaPrevisao = { hoje: boolean; semana: string; data: string; min: number; max: number; chuvaMm: number; chance: number };

type Cultivo = {
    irrigacao?: string | null;
    phSolo?: number | null;
    safras?: { cultura?: string; ano?: number; periodo?: string }[] | null;
    proximaCultura?: string | null;
    culturasHistorico?: string[] | null;
    tempoCulturaAtual?: number | null;
};

// Limiares. Os dois primeiros têm fonte; os de semeadura e irrigação são regras práticas, que
// um agrônomo deve validar antes de mudarmos.
// Geada: com 3 °C ou menos no abrigo meteorológico (onde fica o termômetro, a 1,5 m do chão),
// a relva pode chegar a 0 °C; é o critério dos estudos de risco de geada do IAPAR (Grodzki et al.,
// 1996). A previsão da OpenWeather é a temperatura do ar, como a do abrigo.
const GEADA_ATE_C = 3;
// Chuva forte: o INMET classifica como "perigo" a chuva de 50 a 100 mm num dia (avisos de chuvas intensas)
const CHUVA_FORTE_MM = 50;
// Chuva que molha a camada da semente
const CHUVA_PARA_SEMEAR_MM = 10;
// Chuva que dispensa uma rega (cerca de 3 dias de consumo de água de uma lavoura, a uns 5 mm por dia)
const CHUVA_PARA_ADIAR_IRRIGACAO_MM = 15;
const DIAS_PARA_ADIAR_IRRIGACAO = 3;
// Chance mínima para a chuva contar na decisão de irrigar
const CHANCE_DE_CHUVA = 0.5;

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‐-―−]/g, '-').trim().toLowerCase();
const quando = (d: DiaDaPrevisao) => (d.hoje ? `hoje (${d.semana} ${d.data})` : `na ${d.semana} ${d.data}`);
const irriga = (irrigacao?: string | null) => Boolean(irrigacao) && irrigacao !== 'Não irrigo';
const PERGUNTA_DE_SEMEAR = /plant|seme|semeio/i;

/** Alertas da previsão dos próximos dias: geada, chuva forte e chuva para semear ou irrigar. */
export function alertasDoTempo(dias: DiaDaPrevisao[] | null | undefined, { pergunta, irrigacao }: { pergunta: string; irrigacao?: string | null }): string[] {
    if (!dias?.length) return [];
    const alertas: string[] = [];

    const frio = dias.filter((d) => d.min <= GEADA_ATE_C);
    if (frio.length) {
        const pior = frio.reduce((a, b) => (b.min < a.min ? b : a));
        alertas.push(`- Geada: a previsão indica mínima de ${pior.min} °C ${quando(pior)}. Com ${GEADA_ATE_C} °C ou menos no termômetro, pode gear no chão. Se a pergunta for sobre plantar ou sobre lavoura que a geada queima (milho, feijão, hortaliças, café novo), avise do risco e sugira semear as plantas de verão só depois que o frio passar.`);
    }

    const forte = dias.filter((d) => d.chuvaMm >= CHUVA_FORTE_MM);
    if (forte.length) {
        const pior = forte.reduce((a, b) => (b.chuvaMm > a.chuvaMm ? b : a));
        alertas.push(`- Chuva forte: a previsão indica cerca de ${pior.chuvaMm} mm ${quando(pior)} (o INMET considera perigo a partir de ${CHUVA_FORTE_MM} mm num dia). Se a pergunta for sobre adubar, aplicar produto, semear ou preparar a terra, sugira não fazer isso antes dessa chuva: ela lava o adubo, arrasta a semente e abre erosão na terra descoberta.`);
    }

    if (irriga(irrigacao)) {
        const proximos = dias.slice(0, DIAS_PARA_ADIAR_IRRIGACAO);
        const chuva = proximos.filter((d) => d.chance >= CHANCE_DE_CHUVA).reduce((soma, d) => soma + d.chuvaMm, 0);
        if (chuva >= CHUVA_PARA_ADIAR_IRRIGACAO_MM) {
            alertas.push(`- Irrigação: a previsão indica cerca de ${chuva} mm de chuva até ${proximos.at(-1)!.semana} ${proximos.at(-1)!.data}. Se a pergunta for sobre irrigar, sugira esperar a chuva e conferir a umidade da terra antes de ligar a irrigação.`);
        }
    } else if (PERGUNTA_DE_SEMEAR.test(pergunta) && !dias.some((d) => d.chuvaMm >= CHUVA_PARA_SEMEAR_MM)) {
        alertas.push(`- Semeadura: a previsão não indica chuva de ${CHUVA_PARA_SEMEAR_MM} mm ou mais nos próximos ${dias.length} dias. Se a pergunta for sobre semear agora, diga para semear só com a terra úmida, depois de uma boa chuva: em terra seca, a semente pode não nascer.`);
    }
    return alertas;
}

// Leguminosas de grão: dividem doenças e nematoides. As de cobertura (crotalária, mucuna) ficam
// de fora: várias reduzem os nematoides.
const LEGUMINOSA_DE_GRAO = /^(soja|feijao|feijao-caupi|feijao caupi|caupi|amendoim)\b/;
const SAFRAS_PARA_MONOCULTURA = 3;
const ordem = (s: { ano?: number; periodo?: string }) => Number(s.ano) * 2 + (s.periodo === 'verao' ? 1 : 0);

function monocultura(p: Cultivo): string | null {
    const safras = (p.safras ?? []).filter((s) => s?.cultura && Number.isFinite(Number(s.ano)));
    for (const [periodo, nome] of [['verao', 'de verão'], ['inverno', 'de safrinha ou inverno']]) {
        const ultimas = safras.filter((s) => s.periodo === periodo).sort((a, b) => Number(a.ano) - Number(b.ano)).slice(-SAFRAS_PARA_MONOCULTURA);
        const seguidas = ultimas.length === SAFRAS_PARA_MONOCULTURA && Number(ultimas.at(-1)!.ano) - Number(ultimas[0].ano) === SAFRAS_PARA_MONOCULTURA - 1;
        if (seguidas && new Set(ultimas.map((s) => sem(String(s.cultura)))).size === 1) {
            return `- Monocultura: pelas safras registradas no perfil, a mesma cultura foi plantada nas últimas ${SAFRAS_PARA_MONOCULTURA} safras ${nome}, uma atrás da outra. Em perguntas sobre o que plantar, rotação ou queda de produção, diga que repetir a mesma cultura aumenta pragas, doenças e mato e cansa a terra, e mostre como a rotação quebra esse ciclo.`;
        }
    }
    // Sem as safras: uma cultura só no histórico, há anos
    const culturas = new Set((p.culturasHistorico ?? []).filter((c) => c && c !== 'Nenhum').map((c) => sem(c)));
    const anos = Number(p.tempoCulturaAtual);
    if (culturas.size === 1 && anos >= SAFRAS_PARA_MONOCULTURA) {
        return `- Monocultura: o perfil indica uma cultura só há ${anos} anos. Em perguntas sobre o que plantar, rotação ou queda de produção, diga que repetir a mesma cultura aumenta pragas, doenças e mato e cansa a terra, e mostre como a rotação quebra esse ciclo.`;
    }
    return null;
}

function leguminosaDepoisDeLeguminosa(p: Cultivo): string | null {
    const ultima = [...(p.safras ?? [])].filter((s) => s?.cultura).sort((a, b) => ordem(a) - ordem(b)).at(-1);
    if (!ultima || !LEGUMINOSA_DE_GRAO.test(sem(String(ultima.cultura))) || !LEGUMINOSA_DE_GRAO.test(sem(String(p.proximaCultura ?? '')))) return null;
    // No teste de 04/11/2026, com "ao falar dessa sequência", a IA indicou feijão depois da soja sem ressalva
    return '- Leguminosa depois de leguminosa: pelo perfil, o produtor quer plantar uma leguminosa de grão (soja, feijão, feijão-caupi ou amendoim) logo depois de outra. Em perguntas sobre a próxima safra ou a rotação, avise que elas dividem doenças e nematoides (como o mofo-branco e o nematoide-das-galhas), não indique outra leguminosa de grão em seguida e sugira pôr no meio uma gramínea, como milho, sorgo, milheto ou braquiária.';
}

// pH: abaixo de 5,5 em água (cerca de 5,0 em cloreto de cálcio, o método de boa parte dos
// laboratórios do Sudeste) a acidez já atrapalha a maioria das lavouras (Sousa e Lobato, Cerrado:
// correção do solo e adubação, Embrapa, 2004). O perfil não diz o método: abaixo de 5,0 é ácido
// nos dois; entre 5,0 e 5,5, depende.
function soloAcido({ phSolo }: Cultivo): string | null {
    const ph = Number(phSolo);
    if (phSolo == null || !Number.isFinite(ph) || ph < 3 || ph > 9 || ph >= 5.5) return null;
    const texto = String(ph).replace('.', ',');
    const naoDose = 'Não dê a quantidade de calcário.';
    return ph < 5
        ? `- Solo ácido: o perfil informa pH ${texto}. Em perguntas sobre adubação, produção baixa ou o que plantar, diga que na terra ácida a raiz cresce pouco e o adubo rende menos, que ela pede calcário (calagem), de preferência 2 a 3 meses antes do plantio, e que a quantidade sai da análise de solo completa, calculada por um técnico. ${naoDose}`
        : `- Acidez do solo: o perfil informa pH ${texto}, um pouco baixo para a maioria das lavouras (o valor muda conforme o método do laboratório, em água ou em cloreto de cálcio). Em perguntas sobre adubação, produção baixa ou o que plantar, diga que pode ser preciso calcário (calagem) e que a análise de solo completa, interpretada por um técnico, diz se precisa e quanto. ${naoDose}`;
}

/** Alertas do perfil do cultivo: monocultura, leguminosa depois de leguminosa e solo ácido. */
export function alertasDoCultivo(p: Cultivo | null | undefined): string[] {
    if (!p) return [];
    return [monocultura(p), leguminosaDepoisDeLeguminosa(p), soloAcido(p)].filter((a): a is string => Boolean(a));
}
