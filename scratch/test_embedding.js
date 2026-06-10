const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function testEmbedding() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    try {
        console.log("Trying gemini-flash-latest...");
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent("Oi");
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.error("Error with gemini-flash-latest:", error.message);
    }
}

testEmbedding();
