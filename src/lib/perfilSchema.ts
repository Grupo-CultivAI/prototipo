import { z } from 'zod';

// Um esquema só para cada cultivo de Meus Cultivos: a tela valida com ele e as rotas
// /api/cultivos também.
// Antes a rota gravava o que recebesse (qualquer campo, de qualquer tamanho), e o perfil
// entra no prompt da IA. Campos fora do esquema são descartados pelo zod.

export const ESTADOS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

const OPCAO_INVALIDA = { error: 'Escolha uma das opções da lista.' };
const texto = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
const lista = (maxItens: number, maxTexto: number) => z.array(texto(maxTexto)).max(maxItens, `Escolha no máximo ${maxItens}.`);

// Campo numérico vazio vira null; o input do navegador entrega texto.
const numeroOpcional = (min: number, max: number, mensagem: string) =>
    z.preprocess(
        (v) => (v === '' || v == null ? null : Number(v)),
        z.number({ error: 'Digite um número.' }).min(min, mensagem).max(max, mensagem).nullable(),
    ) as z.ZodType<number | null, unknown>;

export const perfilSchema = z.object({
    nome: texto(60),
    tamanho: texto(20),
    estado: z.enum([...ESTADOS, ''], OPCAO_INVALIDA),
    cidade: texto(80),
    // Código do IBGE da cidade escolhida na lista (ou vinda do CEP). O ZARC busca por ele.
    codigoMunicipio: z.string().trim().refine((v) => !v || /^\d{7}$/.test(v), 'Município inválido.'),
    cep: z.string().trim().refine((v) => !v || /^\d{5}-?\d{3}$/.test(v), 'CEP inválido.'),
    tipoSolo: z.enum(['arenoso', 'argiloso', 'siltoso', 'misto', 'nao_sei', ''], OPCAO_INVALIDA),
    phSolo: numeroOpcional(3.5, 9, 'O pH vai de 3,5 a 9.'),
    materiaOrganica: z.enum(['Baixa', 'Média', 'Alta', ''], OPCAO_INVALIDA),
    drenagem: z.enum(['Boa', 'Média', 'Ruim', ''], OPCAO_INVALIDA),
    analiseSolo: z.boolean(),
    culturasHistorico: lista(30, 40),
    tempoCulturaAtual: numeroOpcional(0, 100, 'Use de 0 a 100 anos.'),
    usoFertilizantes: z.enum(['Baixo', 'Médio', 'Alto', ''], OPCAO_INVALIDA),
    sistemaPlantio: z.enum(['Plantio direto', 'Convencional', 'Cultivo mínimo', 'Não sei', ''], OPCAO_INVALIDA),
    irrigacao: z.enum(['Não irrigo', 'Aspersão', 'Gotejamento', 'Sulco ou inundação', 'Outro', ''], OPCAO_INVALIDA),
    problemasRecentes: lista(10, 40),
    objetivos: lista(10, 60),
    proximaCultura: texto(40),
    observacoes: texto(1000),
    safras: z.array(z.object({
        cultura: texto(40).min(1, 'Escolha a cultura.'),
        ano: z.coerce.number({ error: 'Escolha o ano.' }).int().min(1990, 'Ano inválido.').max(2100, 'Ano inválido.'),
        periodo: z.enum(['verao', 'inverno'], OPCAO_INVALIDA),
    })).max(30, 'Registre no máximo 30 safras.'),
    // Ponto marcado no mapa; o retângulo cobre o Brasil continental.
    coordenadas: z.object({
        lat: z.number().min(-34, 'Ponto fora do Brasil.').max(6, 'Ponto fora do Brasil.'),
        lng: z.number().min(-74, 'Ponto fora do Brasil.').max(-28, 'Ponto fora do Brasil.'),
    }).nullable(),
    plano: z.object({
        etapas: z.array(z.object({
            quando: texto(60),
            cultura: texto(60).min(1, 'Informe a cultura da etapa.'),
            objetivo: texto(200),
            feita: z.boolean(),
        })).max(12, 'O plano pode ter no máximo 12 etapas.'),
    }).nullable(),
});

// Na rota, tudo é opcional: o formulário do chat manda só o dado pedido (ex.: { tipoSolo }).
export const perfilParcialSchema = perfilSchema.partial();

// No formulário do cultivo, nome, estado e cidade são obrigatórios, e a cidade vem da lista do
// IBGE (texto livre não bate com o ZARC: "Uberlandia", "Campinas - SP"...).
export const formularioPerfilSchema = perfilSchema.extend({
    nome: texto(60).min(1, 'Dê um nome ao cultivo.'),
    estado: z.enum(ESTADOS, { error: 'Estado é obrigatório.' }),
    cidade: texto(80).min(1, 'Cidade é obrigatória.'),
}).refine((p) => /^\d{7}$/.test(p.codigoMunicipio), { path: ['cidade'], message: 'Escolha a cidade na lista.' });

export type PerfilFormulario = z.input<typeof formularioPerfilSchema>;
export type PerfilValidado = z.output<typeof formularioPerfilSchema>;
