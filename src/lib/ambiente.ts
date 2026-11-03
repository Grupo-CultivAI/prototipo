// Número de uma variável de ambiente opcional (limites de uso e de cadastro). Sem a variável, ou
// com valor vazio, inválido ou menor que 1, vale o padrão. Com Number(process.env.X ?? padrão),
// uma variável criada na Vercel sem valor virava 0 e bloqueava todo mundo: com limite 0, a
// primeira pergunta e o primeiro cadastro já passam do limite. Sem imports, para os testes em node.
export function numeroDoAmbiente(nome: string, padrao: number): number {
    const valor = Number(process.env[nome]);
    return Number.isFinite(valor) && valor >= 1 ? Math.floor(valor) : padrao;
}
