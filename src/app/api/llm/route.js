import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import ChatMessage from '@/models/ChatMessage';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

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

async function fetchWeather(propriedade) {
    const cidade = propriedade?.cidade;
    if (!cidade) return null;

    const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const url = new URL('/api/weather', baseUrl);
    url.searchParams.set('city', cidade);

    const response = await fetch(url.toString());
    if (!response.ok) return null;
    return response.json();
}

function callAnythingLLM(messageText) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            message: messageText,
            mode: "chat"
        });

        fetch('https://anythingllm-production-1602.up.railway.app/api/v1/workspace/cultivai/chat', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer KPFT753-JQ4M5CG-JYJ42X9-YY8PS23',
                'Content-Type': 'application/json'
            },
            body: postData
        })
            .then(res => res.json().then(data => ({ statusCode: res.status, data })))
            .then(resolve)
            .catch(reject);
    });
}

export async function POST(req) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { question, user, propriedade, submittedData } = await req.json();

        await dbConnect();

        // 0. Salvar mensagem do usuário (apenas para histórico local na UI)
        await ChatMessage.create({
            userId,
            text: question,
            sender: 'user',
            metadata: { submittedData }
        });

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

        const weather = await fetchWeather(propriedade);

        // O RAG e o histórico agora são gerenciados nativamente pelo AnythingLLM.
        // O System Prompt deve ser configurado no painel do AnythingLLM.

        const contextPrompt = `
--- DADOS ATUAIS DA PROPRIEDADE (CONTEXTO) ---
Localização: ${propriedade?.cidade || '-'} / ${estado}
Clima Detalhado (JSON): ${weather ? JSON.stringify(weather) : 'Indisponível'}
Solo Físico: ${propriedade?.tipoSolo || '-'}, pH: ${propriedade?.phSolo || 'Não medido'}, Matéria Org.: ${propriedade?.materiaOrganica || '-'}, Drenagem: ${propriedade?.drenagem || '-'}
Histórico/Plantio: Plantando ${culturas} (Tempo na área: ${propriedade?.tempoCulturaAtual || '-'} anos). Uso de fertilizantes: ${propriedade?.usoFertilizantes || '-'}
Problemas Recentes Enfrentados: ${probs}
Objetivos Principais: ${objs}

Estação atual: ${estacao} ${regiaoClimaticaMsg}

--- PERGUNTA ATUAL ---
${question}
`;

        const response = await callAnythingLLM(contextPrompt);

        if (response.statusCode >= 200 && response.statusCode < 300) {
            const responseData = response.data;
            const textResponse = responseData.textResponse;

            if (textResponse) {
                try {
                    // Extrair apenas o bloco JSON usando regex
                    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : textResponse;

                    const parsedData = JSON.parse(jsonStr);

                    // Fallback caso a IA não retorne o campo "resposta"
                    if (!parsedData.resposta) {
                        if (parsedData.tipo === 'coleta_dados') {
                            parsedData.resposta = "Por favor, preencha os dados abaixo para que eu possa te ajudar melhor:";
                        } else {
                            parsedData.resposta = "Entendido.";
                        }
                    }

                    // Salvar resposta do bot (apenas para histórico local na UI)
                    await ChatMessage.create({
                        userId,
                        text: parsedData.resposta,
                        sender: 'bot',
                        metadata: { form: parsedData.tipo === 'coleta_dados' ? parsedData : null }
                    });

                    return NextResponse.json({ success: true, parsedData });
                } catch (e) {
                    console.error("AnythingLLM não retornou JSON valido ou erro ao salvar:", e, textResponse);
                    return NextResponse.json({ success: false, message: 'Falha no formato da resposta da IA.' }, { status: 500 });
                }
            } else {
                console.error("AnythingLLM retornou formato invalido:", responseData);
                return NextResponse.json({ success: false, message: 'Nenhuma resposta gerada.' }, { status: 500 });
            }
        } else {
            console.error("AnythingLLM API Error:", response.data);
            return NextResponse.json({ success: false, message: 'Erro na chamada ao modelo de linguagem.' }, { status: 500 });
        }

    } catch (err) {
        console.error("Erro ao chamar o modelo de linguagem:", err);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
