// Confere que nenhuma cor está escrita direto no código: toda cor vem dos tokens de
// src/styles/variables.css (ver docs/design-system.md). Roda no CI a cada PR e à mão:
//
//   npm run checar-tokens
//
// Olha CSS e os estilos dentro do JavaScript/TypeScript (hexadecimal, rgb/rgba/hsl/hsla e nomes
// como white). Comentários ficam de fora, porque às vezes citam a cor antiga de propósito.
// Exceções, com o motivo:
// - src/styles/variables.css: é onde os tokens são definidos;
// - src/app/api/auth/esqueci-senha: email, e programas de email não leem variáveis de CSS.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FORA = [/styles[\\/]variables\.css$/, /api[\\/]auth[\\/]esqueci-senha/];
const COR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
// Nome de cor como valor: "color: white" no CSS, color: 'white' no JS
const NOME = /\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*['"]?(?:white|black|red|green|blue|gray|grey|yellow|orange)\b/gi;

const tirarComentarios = (texto) => texto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`])\/\/.*$/gm, (m, antes) => antes + ' '.repeat(m.length - antes.length));

function arquivos(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);
        if (e.isDirectory()) return arquivos(p);
        return /\.(css|js|jsx|ts|tsx)$/.test(e.name) && !FORA.some((r) => r.test(p)) ? [p] : [];
    });
}

const achados = [];
for (const arq of arquivos(RAIZ)) {
    const linhas = tirarComentarios(readFileSync(arq, 'utf8')).split('\n');
    linhas.forEach((linha, i) => {
        // Entidades de HTML (&#123;) e âncoras de link (#plano) não são cor
        const limpa = linha.replace(/&#\d+;/g, '').replace(/href=["'`][^"'`]*["'`]/g, '');
        for (const m of [...limpa.matchAll(COR), ...limpa.matchAll(NOME)]) {
            // "#plano", "#secao-..." em seletores e ids: só conta hexadecimal de 3, 4, 6 ou 8 dígitos
            if (m[0].startsWith('#') && ![4, 5, 7, 9].includes(m[0].length)) continue;
            achados.push(`${relative(RAIZ, arq)}:${i + 1}  ${m[0]}  →  ${linha.trim().slice(0, 100)}`);
        }
    });
}

if (achados.length) {
    console.log(`Cor escrita fora dos tokens (${achados.length}). Use var(--token) de src/styles/variables.css; se nenhum servir, crie um lá:\n`);
    for (const a of achados) console.log(`  ${a}`);
    if (process.env.GITHUB_ACTIONS) for (const a of achados) console.log(`::error title=Cor fora dos tokens::${a}`);
    process.exit(1);
}
console.log('Nenhuma cor escrita fora dos tokens.');
