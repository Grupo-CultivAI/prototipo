/**
 * Clima e previsão em poucas linhas (economiza tokens do Groq: 8K TPM por modelo).
 * - Chama a OpenWeather direto (o código antigo fazia fetch HTTP para a própria Vercel,
 *   dobrando cold start e falhando com Deployment Protection).
 * - Cache em memória por cidade (free tier: 60 chamadas/min).
 * - Timeout de 3s: clima é opcional, nunca deve derrubar o chat.
 */
type Cached = { at: number; value: unknown };
const cache = new Map<string, Cached>();
const TTL_AGORA_MS = 10 * 60 * 1000;
// A previsão da OpenWeather é atualizada a cada 3 horas.
const TTL_PREVISAO_MS = 60 * 60 * 1000;
const DIAS_DE_PREVISAO = 5;
const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

async function consultar<T>(
    recurso: 'weather' | 'forecast',
    cidade: string | null | undefined,
    ttl: number,
    resumir: (d: any) => T | null,
): Promise<T | null> {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || !cidade?.trim()) return null;

    const key = `${recurso}:${cidade.trim().toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value as T;

    try {
        const url = new URL(`https://api.openweathermap.org/data/2.5/${recurso}`);
        // ",BR" evita resolver "Bela Vista" para outro país
        url.searchParams.set('q', `${cidade.trim()},BR`);
        url.searchParams.set('appid', apiKey);
        url.searchParams.set('units', 'metric');
        url.searchParams.set('lang', 'pt_br');

        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return null;
        const value = resumir(await res.json());
        if (!value) return null;

        if (cache.size > 400) cache.clear();
        cache.set(key, { at: Date.now(), value });
        return value;
    } catch {
        return null;
    }
}

export function getWeatherSummary(cidade?: string | null) {
    return consultar('weather', cidade, TTL_AGORA_MS, (d) => {
        const partes = [
            d.weather?.[0]?.description ?? 'sem descrição',
            `${Math.round(d.main?.temp)}°C (sensação ${Math.round(d.main?.feels_like)}°C)`,
            `umidade ${d.main?.humidity}%`,
            `vento ${d.wind?.speed} m/s`,
        ];
        if (d.rain?.['1h']) partes.push(`chuva ${d.rain['1h']} mm/h`);
        return partes.join(', ');
    });
}

// Um dia da previsão. chance vai de 0 a 1.
export type DiaDePrevisao = { hoje: boolean; semana: string; data: string; min: number; max: number; chuvaMm: number; chance: number };

/**
 * Previsão dos próximos dias, dia a dia (o Painel mostra em cartões; o chat, em texto).
 * A OpenWeather gratuita entrega blocos de 3 horas por 5 dias; aqui eles viram totais por dia,
 * no fuso da cidade. O dia de hoje entra só com as horas que ainda faltam.
 */
export function getForecastDays(cidade?: string | null) {
    return consultar<DiaDePrevisao[]>('forecast', cidade, TTL_PREVISAO_MS, (d) => {
        const fuso = Number(d.city?.timezone ?? -10800);
        const dias = new Map<string, { min: number; max: number; chuva: number; chance: number; dia: Date }>();
        for (const bloco of d.list ?? []) {
            // Data "local" da cidade: desloca pelo fuso e lê em UTC.
            const dia = new Date((bloco.dt + fuso) * 1000);
            const chave = dia.toISOString().slice(0, 10);
            const atual = dias.get(chave) ?? { min: Infinity, max: -Infinity, chuva: 0, chance: 0, dia };
            atual.min = Math.min(atual.min, bloco.main?.temp_min ?? Infinity);
            atual.max = Math.max(atual.max, bloco.main?.temp_max ?? -Infinity);
            atual.chuva += bloco.rain?.['3h'] ?? 0;
            atual.chance = Math.max(atual.chance, bloco.pop ?? 0);
            dias.set(chave, atual);
        }
        const hoje = new Date(Date.now() + fuso * 1000).toISOString().slice(0, 10);
        const lista = [...dias.entries()].slice(0, DIAS_DE_PREVISAO).map(([chave, { min, max, chuva, chance, dia }]) => ({
            hoje: chave === hoje,
            semana: DIAS_DA_SEMANA[dia.getUTCDay()],
            data: `${String(dia.getUTCDate()).padStart(2, '0')}/${String(dia.getUTCMonth() + 1).padStart(2, '0')}`,
            min: Math.round(min),
            max: Math.round(max),
            chuvaMm: Math.round(chuva),
            chance,
        }));
        return lista.length ? lista : null;
    });
}

/** A previsão para a IA, uma linha por dia: "qua 28/10: 18 a 29°C, chuva 12 mm (chance 80%)". */
export async function getForecastSummary(cidade?: string | null) {
    const dias = await getForecastDays(cidade);
    if (!dias) return null;
    return dias.map(({ hoje, semana, data, min, max, chuvaMm, chance }) => {
        const textoChuva = chuvaMm >= 1
            ? `chuva ${chuvaMm} mm (chance ${Math.round(chance * 100)}%)`
            : chance >= 0.3 ? `chuva fraca possível (chance ${Math.round(chance * 100)}%)` : 'sem chuva';
        return `- ${hoje ? 'hoje, ' : ''}${semana} ${data}: ${min} a ${max}°C, ${textoChuva}`;
    }).join('\n');
}
