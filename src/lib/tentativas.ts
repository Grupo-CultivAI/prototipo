import TentativaAcesso from '@/models/TentativaAcesso';

// Sem limite, um robô podia testar milhares de senhas numa conta. Conta por email (protege
// a conta) e por IP (protege o sistema de quem tenta muitas contas a partir do mesmo lugar).
const JANELA_MS = 15 * 60 * 1000;
const LIMITES = {
    login: { email: 5, ip: 20 },
    recuperacao: { email: 3, ip: 10 },
    // Cada conta nova ganha o próprio limite de perguntas por dia: sem freio no cadastro, um
    // script criava contas à vontade e esgotava a cota da IA de todo o app (revisão de
    // engenharia, 03/11/2026). Uma turma numa oficina cadastra pelo mesmo wi-fi (um IP só),
    // por isso o padrão é folgado e ajustável na Vercel (LIMITE_CADASTROS_POR_IP).
    cadastro: { email: 5, ip: Number(process.env.LIMITE_CADASTROS_POR_IP ?? 20) },
} as const;

type Tipo = keyof typeof LIMITES;

export const ipDe = (req: Request) =>
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconhecido';

const chaves = (email: string, ip: string) => ({ email: `email:${email}`, ip: `ip:${ip}` });

export async function excedeuLimite(tipo: Tipo, email: string, ip: string) {
    const desde = new Date(Date.now() - JANELA_MS);
    const c = chaves(email, ip);
    const [porEmail, porIp] = await Promise.all([
        TentativaAcesso.countDocuments({ tipo, chave: c.email, criadaEm: { $gte: desde } }),
        TentativaAcesso.countDocuments({ tipo, chave: c.ip, criadaEm: { $gte: desde } }),
    ]);
    return porEmail >= LIMITES[tipo].email || porIp >= LIMITES[tipo].ip;
}

export async function registrarTentativa(tipo: Tipo, email: string, ip: string) {
    const c = chaves(email, ip);
    await TentativaAcesso.insertMany([{ tipo, chave: c.email }, { tipo, chave: c.ip }]);
}

// Depois de entrar ou trocar a senha, as falhas anteriores daquela conta deixam de contar.
export async function limparTentativas(tipo: Tipo, email: string) {
    await TentativaAcesso.deleteMany({ tipo, chave: chaves(email, '').email });
}

export const MINUTOS_DE_ESPERA = JANELA_MS / 60000;
