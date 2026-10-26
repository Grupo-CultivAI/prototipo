import catalogo from './documentos.json';

// Catálogo dos PDFs da base: o Pinecone guarda só o nome do arquivo, que muitas vezes não
// diz nada ao produtor ("pat.pdf", "ORAL11.pdf"). Documento novo entra aqui junto com a
// ingestão — scripts/check-pdfs.mjs avisa quem estiver faltando.
type Documento = { titulo: string; url?: string };
const CATALOGO: Record<string, Documento> = catalogo;

export const tituloDoDocumento = (arquivo: string) => CATALOGO[arquivo]?.titulo ?? arquivo;

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
