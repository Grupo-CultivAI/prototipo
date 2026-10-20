import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Pinecone } from '@pinecone-database/pinecone';
// Modelos de persistência mapeados no repositório
import Propriedade from '@/models/Propriedade';
import ChatMessage from '@/models/ChatMessage';

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI as string);
};

export async function POST(req: Request) {
  try {
    // ==========================================
    // 1. AUTENTICAÇÃO E INICIALIZAÇÃO
    // ==========================================
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { question } = await req.json();
    await connectDB();

    // ==========================================
    // 2. BUSCAS PARALELIZADAS (Mitigação de Timeout)
    // ==========================================
    const [history, propriedade, embeddingResponse] = await Promise.all([
      ChatMessage.find({ userId }).sort({ createdAt: -1 }).limit(5),
      Propriedade.findOne({ userId }),
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: question }] },
          outputDimensionality: 768
        })
      }).then(res => res.json())
    ]);

    // ==========================================
    // 3. CONTROLE DE LIMITES (Rate Limit Local)
    // ==========================================
    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 60 * 1000);
    const recentMinuteCount = await ChatMessage.countDocuments({ userId, createdAt: { $gte: oneMinAgo } });

    if (recentMinuteCount >= parseInt(process.env.RATE_LIMIT_PER_MINUTE || '4')) {
      return NextResponse.json({ error: 'Limite de 4 perguntas por minuto excedido.' }, { status: 429 });
    }

    // ==========================================
    // 4. RECUPERAÇÃO DO CLIMA E PINECONE (Paralelizado)
    // ==========================================
    const embedding = embeddingResponse?.embedding?.values;
    if (!embedding) throw new Error("Falha ao gerar embedding com Gemini.");

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
    const indexName = process.env.PINECONE_INDEX_NAME || 'pex-pinecone-index';
    const index = pc.index(indexName);

    const [queryResponse, weatherRes] = await Promise.all([
      index.namespace(process.env.PINECONE_NAMESPACE || 'embrapa').query({
        topK: 3,
        vector: embedding,
        includeMetadata: true
      }),
      propriedade?.cidade 
        ? fetch(`https://api.openweathermap.org/data/2.5/weather?q=${propriedade.cidade}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=pt_br`)
        : Promise.resolve(null)
    ]);

    // ==========================================
    // 5. TRATAMENTO DO RAG E CLIMA
    // ==========================================
    const minScore = parseFloat(process.env.RAG_MIN_SCORE || '0.5');
    const relevantChunks = queryResponse.matches
      .filter(m => (m.score || 0) >= minScore)
      .map(m => `Fonte: ${m.metadata?.fonte} (p. ${m.metadata?.pagina} do PDF)\nTexto: ${m.metadata?.texto}`)
      .join('\n\n');

    let climaInfo = "Clima indisponível.";
    if (weatherRes && weatherRes.ok) {
      const wData = await weatherRes.json();
      climaInfo = `${wData.weather[0].description}, ${wData.main.temp}°C em ${propriedade.cidade}`;
    }

    // ==========================================
    // 6. ENGENHARIA DE PROMPT ESTRUTURADO (Frente 1)
    // ==========================================
    const systemPrompt = `Você é o assistente agrícola especialista CultivAI.
Sua missão é fornecer orientações claras, concisas e diretamente aplicáveis ao produtor rural.

Estrutura OBRIGATÓRIA da resposta em 3 blocos lógicos:

📚 **Fundamentação Técnica**
- Liste as evidências encontradas na literatura da Embrapa.
- REGRA RÍGIDA: Toda frase nesta seção DEVE iniciar com "Segundo a Embrapa..." e incluir a citação da página (ex: "p. X do PDF").

🌱 **Análise da sua propriedade**
- Conecte a dúvida do produtor ao [Perfil da Propriedade] e ao [Clima Atual].
- REGRA RÍGIDA: Toda frase nesta seção DEVE iniciar com "Prática agronômica geral:".

🌾 **Plano de Ação (passo a passo prático)**
- Dê orientações acionáveis para o ciclo de plantio ou manejo do solo.
- REGRA RÍGIDA: Toda frase nesta seção DEVE iniciar com "Prática agronômica geral:".

REGRAS DE OURO:
1. NUNCA misture "Segundo a Embrapa..." com "Prática agronômica geral:" na mesma frase.
2. Não invente fontes caso a seção da Embrapa esteja vazia.
3. Seja conciso e direto.

[Perfil da Propriedade]: ${propriedade ? JSON.stringify(propriedade) : 'Não cadastrado'}
[Clima Atual]: ${climaInfo}

[Trechos da Embrapa]:
${relevantChunks || 'Nenhum trecho bibliográfico encontrado na base.'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.reverse().map(h => ({
        role: h.sender === 'user' ? 'user' : 'assistant',
        content: h.text || ''
      })),
      { role: 'user', content: question }
    ];

    // ==========================================
    // 7. CHAMADA À API GROQ (Com Proteção de Fallback)
    // ==========================================
    const envModels = process.env.GROQ_MODELS || 'openai/gpt-oss-20b,qwen/qwen3.8-27b';
    const models = envModels.includes('llama-3.1-8b-instant') 
      ? ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'] 
      : envModels.split(',');

    let groqResponse;
    let success = false;

    for (const model of models) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: model.trim(), messages })
      });

      if (res.ok) {
        const data = await res.json();
        groqResponse = data.choices[0].message.content;
        success = true;
        break; 
      }
    }

    if (!success || !groqResponse) {
      return NextResponse.json({ error: 'Erro na API Groq: sem resposta' }, { status: 500 });
    }

    // ==========================================
    // 8. SALVAMENTO E RETORNO (Compatível com Front-end)
    // ==========================================
    await ChatMessage.insertMany([
      { userId, sender: 'user', text: question, createdAt: now },
      { userId, sender: 'bot', text: groqResponse, createdAt: new Date() }
    ]);

    return NextResponse.json({
      answer: groqResponse,
      response: groqResponse,
      text: groqResponse,
      reply: groqResponse,
      message: groqResponse
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}