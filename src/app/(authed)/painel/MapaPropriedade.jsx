import mapa from '@/lib/dados/mapa-brasil.json';
import styles from './painel.module.css';

// Mapa do Brasil com o estado e a cidade da propriedade. Os estados vêm como imagem
// (public/mapa/brasil.svg, guardada em cache pelo navegador); por cima, só o estado da
// propriedade e o ponto da cidade. Gerados por scripts/gerar-mapa-brasil.mjs.
const { largura, altura, projecao, contornos, centros } = mapa;

const projetar = ([lng, lat]) => [
    (lng - projecao.minLng) * projecao.escalaX,
    (projecao.maxLat - lat) * projecao.escalaY,
];

export default function MapaPropriedade({ uf, codigoMunicipio, rotulo }) {
    const contorno = uf ? contornos[uf] : null;
    // Município criado depois da malha do IBGE (sem ponto): fica só o estado destacado.
    const centro = codigoMunicipio && centros[codigoMunicipio] ? projetar(centros[codigoMunicipio]) : null;
    const descricao = rotulo ? `Mapa do Brasil com a propriedade em ${rotulo}` : 'Mapa do Brasil';

    return (
        <div className={styles.mapa}>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização */}
            <img src="/mapa/brasil.svg" alt="" width={largura} height={altura} className={styles.mapaBase} />
            <svg viewBox={`0 0 ${largura} ${altura}`} className={styles.mapaCamada} role="img" aria-label={descricao}>
                {contorno && <path d={contorno} className={styles.estadoDestaque} />}
                {centro && (
                    <g transform={`translate(${centro[0]} ${centro[1]})`}>
                        <circle r="14" className={styles.pontoOnda} />
                        <circle r="6" className={styles.ponto} />
                    </g>
                )}
            </svg>
        </div>
    );
}
