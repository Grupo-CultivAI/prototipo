import { z } from 'zod';

// Um esquema só para o Meu Cultivo: a tela valida com ele e a rota /api/propriedade também.
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
});

// Na rota, tudo é opcional: o formulário do chat manda só o dado pedido (ex.: { tipoSolo }).
export const perfilParcialSchema = perfilSchema.partial();

// Na tela do Meu Cultivo, estado e cidade são obrigatórios, e a cidade vem da lista do IBGE
// (texto livre não bate com o ZARC: "Uberlandia", "Campinas - SP"...).
export const formularioPerfilSchema = perfilSchema.extend({
    estado: z.enum(ESTADOS, { error: 'Estado é obrigatório.' }),
    cidade: texto(80).min(1, 'Cidade é obrigatória.'),
}).refine((p) => /^\d{7}$/.test(p.codigoMunicipio), { path: ['cidade'], message: 'Escolha a cidade na lista.' });

export type PerfilFormulario = z.input<typeof formularioPerfilSchema>;
export type PerfilValidado = z.output<typeof formularioPerfilSchema>;
