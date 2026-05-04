import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Setup Mongoose Schema locally for the script
const KnowledgeSchema = new mongoose.Schema({
    content: String,
    metadata: {
        source: String,
        category: String
    },
    embedding: [Number]
});
const Knowledge = mongoose.models.Knowledge || mongoose.model('Knowledge', KnowledgeSchema);

// Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateEmbedding(text) {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

// Simulated documents. In a real scenario, you'd read from PDFs or txt files.
const mockDocuments = [
    {
        content: "O plantio de milho deve ser realizado preferencialmente no início da estação das chuvas (verão). O espaçamento ideal é de 45 a 50 cm entre linhas, utilizando sementes tratadas para evitar o ataque inicial de pragas do solo.",
        metadata: { source: "Guia de Plantio de Milho - EMBRAPA", category: "Cultivo" }
    },
    {
        content: "Para combater a lagarta do cartucho, recomenda-se o manejo integrado de pragas. A aplicação de bioinseticidas à base de Bacillus thuringiensis (Bt) é altamente eficaz e preserva os inimigos naturais da praga. A pulverização deve ocorrer quando as lagartas ainda são pequenas.",
        metadata: { source: "Manejo de Pragas 2023", category: "Defensivos" }
    },
    {
        content: "Em solos com pH abaixo de 5.5, é essencial realizar a calagem para corrigir a acidez e neutralizar o alumínio tóxico. A aplicação do calcário deve ser feita a lanço e incorporada ao solo com antecedência mínima de 60 dias do plantio.",
        metadata: { source: "Manual de Correção de Solo", category: "Solo" }
    }
];

async function runIngestion() {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado!');

    console.log('Iniciando vetorização e ingestão...');
    for (const doc of mockDocuments) {
        console.log(`Gerando embedding para: "${doc.content.substring(0, 30)}..."`);
        const vector = await generateEmbedding(doc.content);
        
        await Knowledge.create({
            content: doc.content,
            metadata: doc.metadata,
            embedding: vector
        });
        console.log('✅ Salvo no banco com sucesso.');
    }

    console.log('\nIngestão concluída! Certifique-se de ter criado o índice "vector_index" no MongoDB Atlas.');
    await mongoose.disconnect();
}

runIngestion().catch(console.error);
