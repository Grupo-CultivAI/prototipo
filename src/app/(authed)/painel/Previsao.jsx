import { Sun, CloudSun, CloudDrizzle, CloudRain } from 'lucide-react';
import { getForecastDays } from '@/lib/weather';
import styles from './painel.module.css';

// Chuva e temperatura dos próximos 5 dias (OpenWeather, a mesma previsão que o chat usa).
// Carrega à parte (Suspense na página): a consulta leva até 3 segundos e não segura o resto.
function iconeDoDia({ chuvaMm, chance }) {
    if (chuvaMm >= 5) return CloudRain;
    if (chuvaMm >= 1 || chance >= 0.3) return CloudDrizzle;
    return chance >= 0.1 ? CloudSun : Sun;
}

export default async function Previsao({ cidade }) {
    const dias = await getForecastDays(cidade);
    if (!dias) return <p className={styles.vazio}>A previsão do tempo não está disponível agora. Tente de novo mais tarde.</p>;

    return (
        <ul className={styles.previsao}>
            {dias.map((dia) => {
                const Icone = iconeDoDia(dia);
                return (
                    <li key={dia.data} className={dia.hoje ? styles.diaHoje : undefined}>
                        <span className={styles.diaNome}>{dia.hoje ? 'Hoje' : dia.semana}</span>
                        <span className={styles.diaData}>{dia.data}</span>
                        <Icone size={28} aria-hidden="true" className={styles.diaIcone} />
                        <span className={styles.diaTemp}>{dia.min}° / {dia.max}°</span>
                        <span className={styles.diaChuva}>
                            {dia.chuvaMm >= 1 ? `${dia.chuvaMm} mm` : dia.chance >= 0.3 ? 'chuva fraca' : 'sem chuva'}
                            {(dia.chuvaMm >= 1 || dia.chance >= 0.3) && <small><span aria-hidden="true"> · </span>chance {Math.round(dia.chance * 100)}%</small>}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
