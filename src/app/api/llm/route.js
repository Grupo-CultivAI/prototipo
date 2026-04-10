import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import https from 'https';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback_secret'
);

async function getUserIdFromToken() {
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload.id;
    } catch (error) {
        return null;
    }
}

function callGroq(promptText, apiKey) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "Responda em Português." },
                { role: "user", content: promptText }
            ]
        });
        const req = https.request(
            {
                hostname: 'api.groq.com',
                path: '/openai/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey,
                    'Content-Length': Buffer.byteLength(postData)
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve({ statusCode: res.statusCode, data });
                });
            }
        );
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy(new Error('Timeout na requisicao'));
        });
        req.write(postData);
        req.end();
    });
}

export async function POST(req) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { question, user, propriedade } = await req.json();

        // 1. Inferência de Clima e Estação
        const dateNow = new Date();
        const month = dateNow.getMonth(); // 0 a 11
        let estacao = "Verão";
        if (month >= 2 && month <= 4) estacao = "Outono";
        else if (month >= 5 && month <= 7) estacao = "Inverno";
        else if (month >= 8 && month <= 10) estacao = "Primavera";

        const estado = propriedade?.estado || 'Não informado';
        const regiaoClimaticaMsg = estado !== 'Não informado' ? `(Considere o clima e regime de chuvas típico de ${estado} nesta época do ano)` : '';

        // 2. Formatando arrays se existirem
        const probs = propriedade?.problemasRecentes?.length > 0 ? propriedade.problemasRecentes.join(', ') : 'Nenhum reportado';
        const objs = propriedade?.objetivos?.length > 0 ? propriedade.objetivos.join(', ') : 'Nenhum reportado';
        const culturas = propriedade?.culturasHistorico?.length > 0 ? propriedade.culturasHistorico.join(', ') : (propriedade?.culturas || 'Não informado');

        const contextPrompt = `
Você é um agrônomo especialista em agricultura sustentável focado em ajudar pequenos e médios produtores.
Não explique teorias genéricas. Dê recomendações PRÁTICAS, DIRETAS e APLICÁVEIS.

--- DADOS INFERIDOS PELO SISTEMA ---
Estação atual no Brasil: ${estacao} ${regiaoClimaticaMsg}

--- REGRAS OBRIGATÓRIAS ---
- Adapte a resposta estritamente ao contexto da propriedade fornecido abaixo.
- Seja simples e direto. Sem jargões técnicos excessivos.
- Explique sempre o PORQUÊ (causa → efeito). Ex: "Porque o seu solo é arenoso e a drenagem é alta..."
- Sempre sugira ações práticas.
- Sugira rotação de cultura ou plantio consorciado SOMENTE se for coerente com o problema e objetivo da área. Não force essas ideias se não fizer sentido.

--- O PERFIL DESTA PROPRIEDADE ---
Localização: ${propriedade?.cidade || '-'} / ${estado}
Solo Físico: ${propriedade?.tipoSolo || '-'}, pH: ${propriedade?.phSolo || 'Não medido'}, Matéria Org.: ${propriedade?.materiaOrganica || '-'}, Drenagem: ${propriedade?.drenagem || '-'}
Histórico/Plantio: Plantando ${culturas} (Tempo na área: ${propriedade?.tempoCulturaAtual || '-'} anos). Uso de fertilizantes: ${propriedade?.usoFertilizantes || '-'}
Problemas Recentes Enfrentados: ${probs}
Objetivos Principais: ${objs}
Observações Extras: ${propriedade?.observacoes || 'Nenhuma'}

--- A PERGUNTA DADA PELO USUÁRIO ---
${question}
`;

        const apiKey = process.env.GROQ_API_KEY || "";
        const response = await callGroq(contextPrompt, apiKey);

        if (response.statusCode >= 200 && response.statusCode < 300) {
            const data = JSON.parse(response.data);

            if (data.choices && data.choices.length > 0) {
                return NextResponse.json({ success: true, text: data.choices[0].message.content });
            } else {
                console.error("Groq retornou formato invalido:", data);
                return NextResponse.json({ success: false, message: 'Nenhuma resposta gerada.' }, { status: 500 });
            }
        } else {
            console.error("Groq API Error:", response.data);
            return NextResponse.json({ success: false, message: 'Erro na chamada ao modelo de linguagem.' }, { status: 500 });
        }

    } catch (err) {
        console.error("Erro ao chamar o modelo de linguagem:", err);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
