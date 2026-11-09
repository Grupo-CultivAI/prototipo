import mapa from '@/lib/dados/mapa-brasil.json';
import styles from './painel.module.css';

// Mapa do Brasil com os cultivos do produtor. Os estados vêm como imagem (public/mapa/brasil.svg,
// guardada em cache pelo navegador); por cima, os estados com cultivo e um ponto em cada cidade,
// maior no cultivo escolhido no Painel. Gerados por scripts/gerar-mapa-brasil.mjs.
const { largura, altura, projecao, contornos, centros } = mapa;

const projetar = ([lng, lat]) => [
    (lng - projecao.minLng) * projecao.escalaX,
    (projecao.maxLat - lat) * projecao.escalaY,
];

// pontos: [{ uf, codigo, exato, rotulo, ativo }]; exato = { lat, lng } marcado no mapa do cultivo
export default function MapaPropriedade({ pontos = [] }) {
    const estados = [...new Set(pontos.map((p) => p.uf).filter((uf) => contornos[uf]))];
    // Município criado depois da malha do IBGE (sem centro): fica só o estado destacado.
    const marcados = pontos
        .filter((p) => p.exato || (p.codigo && centros[p.codigo]))
        .map((p) => ({ ...p, xy: projetar(p.exato ? [p.exato.lng, p.exato.lat] : centros[p.codigo]) }))
        .sort((a, b) => Number(a.ativo) - Number(b.ativo)); // o escolhido por cima
    const descricao = pontos.length
        ? `Mapa do Brasil com ${pontos.length === 1 ? 'o cultivo' : 'os cultivos'} em ${pontos.map((p) => p.rotulo).join('; ')}`
        : 'Mapa do Brasil';

    return (
        <div className={styles.mapa}>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização */}
            <img src="/mapa/brasil.svg" alt="" width={largura} height={altura} loading="lazy" className={`${styles.mapaBase} ${styles.mapaClaro}`} />
            {/* Tema escuro: o CSS mostra uma das duas; com loading="lazy", a escondida nem é baixada */}
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização */}
            <img src="/mapa/brasil-escuro.svg" alt="" width={largura} height={altura} loading="lazy" className={`${styles.mapaBase} ${styles.mapaEscuro}`} />
            <svg viewBox={`0 0 ${largura} ${altura}`} className={styles.mapaCamada} role="img" aria-label={descricao}>
                {estados.map((uf) => <path key={uf} d={contornos[uf]} className={styles.estadoDestaque} />)}
                {marcados.map((p) => (
                    <g key={`${p.codigo}-${p.rotulo}`} transform={`translate(${p.xy[0]} ${p.xy[1]})`}>
                        <title>{p.rotulo}</title>
                        {p.ativo && <circle r="14" className={styles.pontoOnda} />}
                        <circle r={p.ativo ? 6 : 4.5} className={p.ativo ? styles.ponto : styles.pontoOutro} />
                    </g>
                ))}
            </svg>
        </div>
    );
}
