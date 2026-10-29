// Gera o mapa do Brasil do Painel, a partir das malhas do IBGE (gratuitas, sem chave):
// - public/mapa/brasil.svg: os estados, como imagem (o navegador guarda em cache);
// - src/lib/dados/mapa-brasil.json: o contorno de cada estado (para destacar o da
//   propriedade) e o ponto central de cada município, em longitude e latitude.
// O Painel desenha por cima da imagem o estado e o ponto da cidade; a tela não depende do
// IBGE estar no ar.
//
// Uso: node scripts/gerar-mapa-brasil.mjs
// Rodar de novo só se o IBGE criar municípios (raro).
import fs from 'node:fs';
import path from 'node:path';

const URL_ESTADOS = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&qualidade=minima&formato=application/vnd.geo%2Bjson';
const URL_MUNICIPIOS = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR/metadados?intrarregiao=municipio';
const SIGLAS = {
    11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN',
    25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC',
    43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};
// Ilhas oceânicas (Fernando de Noronha, Trindade, Rocas) ficam de fora: esticariam o mapa.
const LESTE_DO_CONTINENTE = -34.7;
// Unidades do desenho por grau. A longitude encolhe pelo cosseno da latitude média do país,
// para o mapa não sair achatado.
const ESCALA = 10;
const COS_LATITUDE = Math.cos((-14 * Math.PI) / 180);

async function baixar(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`IBGE: HTTP ${res.status} em ${url}`);
    return res.json();
}

const [estados, municipios] = await Promise.all([baixar(URL_ESTADOS), baixar(URL_MUNICIPIOS)]);

const aneisDe = (geometria) => (geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates)
    .flat()
    .filter((anel) => anel.some(([lng]) => lng < LESTE_DO_CONTINENTE));

let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const f of estados.features) {
    for (const [lng, lat] of aneisDe(f.geometry).flat()) {
        minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
}
const projecao = { minLng, maxLat, escalaX: ESCALA * COS_LATITUDE, escalaY: ESCALA };
const largura = Math.ceil((maxLng - minLng) * projecao.escalaX);
const altura = Math.ceil((maxLat - minLat) * projecao.escalaY);
const ponto = ([lng, lat]) => [(lng - minLng) * projecao.escalaX, (maxLat - lat) * projecao.escalaY];

// Caminho SVG com coordenadas relativas e uma casa decimal (o arquivo fica ~3x menor).
function caminho(aneis) {
    let d = '';
    for (const anel of aneis) {
        let [ax, ay] = ponto(anel[0]).map((v) => Math.round(v * 10));
        d += `M${ax / 10} ${ay / 10}`;
        for (const coordenada of anel.slice(1)) {
            const [x, y] = ponto(coordenada).map((v) => Math.round(v * 10));
            if (x === ax && y === ay) continue;
            d += `l${(x - ax) / 10} ${(y - ay) / 10}`;
            [ax, ay] = [x, y];
        }
        d += 'z';
    }
    return d;
}

const contornos = {};
for (const f of estados.features) {
    const uf = SIGLAS[f.properties.codarea];
    if (!uf) throw new Error(`estado inesperado: ${f.properties.codarea}`);
    contornos[uf] = caminho(aneisDe(f.geometry));
}

const centros = {};
for (const m of municipios) {
    if (!/^\d{7}$/.test(m.id) || !m.centroide) throw new Error(`município inesperado: ${JSON.stringify(m).slice(0, 200)}`);
    // [longitude, latitude], com duas casas (cerca de 1 km)
    centros[m.id] = [Number(m.centroide.longitude.toFixed(2)), Number(m.centroide.latitude.toFixed(2))];
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Mapa do Brasil">`
    + `<g fill="#E3EFE7" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round">`
    + Object.entries(contornos).map(([uf, d]) => `<path id="${uf}" d="${d}"/>`).join('')
    + '</g></svg>\n';

fs.mkdirSync(path.join('public', 'mapa'), { recursive: true });
fs.writeFileSync(path.join('public', 'mapa', 'brasil.svg'), svg);
fs.mkdirSync(path.join('src', 'lib', 'dados'), { recursive: true });
fs.writeFileSync(path.join('src', 'lib', 'dados', 'mapa-brasil.json'), JSON.stringify({ largura, altura, projecao, contornos, centros }));
console.log(`${Object.keys(contornos).length} estados e ${Object.keys(centros).length} municípios; desenho de ${largura} x ${altura}`);
