import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI client
// Make sure to handle the case where the API key might not be loaded yet in some contexts
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generates an embedding for a given text using Google's embedding model.
 * @param {string} text - The text to vectorize.
 * @returns {Promise<number[]>} - The vector representation of the text.
 */
export async function generateEmbedding(text) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    try {
        const result = await model.embedContent(text);
        const embedding = result.embedding;
        return embedding.values;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw error;
    }
}
