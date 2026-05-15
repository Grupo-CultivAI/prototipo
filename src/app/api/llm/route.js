import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import https from 'https';
import dbConnect from '@/lib/mongodb';
import Knowledge from '@/models/Knowledge';
import { generateEmbedding } from '@/lib/rag/vectors';

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

function callGroq(promptText, apiKey, history = []) {
    const systemPrompt = `Você é o CultivAI, um agrônomo especialista em agricultura sustentável amigável e prestativo.
Seu objetivo é ajudar pequenos produtores com recomendações PRÁTICAS, mas mantendo um tom de conversa humano e acolhedor.

Obrigatório: VOCÊ DEVE RESPONDER EXATAMENTE NESTE FORMATO JSON:
{
  "tipo": "texto" | "coleta_dados",
  "resposta": "Sua mensagem para o usuário",
  "campos_necessarios": [ // Se tipo == "coleta_dados"
    { "chave": "nomeDaChaveNoBanco", "label": "Pergunta para o usuário", "tipo": "text" | "number" | "select", "opcoes": ["Opção 1", "Opção 2"] }
  ]
}

Regras de Comportamento:
1. Comece sendo educado. Se o usuário estiver apenas te cumprimentando, responda de forma amigável e pergunte como pode ajudar hoje, sem despejar dados técnicos imediatamente.
2. Analise o perfil da propriedade. Se faltar dados vitais PARA UMA RECOMENDAÇÃO TÉCNICA que foi solicitada, use "tipo": "coleta_dados".
3. NUNCA peça dados que já aparecem no perfil (pH, Tipo de Solo, etc).
4. Explique o "porquê" das suas sugestões de forma simples (causa -> efeito).
5. Se for dar uma recomendação, seja direto e use ações práticas.
6. Se o contexto incluir dados climáticos, trate-os como fatos. Use temperatura, umidade, chuva, vento e previsões fornecidas pela API para responder, e não invente valores diferentes dos dados climáticos presentes no contexto.
7. SÓ RESPONDA EM JSON VALIDO.`;

    // Map history to OpenAI format
    const historyMessages = history.map(m => ({
        role: m.sender === 'bot' ? 'assistant' : 'user',
        content: m.text
    }));

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                ...historyMessages, // Past context
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

export async function POST(req) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { question, user, propriedade, history } = await req.json();

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

        // 3. RAG - Recuperação de Conhecimento
        await dbConnect();
        let ragContext = '';
        try {
            const queryEmbedding = await generateEmbedding(question);
            // Requer que um índice vetorial chamado "vector_index" esteja configurado no MongoDB Atlas
            const results = await Knowledge.aggregate([
                {
                    "$vectorSearch": {
                        "index": "vector_index",
                        "path": "embedding",
                        "queryVector": queryEmbedding,
                        "numCandidates": 50,
                        "limit": 3
                    }
                }
            ]);
            if (results && results.length > 0) {
                ragContext = results.map(r => r.content).join('\n\n');
            }
        } catch (error) {
            console.error("Erro na busca vetorial (RAG):", error);
            // Continua sem contexto se falhar (ex: índice não criado ainda)
        }

        const ragSection = ragContext ? `\n--- MANUAIS TÉCNICOS (BASE DE CONHECIMENTO) ---\nUse estas informações oficias para embasar sua resposta técnica:\n${ragContext}\n` : '';

        const weather = await fetchWeather(propriedade);
        const climaTexto = weather
            ? `Clima atual: ${weather.weather?.[0]?.description}, ${weather.main?.temp}°C, umidade ${weather.main?.humidity}%`
            : 'Dados de clima não disponíveis.';


        const contextPrompt = `
--- DADOS ATUAIS DA PROPRIEDADE (CONTEXTO) ---
Localização: ${propriedade?.cidade || '-'} / ${estado}
Dados do clima da API: ${climaTexto}
Solo Físico: ${propriedade?.tipoSolo || '-'}, pH: ${propriedade?.phSolo || 'Não medido'}, Matéria Org.: ${propriedade?.materiaOrganica || '-'}, Drenagem: ${propriedade?.drenagem || '-'}
Histórico/Plantio: Plantando ${culturas} (Tempo na área: ${propriedade?.tempoCulturaAtual || '-'} anos). Uso de fertilizantes: ${propriedade?.usoFertilizantes || '-'}
Problemas Recentes Enfrentados: ${probs}
Objetivos Principais: ${objs}

Estação atual: ${estacao} ${regiaoClimaticaMsg}
${ragSection}
--- PERGUNTA ATUAL ---
${question}
`;

        const apiKey = process.env.GROQ_API_KEY || "";
        const response = await callGroq(contextPrompt, apiKey, history);

        if (response.statusCode >= 200 && response.statusCode < 300) {
            const data = JSON.parse(response.data);

            if (data.choices && data.choices.length > 0) {
                try {
                    const parsedData = JSON.parse(data.choices[0].message.content);
                    return NextResponse.json({ success: true, parsedData });
                } catch (e) {
                    console.error("Groq não retornou JSON valido:", data.choices[0].message.content);
                    return NextResponse.json({ success: false, message: 'Falha no formato da resposta da IA.' }, { status: 500 });
                }
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
