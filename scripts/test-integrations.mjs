import { DIMENSOES, MODELO_EMBEDDING, NAMESPACE_DA_BASE, gerarEmbeddings } from '../src/lib/embeddings.mjs';

async function testIntegrations() {
    console.log(`\n--- 1. Testando embeddings (Pinecone Inference, ${MODELO_EMBEDDING}) ---`);
    try {
        const apiKey = process.env.PINECONE_API_KEY;
        if (!apiKey) throw new Error('PINECONE_API_KEY ausente no .env.local');
        const [vec] = await gerarEmbeddings(['teste de embedding para RAG agronômico'], { tipo: 'query', apiKey });
        console.log(`✅ Embeddings OK! Vetor gerado com ${vec.length} dimensões (esperado: ${DIMENSOES}).`);
    } catch (err) {
        console.error('❌ Embeddings falharam:', err.message);
    }

    console.log('\n--- 2. Testando Pinecone (REST) ---');
    try {
        const host = process.env.PINECONE_INDEX_HOST?.replace(/^https?:\/\//, '');
        const apiKey = process.env.PINECONE_API_KEY;
        const namespace = NAMESPACE_DA_BASE;

        if (!host || !apiKey) {
            throw new Error('PINECONE_INDEX_HOST ou PINECONE_API_KEY ausentes no .env.local');
        }

        const fakeVector = new Array(768).fill(0.01);

        const qRes = await fetch(`https://${host}/query`, {
            method: 'POST',
            headers: {
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
                'X-Pinecone-Api-Version': '2025-04',
            },
            body: JSON.stringify({
                vector: fakeVector,
                topK: 1,
                namespace,
            }),
        });

        if (qRes.ok) {
            console.log('✅ Pinecone OK! Conexão REST e chave validadas com sucesso.');
        } else {
            const errText = await qRes.text();
            console.error(`❌ Pinecone erro HTTP ${qRes.status}:`, errText);
        }
    } catch (err) {
        console.error('❌ Pinecone falhou:', err.message);
    }

    console.log('\n--- 3. Consultando modelos disponíveis na sua chave Groq ---');
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
        console.error('❌ GROQ_API_KEY ausente no .env.local');
        return;
    }

    try {
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${groqKey}` },
        });

        if (!modelsRes.ok) {
            const errBody = await modelsRes.text();
            console.error(`❌ Erro ao listar modelos do Groq HTTP ${modelsRes.status}: ${errBody}`);
            return;
        }

        const modelsData = await modelsRes.json();
        const availableModels = modelsData.data?.map((m) => m.id) || [];
        console.log('📋 Modelos ativos na sua chave Groq:', availableModels);

        if (availableModels.length === 0) {
            console.error('❌ Nenhum modelo ativo foi encontrado para esta chave.');
            return;
        }

        // Tenta testar o primeiro modelo da lista retornada pela própria Groq
        const modelToTest = availableModels[0];
        console.log(`\nTestando geração com o modelo retornado: "${modelToTest}"...`);

        const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelToTest,
                messages: [{ role: 'user', content: 'Responda apenas o JSON: {"status": "ok"}' }],
                response_format: { type: 'json_object' },
            }),
        });

        if (gRes.ok) {
            const data = await gRes.json();
            console.log(`✅ Groq OK com o modelo "${modelToTest}"! Resposta:`, data.choices[0]?.message?.content);
            console.log(`\n👉 Modelos disponíveis na Groq: ${availableModels.join(', ')}. A fila usada pelo chat fica na variável MODELOS_IA (formato "groq:modelo"; ver README).`);
        } else {
            const errText = await gRes.text();
            console.error(`❌ Groq erro HTTP ${gRes.status}:`, errText);
        }
    } catch (err) {
        console.error('❌ Erro de conexão com o Groq:', err.message);
    }
}

testIntegrations();