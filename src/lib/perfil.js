// Itens do cultivo (Meus Cultivos) que mais mudam uma recomendação de rotação. A mesma lista alimenta o
// indicador de perfil completo (Meus Cultivos) e o lembrete no início do chat.
export const ITENS_DO_PERFIL = [
    { chave: 'localizacao', rotulo: 'cidade e estado', preenchido: (p) => Boolean(p?.cidade && p?.estado) },
    { chave: 'solo', rotulo: 'tipo de solo', preenchido: (p) => Boolean(p?.tipoSolo) },
    { chave: 'culturas', rotulo: 'culturas dos últimos anos', preenchido: (p) => (p?.culturasHistorico || []).length > 0 },
    { chave: 'proxima', rotulo: 'próxima cultura', preenchido: (p) => Boolean(p?.proximaCultura) },
    { chave: 'sistema', rotulo: 'sistema de plantio', preenchido: (p) => Boolean(p?.sistemaPlantio) },
    { chave: 'irrigacao', rotulo: 'irrigação', preenchido: (p) => Boolean(p?.irrigacao) },
    { chave: 'objetivos', rotulo: 'objetivos', preenchido: (p) => (p?.objetivos || []).length > 0 },
];

export const itensFaltando = (p) => ITENS_DO_PERFIL.filter((i) => !i.preenchido(p));

// Tamanho da área: o formulário grava só o número de hectares; perfis antigos têm texto ("12 hectares").
export const tamanhoEmTexto = (t) => {
    const texto = String(t ?? '').trim();
    return /^\d+([.,]\d+)?$/.test(texto) ? `${texto} ha` : texto;
};

// Nome do cultivo para mostrar (Meus Cultivos). Os perfis de antes de 30/10/2026 não têm nome.
export const nomeDoCultivo = (c) => c?.nome?.trim() || (c?.cidade ? `Cultivo em ${c.cidade}` : 'Meu cultivo');

// Culturas como opções clicáveis: digitadas à mão, "milho", "Milho" e "milho " viravam
// três culturas diferentes.
export const CULTURAS_COMUNS = [
    'Milho', 'Milho safrinha', 'Feijão', 'Feijão-caupi', 'Soja', 'Mandioca', 'Arroz', 'Trigo',
    'Aveia', 'Sorgo', 'Milheto', 'Algodão', 'Amendoim', 'Cana-de-açúcar', 'Café', 'Hortaliças',
    'Braquiária ou pastagem', 'Crotalária', 'Nabo forrageiro', 'Mucuna',
];

const chave = (c) => String(c).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Grafia da lista quando a cultura está nela ("milho" → "Milho"); senão, primeira letra maiúscula.
export function normalizarCultura(c) {
    const texto = String(c ?? '').replace(/\s+/g, ' ').trim();
    if (!texto) return '';
    return CULTURAS_COMUNS.find((x) => chave(x) === chave(texto)) ?? texto[0].toUpperCase() + texto.slice(1);
}

export function semRepetir(culturas) {
    const vistas = new Set();
    return (culturas || []).map(normalizarCultura).filter((c) => c && !vistas.has(chave(c)) && vistas.add(chave(c)));
}

// Marcada antes de abrir o chat: o chat envia a pergunta da primeira análise ao carregar.
export const CHAVE_PEDIR_ANALISE = 'cultivai:pedirAnalise';
export const PERGUNTA_DE_ANALISE = 'Com base no perfil da minha propriedade, que rotação de culturas você recomenda para as próximas safras?';
