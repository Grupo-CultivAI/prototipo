// Qual banco um script ou teste vai usar. O .env.local aponta para o banco da produção (o mesmo
// da Vercel): sem cuidado, um teste criava e apagava usuários lá, e um script com --confirmar
// alterava dados reais achando que estava num banco local (revisão de engenharia, 03/11/2026).
import readline from 'node:readline/promises';

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// mongodb://usuario:senha@host1:27017,host2/banco?opcoes (o URL do JavaScript não lê vários hosts)
const FORMATO = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(\/[^?]*)?/;

// Host e banco, sem usuário nem senha
export function descreverBanco(uri) {
    const m = String(uri ?? '').match(FORMATO);
    return m ? `${m[2]}${m[3] && m[3] !== '/' ? m[3] : ''}` : '(MONGODB_URI vazia ou inválida)';
}

export function bancoLocal(uri) {
    const m = String(uri ?? '').match(FORMATO);
    return Boolean(m) && !m[1] && m[2].split(',').every((h) => HOSTS_LOCAIS.has(h.replace(/:\d+$/, '')));
}

// Testes: só num banco local (o banco em memória ou um MongoDB na própria máquina). Com
// --producao, roda mesmo assim, depois de avisar.
export function exigirBancoDeTeste(uri, args = process.argv) {
    if (bancoLocal(uri)) return;
    if (args.includes('--producao')) {
        console.warn(`⚠️  Rodando no banco ${descreverBanco(uri)}, que não é local (--producao).`);
        return;
    }
    console.error(`O teste usaria o banco ${descreverBanco(uri)}, que não é local (o .env.local aponta para a produção).
Rode com o banco de teste, o mesmo que o servidor usa, por exemplo:
  MONGODB_URI=mongodb://127.0.0.1:27999/cultivai npm run cenarios-chat
Para rodar na produção de propósito, acrescente --producao.`);
    process.exit(1);
}

// Scripts que gravam: num banco que não é local, pede para digitar "producao" antes. Sem
// terminal (rodando por outro programa), só com --sim.
export async function confirmarEscrita(uri, args = process.argv) {
    const destino = descreverBanco(uri);
    if (bancoLocal(uri)) {
        console.log(`Banco: ${destino} (local)`);
        return;
    }
    if (args.includes('--sim')) {
        console.log(`Banco: ${destino} (não é local; confirmado com --sim)`);
        return;
    }
    if (!process.stdin.isTTY) {
        console.error(`Banco ${destino} não é local. Para gravar nele sem terminal, acrescente --sim.`);
        process.exit(1);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const resposta = await rl.question(`⚠️  Este script vai ALTERAR o banco ${destino}, que não é local (provavelmente a produção).\nPara continuar, digite producao: `);
    rl.close();
    if (resposta.trim().toLowerCase() !== 'producao') {
        console.log('Nada foi alterado.');
        process.exit(1);
    }
}
