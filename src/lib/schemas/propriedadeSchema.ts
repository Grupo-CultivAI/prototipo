import { z } from 'zod';

export const propriedadeSchema = z.object({
    tamanho: z.string().optional(),

    // 1. Localização (clima)
    estado: z.string().min(1, "Estado é obrigatório"),
    cidade: z.string().min(1, "Cidade é obrigatória"),
    cep: z.string().optional().refine((val) => !val || /^\d{5}-\d{3}$/.test(val), "Formato de CEP inválido (ex: 12345-678)"),
    coordenadas: z.object({
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional()
    }).optional(),

    // 2. Solo
    tipoSolo: z.enum(["arenoso", "argiloso", "siltoso", "misto"]),
    phSolo: z.number().min(3.5, "pH muito baixo").max(9, "pH muito alto").nullable().optional(),
    materiaOrganica: z.enum(["Baixa", "Média", "Alta", ""]).optional().nullable(),
    drenagem: z.enum(["Boa", "Média", "Ruim", ""]).optional().nullable(),
    analiseSolo: z.boolean().default(false),

    // 3. Histórico da área
    culturasHistorico: z.array(z.string()).default([]),
    tempoCulturaAtual: z.number().min(0, "Tempo não pode ser negativo").nullable().optional(),
    usoFertilizantes: z.enum(["Baixo", "Médio", "Alto", ""]).optional().nullable(),
    problemasRecentes: z.array(z.string()).default([]),

    // 4. Objetivos
    objetivos: z.array(z.string()).default([]),
    observacoes: z.string().optional().nullable()
});

export type PropriedadeFormData = z.infer<typeof propriedadeSchema>;
