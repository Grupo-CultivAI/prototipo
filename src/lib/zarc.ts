/**
 * Época de plantio oficial (ZARC) para o chat: as janelas das culturas citadas na pergunta, no
 * município, solo e manejo do perfil. Volta em duas formas: o texto para a IA e os dados do
 * quadro que a tela mostra abaixo da resposta (assim o ZARC aparece mesmo se a IA não citar).
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
// Pergunta sobre quando plantar ("O que plantar depois do milho?" não é): o quadro do ZARC,
// com a indicação do aplicativo oficial, aparece mesmo sem dados do município.
export const perguntaDeQuandoPlantar = (texto: string) => {
    const n = normalizar(texto);
    return /\bzarc\b/.test(n) || (/\b(quando|epoca|janela|calendario|data)\b/.test(n) && /\b(plant|seme|cultiv)/.test(n));
};
// paraIA vai no prompt; local, linhas e aviso vão para o quadro da tela.
export type EpocaDePlantio = { paraIA: string; local?: string; linhas: string[]; aviso?: string };

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

// Riscos dos 36 decêndios no solo do perfil; sem solo informado, o melhor caso entre os solos.
// null: plantio não indicado neste tipo de solo.
function riscosDaJanela(janelas: Janelas, grupo: string | undefined): number[] | null {
    if (typeof janelas === 'string') return decodificarFaixas(janelas);
    if (grupo) {
        const doSolo = janelas[grupo as 'A' | 'M' | 'G'];
        return doSolo ? decodificarFaixas(doSolo) : null;
    }
    return melhorRisco(...Object.values(janelas).map((f) => decodificarFaixas(f)));
}

type Municipio = { _id: string; nome: string; uf: string; j: Record<string, Entrada> };

// Filtro do município do perfil na coleção do ZARC; null sem cidade ou estado.
function filtroDoMunicipio(propriedade: any) {
    const uf = String(propriedade?.estado ?? '').trim().toUpperCase();
    // "Campinas - SP" ou "Campinas/SP" no campo da cidade
    const cidade = normalizar(String(propriedade?.cidade ?? '').replace(/\s*[-/,]\s*[A-Za-z]{2}\s*$/, ''));
    if (!uf || !cidade) return null;
    // Pelo código do IBGE quando o perfil tem (cidade escolhida na lista ou vinda do CEP);
    // senão, pelo nome (perfis antigos e cidade informada pelo formulário do chat).
    const codigo = String(propriedade?.codigoMunicipio ?? '');
    return /^\d{7}$/.test(codigo) ? { _id: codigo } : { uf, busca: cidade };
}

const culturasDoPerfil = (propriedade: any): string[] => [propriedade?.proximaCultura, ...(propriedade?.culturasHistorico ?? [])]
    .filter((c) => c && c !== 'Nenhum' && c !== 'Ainda não decidi');

// Culturas do ZARC que correspondem a um nome ("Milho" → Milho 1ª Safra, Milho 2ª Safra...).
const culturasCitadas = (municipio: Municipio, alvo: string) =>
    Object.keys(municipio.j).filter((c) => palavrasDaCultura(c).some((p: string) => contem(alvo, p)));

// "anterior" é a pergunta anterior, para continuações como "e para soja?". A cultura da
// pergunta atual tem prioridade: em "E alface, quando planto?" depois de falar de feijão,
// o quadro é o da alface.
export async function epocaDePlantio(propriedade: any, texto: string, anterior = ''): Promise<EpocaDePlantio | null> {
    const filtro = filtroDoMunicipio(propriedade);
    if (!filtro) return null;
    const uf = String(propriedade.estado).trim().toUpperCase();
    const pergunta = normalizar(texto);
    const antes = normalizar(anterior);
    // "Como controlar nematoides no milho?" não precisa de datas: economiza tokens.
    if (!PERGUNTA_DE_EPOCA.test(`${pergunta} ${antes}`)) return null;

    try {
        const municipio = await ZarcMunicipio.findOne(filtro).select('nome uf j').lean<Municipio>();
        if (!municipio?.j) {
            // Sem isso, a IA concluía que "não há janela de soja no município". Se a coleção
            // ainda está vazia (antes da primeira importação), não há o que avisar.
            if (!(await ZarcMunicipio.estimatedDocumentCount())) return null;
            const nome = `${String(propriedade.cidade).trim()}/${uf}`;
            return {
                paraIA: `A cidade "${nome}" do perfil não foi encontrada entre os municípios do ZARC. Peça ao produtor para conferir o nome da cidade no Meu Cultivo; não diga que a cultura não tem janela.`,
                linhas: [],
                aviso: `Não encontramos "${nome}" entre os municípios do ZARC. Confira o nome da cidade no Meu Cultivo.`,
            };
        }

        const citadas = (alvo: string) => culturasCitadas(municipio, alvo);

        // Primeiro a pergunta atual; só sem cultura nela, a anterior; por fim, o perfil.
        let escolhidas: string[] = [];
        for (const alvo of [pergunta, antes]) {
            escolhidas = citadas(alvo);
            const semZarc = alvo.match(FORA_DO_ZARC)?.[0];
            if (!escolhidas.length && semZarc) {
                const aviso = `O ZARC não tem janela de plantio para ${semZarc}.`;
                return { paraIA: `Município: ${municipio.nome}/${municipio.uf}.\n- ${aviso}`, local: `${municipio.nome}/${municipio.uf}`, linhas: [], aviso };
            }
            if (escolhidas.length) break;
        }
        if (!escolhidas.length) {
            escolhidas = [...new Set(culturasDoPerfil(propriedade).flatMap((c) => citadas(normalizar(c))))];
        }
        if (!escolhidas.length) return null;

        // Agrupadas pela palavra principal (milho 1ª safra, milho 2ª safra...), no máximo 4 grupos.
        const grupos = [...new Set(escolhidas.map((c) => palavrasDaCultura(c)[0]))].slice(0, CULTURAS_NO_CONTEXTO);
        // Dentro de cada grupo, do nome mais simples ao mais específico: Feijão, Feijão 2ª Safra...
        const grupoDe = (c: string) => grupos.indexOf(palavrasDaCultura(c)[0]);
        escolhidas = escolhidas.filter((c) => grupoDe(c) >= 0)
            .sort((a, b) => grupoDe(a) - grupoDe(b) || a.length - b.length)
            .slice(0, LINHAS_NO_CONTEXTO);

        const irriga = Boolean(propriedade?.irrigacao) && propriedade.irrigacao !== 'Não irrigo';
        const grupo = GRUPO_DO_PERFIL[String(propriedade?.tipoSolo ?? '') as keyof typeof GRUPO_DO_PERFIL];
        const linhas = escolhidas.map((c) => {
            const entrada = municipio.j[c];
            // Irrigado se o produtor irriga, ou se a cultura só é zoneada irrigada (tomate industrial)
            const manejo = (irriga && entrada.i) || !entrada.s ? 'i' : 's';
            const janelas = entrada[manejo];
            return `${c} (${manejo === 'i' ? 'irrigado' : 'sequeiro'}): ${janelas ? textoDaJanela(janelas, grupo) : 'plantio não indicado'}`;
        });
        const solo = grupo ? `solo ${NOME_DO_GRUPO[grupo as keyof typeof NOME_DO_GRUPO]}` : 'tipo de solo não informado';
        return {
            paraIA: `Município: ${municipio.nome}/${municipio.uf}; ${solo}.\n${linhas.map((l) => `- ${l}`).join('\n')}`,
            local: `${municipio.nome}/${municipio.uf} · ${solo}`,
            linhas,
        };
    } catch (err) {
        console.warn('ZARC indisponível:', err);
        return null;
    }
}

// --- Calendário do Painel: as janelas de todas as culturas do perfil, decêndio a decêndio ---

// riscos: 36 decêndios (0 = plantio não indicado); null = não indicado neste tipo de solo.
export type LinhaDoCalendario = { cultura: string; manejo: 'sequeiro' | 'irrigado'; riscos: number[] | null; proxima: boolean };
export type CalendarioDePlantio =
    | { encontrado: true; codigoMunicipio: string; local: string; solo: string | null; linhas: LinhaDoCalendario[]; semZarc: string[] }
    | { encontrado: false; local: string };

const LINHAS_NO_CALENDARIO = 6;
const VARIACOES_POR_CULTURA = 2;

// Ordem das variações de uma cultura do perfil: o mesmo nome, depois as safras (Milho 1ª
// Safra, Milho 2ª Safra), depois o resto (Feijão Caupi, Milho consorciado com Braquiária).
// Sem isso, "Feijão" ocupava metade do calendário e a soja ficava de fora.
function ordemDaVariacao(nomeDoPerfil: string, cultura: string) {
    const n = normalizar(cultura);
    if (n === normalizar(nomeDoPerfil)) return 0;
    return /^\S+ \d\S* safra$/.test(n) ? 1 : 2;
}

export async function calendarioDePlantio(propriedade: any): Promise<CalendarioDePlantio | null> {
    const filtro = filtroDoMunicipio(propriedade);
    if (!filtro) return null;
    try {
        const municipio = await ZarcMunicipio.findOne(filtro).select('nome uf j').lean<Municipio>();
        if (!municipio?.j) {
            if (!(await ZarcMunicipio.estimatedDocumentCount())) return null;
            return { encontrado: false, local: `${String(propriedade.cidade).trim()}/${String(propriedade.estado).trim().toUpperCase()}` };
        }

        const irriga = Boolean(propriedade?.irrigacao) && propriedade.irrigacao !== 'Não irrigo';
        const grupo = GRUPO_DO_PERFIL[String(propriedade?.tipoSolo ?? '') as keyof typeof GRUPO_DO_PERFIL];
        const proxima = normalizar(propriedade?.proximaCultura ?? '');

        // A próxima cultura primeiro; cada cultura do perfil traz até duas variações do ZARC.
        const linhas: LinhaDoCalendario[] = [];
        const semZarc: string[] = [];
        for (const nome of new Set(culturasDoPerfil(propriedade))) {
            const doZarc = culturasCitadas(municipio, normalizar(nome))
                .sort((a, b) => ordemDaVariacao(nome, a) - ordemDaVariacao(nome, b) || a.length - b.length);
            if (!doZarc.length) semZarc.push(nome);
            for (const c of doZarc.filter((x) => !linhas.some((l) => l.cultura === x)).slice(0, VARIACOES_POR_CULTURA)) {
                const entrada = municipio.j[c];
                const manejo = (irriga && entrada.i) || !entrada.s ? 'i' : 's';
                const janelas = entrada[manejo];
                linhas.push({
                    cultura: c,
                    manejo: manejo === 'i' ? 'irrigado' : 'sequeiro',
                    riscos: janelas ? riscosDaJanela(janelas, grupo) : null,
                    proxima: normalizar(nome) === proxima,
                });
            }
        }
        return {
            encontrado: true,
            codigoMunicipio: municipio._id,
            local: `${municipio.nome}/${municipio.uf}`,
            solo: grupo ? NOME_DO_GRUPO[grupo as keyof typeof NOME_DO_GRUPO] : null,
            linhas: linhas.slice(0, LINHAS_NO_CALENDARIO),
            semZarc,
        };
    } catch (err) {
        console.warn('ZARC indisponível:', err);
        return null;
    }
}
