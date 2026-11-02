import { calendarioDePlantio } from '@/lib/zarc';
import { emDias, situacaoDaJanela } from '@/lib/janelaDePlantio';
import { nomeDoCultivo } from '@/lib/perfil';

// Avisos de janela de plantio (Painel): "A janela de plantio de feijão abre em 10 dias, em
// 01/01". Só das culturas que o produtor pretende plantar (a próxima cultura e a próxima etapa
// do plano de rotação), para não virar uma lista de tudo o que o ZARC tem.

export const DIAS_PARA_AVISAR_ABERTURA = 30;
export const DIAS_PARA_AVISAR_FECHAMENTO = 15;
const AVISOS_POR_CULTIVO = 2;
const AVISOS_NO_TOTAL = 6;

export type Aviso = {
    cultivoId: string;
    cultivo: string;
    cultura: string;
    tipo: 'fecha' | 'abre' | 'aberta';
    dias: number | null;
    texto: string;
};

// "Mandioca (aipim, macaxeira)" → "mandioca"; "Feijão 2ª Safra" → "feijão 2ª safra"
const nomeCurto = (cultura: string) => {
    const n = cultura.replace(/\s*\(.*\)\s*$/, '');
    return n.charAt(0).toLowerCase() + n.slice(1).toLowerCase();
};

const ORDEM = { fecha: 0, abre: 1, aberta: 2 };

export async function avisosDeJanela(cultivos: any[]): Promise<Aviso[]> {
    const porCultivo = await Promise.all(cultivos.map(async (c) => {
        if (!c.cidade || !c.estado) return [];
        const calendario = await calendarioDePlantio(c);
        if (!calendario?.encontrado) return [];
        const avisos: Aviso[] = [];
        for (const linha of calendario.linhas.filter((l) => l.proxima || l.doPlano)) {
            const s: any = situacaoDaJanela(linha.riscos);
            const base = { cultivoId: String(c._id), cultivo: nomeDoCultivo(c), cultura: linha.cultura };
            const cultura = nomeCurto(linha.cultura);
            if (s.agora && s.fechaEmDias != null && s.fechaEmDias <= DIAS_PARA_AVISAR_FECHAMENTO) {
                avisos.push({ ...base, tipo: 'fecha', dias: s.fechaEmDias, texto: `A janela de plantio de ${cultura} fecha ${emDias(s.fechaEmDias)}, em ${s.ate}. Depois disso, o plantio fica fora do calendário oficial.` });
            } else if (s.agora) {
                avisos.push({ ...base, tipo: 'aberta', dias: null, texto: s.ate ? `A janela de plantio de ${cultura} está aberta até ${s.ate}.` : `O plantio de ${cultura} é indicado o ano todo.` });
            } else if (s.abreEmDias != null && s.abreEmDias <= DIAS_PARA_AVISAR_ABERTURA) {
                avisos.push({ ...base, tipo: 'abre', dias: s.abreEmDias, texto: `A janela de plantio de ${cultura} abre ${emDias(s.abreEmDias)}, em ${s.inicio}.` });
            }
        }
        return avisos.sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo] || (a.dias ?? 99) - (b.dias ?? 99)).slice(0, AVISOS_POR_CULTIVO);
    }));
    return porCultivo.flat()
        .sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo] || (a.dias ?? 99) - (b.dias ?? 99))
        .slice(0, AVISOS_NO_TOTAL);
}
