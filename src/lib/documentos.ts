import catalogo from './documentos.json';

// Catálogo dos PDFs da base: o Pinecone guarda só o nome do arquivo, que muitas vezes não
// diz nada ao produtor ("pat.pdf", "ORAL11.pdf"). Documento novo entra aqui junto com a
// ingestão — scripts/check-pdfs.mjs avisa quem estiver faltando.
// condicao: em que situação o experimento foi feito, quando o título já diz (área irrigada,
// Cerrado, sistema orgânico...). Vai no rótulo do trecho para a IA, que só deve aplicar o
// resultado a quem está na mesma situação: em 03/11/2026, o estudo de área irrigada por
// aspersão vinha em 4 das 6 perguntas do teste com personas, de produtores que não irrigam.
type Documento = { titulo: string; url?: string; condicao?: string };
const CATALOGO: Record<string, Documento> = catalogo;

// Rótulo do trecho no prompt: "[Título (condição do experimento: ...), p. 3 do PDF]"
export function rotuloDoTrecho(arquivo: string, pagina?: number) {
    const doc = CATALOGO[arquivo];
    const condicao = doc?.condicao ? ` (condição do experimento: ${doc.condicao})` : '';
    return `[${doc?.titulo ?? arquivo}${condicao}${pagina ? `, p. ${pagina} do PDF` : ''}]`;
}

// Aplicado na leitura, não na gravação: corrigir um título no catálogo vale também para
// as respostas já salvas. Mensagens antigas guardavam a fonte como texto simples.
export function comTitulos(fontes: unknown) {
    if (!Array.isArray(fontes)) return fontes;
    return fontes.map((f) => {
        const fonte = typeof f === 'string' ? { fonte: f, paginas: [] } : f;
        const doc = CATALOGO[fonte?.fonte];
        return doc ? { ...fonte, titulo: doc.titulo, url: doc.url } : fonte;
    });
}
