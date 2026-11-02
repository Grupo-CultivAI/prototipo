import mongoose from 'mongoose';
import Propriedade from '@/models/Propriedade';
import Conversa from '@/models/Conversa';
import { ordenarSafras } from '@/lib/perfil';

// Meus Cultivos: cada produtor pode ter várias áreas, cada uma com cidade, solo e culturas
// próprias. Funções do servidor (rotas da API, Painel, chat).

// Um limite folgado só para ninguém encher o banco por engano ou de propósito.
export const LIMITE_DE_CULTIVOS = 20;

export { nomeDoCultivo } from '@/lib/perfil';

// Ajustes antes de gravar (POST e PATCH de /api/cultivos). atual: o cultivo como está, no PATCH.
// - Ponto do mapa apagado (null) vira { lat: null, lng: null }, que é como o banco guarda "sem ponto".
// - Safras em ordem de plantio.
// - Plano sem etapas vira null; com etapas, só elas mudam (fica guardado de qual resposta veio).
export function dadosParaGravar(dados: Record<string, any>, atual?: any) {
    const d: Record<string, any> = { ...dados };
    if (d.coordenadas === null) d.coordenadas = { lat: null, lng: null };
    if (d.safras) d.safras = ordenarSafras(d.safras);
    if (d.plano !== undefined) {
        if (!d.plano?.etapas?.length) d.plano = null;
        else if (atual?.plano) {
            d['plano.etapas'] = d.plano.etapas;
            delete d.plano;
        } else {
            d.plano = { etapas: d.plano.etapas, criadoEm: new Date() };
        }
    }
    return d;
}

export const cultivosDoUsuario = (userId: unknown) =>
    Propriedade.find({ userId }).sort({ createdAt: 1 }).lean<any[]>();

export async function cultivoDoUsuario(userId: unknown, id: unknown) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Propriedade.findOne({ _id: id, userId }).lean<any>();
}

// O cultivo de que a conversa trata. Conversa sem cultivo (as de antes de Meus Cultivos, ou de
// quem nunca escolheu um): se a pessoa tem um cultivo só, é ele, e a conversa passa a apontar
// para ele; com vários, a conversa é geral até ela escolher. Devolve também quantos ela tem.
export async function cultivoDaConversa(userId: unknown, conversa: { _id: unknown; propriedadeId?: unknown }) {
    if (conversa.propriedadeId) {
        const cultivo = await Propriedade.findOne({ _id: conversa.propriedadeId, userId }).lean<any>();
        if (cultivo) return { cultivo, outros: [] as any[] };
    }
    const cultivos = await cultivosDoUsuario(userId);
    if (cultivos.length !== 1) return { cultivo: null, outros: cultivos };
    await Conversa.updateOne({ _id: conversa._id }, { $set: { propriedadeId: cultivos[0]._id } });
    return { cultivo: cultivos[0], outros: [] as any[] };
}
