/**
 * Época de plantio oficial (ZARC) para o contexto do chat: as janelas das culturas citadas na
 * pergunta, no município, solo e manejo do perfil, em poucas linhas.
 * - Sem município no perfil (ou nome que não bate com o do IBGE), não manda nada.
 * - Só em perguntas sobre plantio ou época. Cultura citada na pergunta tem prioridade; sem
 *   cultura citada, entram a próxima cultura e as culturas do perfil.
 */
import ZarcMunicipio from '@/models/ZarcMunicipio';
import {
    GRUPO_DO_PERFIL, NOME_DO_GRUPO, decodificarFaixas, janelasEmTexto, melhorRisco, normalizar, palavrasDaCultura,
} from '@/lib/zarc-formato.mjs';

type Janelas = string | Partial<Record<'A' | 'M' | 'G', string>>;
type Entrada = { s?: Janelas; i?: Janelas };

const PERGUNTA_DE_EPOCA = /\b(quando|epoca|janela|calendario|mes|meses|plant\w*|seme\w*|zarc|data|datas)\b/;
// Culturas comuns que o ZARC não cobre (de tomate e alho, só tem tomate industrial e alho
// nobre, que entram pelo nome). Sem isso, "quando planto alface?" cairia nas culturas do
// perfil e a IA receberia a janela da soja.
const FORA_DO_ZARC = /\b(alface|couve|repolho|brocolis|couve flor|cenoura|beterraba|rabanete|rucula|agriao|espinafre|cebolinha|salsa|salsinha|coentro|pepino|abobora|abobrinha|chuchu|berinjela|jilo|quiabo|pimentao|pimenta|vagem|ervilha|inhame|cara|batata doce|morango|hortalica|hortalicas|horta)\b/;
// Pergunta sobre quando plantar ("O que plantar depois do milho?" não é): a resposta sempre
// termina indicando o aplicativo oficial, com ou sem dados do ZARC.
export const perguntaDeQuandoPlantar = (texto: string) => {
    const n = normalizar(texto);
    return /\bzarc\b/.test(n) || (/\b(quando|epoca|janela|calendario|data)\b/.test(n) && /\b(plant|seme|cultiv)/.test(n));
};
export const INDICACAO_DO_APLICATIVO = '📱 Para conferir a janela oficial da sua cultivar e do seu solo, use o aplicativo gratuito **Zarc Plantio Certo**, da Embrapa.';

const CULTURAS_NO_CONTEXTO = 4;
const LINHAS_NO_CONTEXTO = 8;

const contem = (texto: string, palavra: string) => ` ${texto} `.includes(` ${palavra} `);

function textoDaJanela(janelas: Janelas, grupo: string | undefined): string {
    if (typeof janelas === 'string') return janelasEmTexto(decodificarFaixas(janelas)) ?? 'plantio não indicado';
    if (grupo) {
        const doSolo = janelas[grupo as 'A' | 'M' | 'G'];
        return doSolo ? janelasEmTexto(decodificarFaixas(doSolo)) ?? 'plantio não indicado' : 'plantio não indicado neste tipo de solo';
    }
    // Solo não informado: o melhor caso entre os solos em que a cultura é indicada
    const melhor = janelasEmTexto(melhorRisco(...Object.values(janelas).map((f) => decodificarFaixas(f))));
    return melhor ? `${melhor} (varia com o tipo de solo)` : 'plantio não indicado';
}

export async function epocaDePlantio(propriedade: any, texto: string): Promise<string | null> {
    const uf = String(propriedade?.estado ?? '').trim().toUpperCase();
    // "Campinas - SP" ou "Campinas/SP" no campo da cidade
    const cidade = normalizar(String(propriedade?.cidade ?? '').replace(/\s*[-/,]\s*[A-Za-z]{2}\s*$/, ''));
    if (!uf || !cidade) return null;
    const pergunta = normalizar(texto);
    // "Como controlar nematoides no milho?" não precisa de datas: economiza tokens.
    if (!PERGUNTA_DE_EPOCA.test(pergunta)) return null;

    try {
        const municipio = await ZarcMunicipio.findOne({ uf, busca: cidade }).select('nome uf j').lean<{ nome: string; uf: string; j: Record<string, Entrada> }>();
        if (!municipio?.j) {
            // Sem isso, a IA concluía que "não há janela de soja no município". Se a coleção
            // ainda está vazia (antes da primeira importação), não há o que avisar.
            if (!(await ZarcMunicipio.estimatedDocumentCount())) return null;
            return `A cidade "${String(propriedade.cidade).trim()}/${uf}" do perfil não foi encontrada entre os municípios do ZARC. Peça ao produtor para conferir o nome da cidade no Meu Cultivo; não diga que a cultura não tem janela.`;
        }

        const culturas = Object.keys(municipio.j);
        const citadas = (alvo: string) => culturas.filter((c) => palavrasDaCultura(c).some((p: string) => contem(alvo, p)));

        let escolhidas = citadas(pergunta);
        const semZarc = pergunta.match(FORA_DO_ZARC)?.[0];
        if (!escolhidas.length && semZarc) {
            return `Município: ${municipio.nome}/${municipio.uf}.\n- O ZARC não tem janela de plantio para ${semZarc}.`;
        }
        if (!escolhidas.length) {
            const doPerfil = [propriedade?.proximaCultura, ...(propriedade?.culturasHistorico ?? [])]
                .filter((c) => c && c !== 'Nenhum' && c !== 'Ainda não decidi');
            escolhidas = [...new Set(doPerfil.flatMap((c) => citadas(normalizar(c))))];
        }
        if (!escolhidas.length) return null;

        // Agrupadas pela palavra principal (milho 1ª safra, milho 2ª safra...), no máximo 4 grupos.
        const grupos = [...new Set(escolhidas.map((c) => palavrasDaCultura(c)[0]))].slice(0, CULTURAS_NO_CONTEXTO);
        escolhidas = escolhidas.filter((c) => grupos.includes(palavrasDaCultura(c)[0])).slice(0, LINHAS_NO_CONTEXTO);

        const irriga = Boolean(propriedade?.irrigacao) && propriedade.irrigacao !== 'Não irrigo';
        const grupo = GRUPO_DO_PERFIL[String(propriedade?.tipoSolo ?? '') as keyof typeof GRUPO_DO_PERFIL];
        const linhas = escolhidas.map((c) => {
            const entrada = municipio.j[c];
            // Irrigado se o produtor irriga, ou se a cultura só é zoneada irrigada (tomate industrial)
            const manejo = (irriga && entrada.i) || !entrada.s ? 'i' : 's';
            const janelas = entrada[manejo];
            return `- ${c} (${manejo === 'i' ? 'irrigado' : 'sequeiro'}): ${janelas ? textoDaJanela(janelas, grupo) : 'plantio não indicado'}`;
        });
        const solo = grupo ? `solo ${NOME_DO_GRUPO[grupo as keyof typeof NOME_DO_GRUPO]}` : 'tipo de solo não informado';
        return `Município: ${municipio.nome}/${municipio.uf}; ${solo}.\n${linhas.join('\n')}`;
    } catch (err) {
        console.warn('ZARC indisponível:', err);
        return null;
    }
}
