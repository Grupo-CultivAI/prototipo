// Formato compacto do ZARC (Zoneamento Agrícola de Risco Climático, Ministério da Agricultura),
// usado pelo importador (scripts/importar-zarc.mjs) e pelo chat (src/lib/zarc.ts).
//
// A tábua de risco divide o ano em 36 decêndios (períodos de 10 dias: 1 = 1 a 10 de janeiro,
// 36 = 21 a 31 de dezembro) e dá, para cada um, o risco de perder a lavoura por clima:
// 20%, 30% ou 40%, ou 0 quando o plantio não é indicado. Aqui cada janela vira texto curto,
// "1-5:2,28-36:3" (decêndios 1 a 5 com risco 20%, 28 a 36 com risco 30%).

export const normalizar = (texto) => String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Solo na tábua: 1, 2 e 3 (arenoso, textura média, argiloso) nas portarias antigas; 11 a 16
// (AD1 a AD6, água disponível no solo, do menor para o maior) nas novas. O perfil só tem
// arenoso/argiloso/siltoso/misto, então as seis classes viram três grupos — aproximação.
export const GRUPO_DO_SOLO = { 1: 'A', 11: 'A', 12: 'A', 2: 'M', 13: 'M', 14: 'M', 3: 'G', 15: 'G', 16: 'G' };
export const GRUPO_DO_PERFIL = { arenoso: 'A', siltoso: 'M', misto: 'M', argiloso: 'G' };
export const NOME_DO_GRUPO = { A: 'arenoso', M: 'textura média', G: 'argiloso' };

export function codificarFaixas(riscos) {
    const partes = [];
    for (let i = 0; i < 36;) {
        if (!riscos[i]) { i++; continue; }
        let fim = i;
        while (fim + 1 < 36 && riscos[fim + 1] === riscos[i]) fim++;
        partes.push(`${i + 1}${fim > i ? `-${fim + 1}` : ''}:${riscos[i] / 10}`);
        i = fim + 1;
    }
    return partes.join(',');
}

export function decodificarFaixas(texto) {
    const riscos = new Array(36).fill(0);
    for (const parte of String(texto || '').split(',').filter(Boolean)) {
        const [faixa, nivel] = parte.split(':');
        const [ini, fim = ini] = faixa.split('-').map(Number);
        for (let d = ini; d <= fim; d++) riscos[d - 1] = Number(nivel) * 10;
    }
    return riscos;
}

// Menor risco de cada decêndio entre várias janelas (outro solo, outro ciclo de cultivar).
export function melhorRisco(...listas) {
    const riscos = new Array(36).fill(0);
    for (const lista of listas) {
        lista.forEach((r, i) => { if (r && (!riscos[i] || r < riscos[i])) riscos[i] = r; });
    }
    return riscos;
}

const ULTIMO_DIA = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const doisDigitos = (n) => String(n).padStart(2, '0');
export const inicioDoDecendio = (d) => `${doisDigitos([1, 11, 21][(d - 1) % 3])}/${doisDigitos(Math.floor((d - 1) / 3) + 1)}`;
export const fimDoDecendio = (d) => {
    const mes = Math.floor((d - 1) / 3);
    return `${doisDigitos([10, 20, ULTIMO_DIA[mes]][(d - 1) % 3])}/${doisDigitos(mes + 1)}`;
};

// Faixas de um nível de risco, em datas. A janela que passa de dezembro para janeiro
// (decêndio 36 seguido do 1) vira uma só: "21/09 a 10/01".
function periodos(riscos, nivel) {
    const faixas = [];
    for (let i = 0; i < 36;) {
        if (riscos[i] !== nivel) { i++; continue; }
        let fim = i;
        while (fim + 1 < 36 && riscos[fim + 1] === nivel) fim++;
        faixas.push([i + 1, fim + 1]);
        i = fim + 1;
    }
    if (faixas.length > 1 && faixas[0][0] === 1 && faixas[faixas.length - 1][1] === 36) {
        const primeira = faixas.shift();
        faixas[faixas.length - 1][1] = primeira[1];
    }
    return faixas.map(([ini, fim]) => `${inicioDoDecendio(ini)} a ${fimDoDecendio(fim)}`);
}

export function janelasEmTexto(riscos) {
    const partes = [20, 30, 40]
        .map((nivel) => [nivel, periodos(riscos, nivel)])
        .filter(([, lista]) => lista.length)
        .map(([nivel, lista]) => `risco ${nivel}% de ${lista.join(' e de ')}`);
    return partes.length ? partes.join('; ') : null;
}

// Palavras que identificam a cultura numa pergunta: a primeira palavra do nome ("Milho 2ª
// Safra" → milho) e os nomes entre parênteses ("Mandioca (aipim, macaxeira)").
const PALAVRAS_ESPECIAIS = {
    'grao de bico': ['grao de bico'],
    'cana de acucar acucar e alcool': ['cana'],
    'cana de acucar outros fins': ['cana'],
    'forrageira pecuaria': ['pastagem', 'pasto', 'forrageira'],
    'tangerina': ['tangerina', 'mexerica', 'bergamota', 'ponkan'],
};

export function palavrasDaCultura(nome) {
    const n = normalizar(nome);
    for (const [inicio, palavras] of Object.entries(PALAVRAS_ESPECIAIS)) {
        if (n.startsWith(inicio)) return palavras;
    }
    const entreParenteses = (String(nome).match(/\(([^)]*)\)/)?.[1] ?? '')
        .split(',').map(normalizar).filter((p) => p && !p.startsWith('acrocomia'));
    return [n.split(' ')[0], ...entreParenteses];
}
