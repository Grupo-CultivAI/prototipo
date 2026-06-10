const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '', { apiVersion: 'v1' });
    try {
        // There isn't a direct listModels in the standard SDK for browser/node simple usage usually
        // but we can try to use the REST API via fetch or see if it's available.
        // Actually, the error suggested calling ListModels.
        
        // Let's try to just check if 'text-embedding-004' works with 'v1'
        console.log("Trying gemini-1.5-flash content generation...");
        const flash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const flashRes = await flash.generateContent("hi");
        console.log("Success with gemini-1.5-flash:", flashRes.response.text());
    } catch (error) {
        console.error("Error with gemini-1.5-flash:", error.message);
    }
}

listModels();
