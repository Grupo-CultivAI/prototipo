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

// O lugar da consulta: o ponto marcado no mapa (Meus Cultivos), se houver; senão, a cidade.
// Em município grande, o centro da cidade pode ter outro tempo.
export type Ponto = { lat?: number | null; lng?: number | null } | null | undefined;
const temPonto = (p: Ponto): p is { lat: number; lng: number } => typeof p?.lat === 'number' && typeof p?.lng === 'number';

async function consultar<T>(
    recurso: 'weather' | 'forecast',
    cidade: string | null | undefined,
    ponto: Ponto,
    ttl: number,
    resumir: (d: any) => T | null,
): Promise<T | null> {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || (!cidade?.trim() && !temPonto(ponto))) return null;

    // Pontos a ~1 km um do outro dividem o cache
    const key = temPonto(ponto) ? `${recurso}:${ponto.lat.toFixed(2)},${ponto.lng.toFixed(2)}` : `${recurso}:${cidade!.trim().toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value as T;

    try {
        const url = new URL(`https://api.openweathermap.org/data/2.5/${recurso}`);
        if (temPonto(ponto)) {
            url.searchParams.set('lat', String(ponto.lat));
            url.searchParams.set('lon', String(ponto.lng));
        } else {
            // ",BR" evita resolver "Bela Vista" para outro país
            url.searchParams.set('q', `${cidade!.trim()},BR`);
        }
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

export function getWeatherSummary(cidade?: string | null, ponto?: Ponto) {
    return consultar('weather', cidade, ponto, TTL_AGORA_MS, (d) => {
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
export function getForecastDays(cidade?: string | null, ponto?: Ponto) {
    return consultar<DiaDePrevisao[]>('forecast', cidade, ponto, TTL_PREVISAO_MS, (d) => {
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
export function previsaoEmTexto(dias: DiaDePrevisao[]) {
    return dias.map(({ hoje, semana, data, min, max, chuvaMm, chance }) => {
        const textoChuva = chuvaMm >= 1
            ? `chuva ${chuvaMm} mm (chance ${Math.round(chance * 100)}%)`
            : chance >= 0.3 ? `chuva fraca possível (chance ${Math.round(chance * 100)}%)` : 'sem chuva';
        return `- ${hoje ? 'hoje, ' : ''}${semana} ${data}: ${min} a ${max}°C, ${textoChuva}`;
    }).join('\n');
}

// --- Chuva dos últimos dias, evapotranspiração e altitude (Open-Meteo) ---
// A OpenWeather gratuita só dá a previsão: sem a chuva que já caiu, o alerta de semeadura não
// sabia se a terra estava úmida. A Open-Meteo (https://open-meteo.com, dados CC BY 4.0, uso não
// comercial sem chave) estima a chuva dos dias passados, a evapotranspiração (FAO-56) e a altitude.
const DIAS_PASSADOS = 30;
// Dia com menos de 1 mm conta como seco (o mesmo limiar dos índices de dias secos seguidos da OMM)
const DIA_SECO_MM = 1;

export type ChuvaRecente = {
    altitude: number | null;
    chuva7: number;
    chuva30: number;
    // Dias seguidos sem chuva, contados de ontem para trás
    diasSemChuva: number;
    // Chuva do resto dos 30 dias, antes desses dias secos: mostra se a época das chuvas já tinha começado
    chuvaAntesDaSeca: number;
    // Evapotranspiração de referência (ET0) média de hoje e dos 2 próximos dias, em mm por dia
    et0: number | null;
};

export async function getChuvaRecente(ponto: Ponto): Promise<ChuvaRecente | null> {
    if (!temPonto(ponto)) return null;
    const key = `open-meteo:${ponto.lat.toFixed(2)},${ponto.lng.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_PREVISAO_MS) return hit.value as ChuvaRecente;
    try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(ponto.lat));
        url.searchParams.set('longitude', String(ponto.lng));
        url.searchParams.set('daily', 'precipitation_sum,et0_fao_evapotranspiration');
        url.searchParams.set('past_days', String(DIAS_PASSADOS));
        url.searchParams.set('forecast_days', '3');
        url.searchParams.set('timezone', 'America/Sao_Paulo');
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return null;
        const d = await res.json();
        const chuva: number[] = (d.daily?.precipitation_sum ?? []).map((v: number | null) => v ?? 0);
        const et0: (number | null)[] = d.daily?.et0_fao_evapotranspiration ?? [];
        if (chuva.length < DIAS_PASSADOS + 1) return null;
        // Os DIAS_PASSADOS primeiros são os dias passados; depois vêm hoje e os próximos
        const passados = chuva.slice(0, DIAS_PASSADOS);
        const soma = (lista: number[]) => Math.round(lista.reduce((a, b) => a + b, 0));
        let diasSemChuva = 0;
        while (diasSemChuva < passados.length && passados[passados.length - 1 - diasSemChuva] < DIA_SECO_MM) diasSemChuva++;
        const proximos = et0.slice(DIAS_PASSADOS).filter((v): v is number => typeof v === 'number');
        const value: ChuvaRecente = {
            altitude: typeof d.elevation === 'number' ? Math.round(d.elevation) : null,
            chuva7: soma(passados.slice(-7)),
            chuva30: soma(passados),
            diasSemChuva,
            chuvaAntesDaSeca: soma(passados.slice(0, passados.length - diasSemChuva)),
            et0: proximos.length ? Math.round(10 * proximos.reduce((a, b) => a + b, 0) / proximos.length) / 10 : null,
        };
        if (cache.size > 400) cache.clear();
        cache.set(key, { at: Date.now(), value });
        return value;
    } catch {
        return null;
    }
}
