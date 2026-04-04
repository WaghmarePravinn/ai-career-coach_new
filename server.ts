import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Pinecone Initialization
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "",
  });

  // OpenRouter Proxy Endpoint
  app.post("/api/ai/generate", async (req, res) => {
    const { prompt, systemInstruction, apiKey: userApiKey, model: userModel } = req.body;
    const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;
    const model = userModel || process.env.OPENROUTER_MODEL || "stepfun/step-3.5-flash:free";

    if (!apiKey) {
      return res.status(500).json({ error: "OpenRouter API key is not configured. Please add it in Settings." });
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "AI Career Coach",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemInstruction || "You are a helpful career coach." },
            { role: "user", content: prompt }
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || data.error || response.statusText || "Unknown OpenRouter error";
        throw new Error(`OpenRouter (${response.status}): ${errorMessage}`);
      }

      if (data.error) {
        const errorMessage = data.error.message || data.error || "OpenRouter API error";
        throw new Error(errorMessage);
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Unexpected OpenRouter response format:", data);
        throw new Error("Invalid response format from OpenRouter.");
      }

      res.json({ text: data.choices[0].message.content });
    } catch (error: any) {
      console.error("OpenRouter Error Details:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI response." });
    }
  });

  // Job Matching Endpoint (Pinecone + Gemini Embeddings)
  app.post("/api/ai/match-jobs", async (req, res) => {
    const { resumeText, preferences } = req.body;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeHost = process.env.PINECONE_HOST;
    const indexName = process.env.PINECONE_INDEX_NAME || "careerpath-ai";

    if (!pineconeApiKey || !pineconeHost) {
      return res.status(500).json({ 
        error: "Pinecone is not fully configured. Please add PINECONE_API_KEY and PINECONE_HOST in the Settings panel." 
      });
    }

    try {
      // 1. Generate Embeddings using Gemini
      let queryText = `Resume: ${resumeText}`;
      if (preferences) {
        const { location, salary, industry, experienceLevel, jobType } = preferences;
        if (location) queryText += `\nPreferred Location: ${location}`;
        if (salary) queryText += `\nSalary Expectation: ${salary}`;
        if (industry) queryText += `\nTarget Industry: ${industry}`;
        if (experienceLevel) queryText += `\nExperience Level: ${experienceLevel}`;
        if (jobType) queryText += `\nJob Type: ${jobType}`;
      }

      const result = await genAI.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [queryText],
      });
      const embedding = result.embeddings[0].values;

      // 2. Query Pinecone
      // Re-initialize Pinecone client with the current API key to be safe
      const pineconeClient = new Pinecone({ apiKey: pineconeApiKey });
      const index = pineconeClient.index(indexName, pineconeHost);
      
      const queryResponse = await index.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      });

      res.json({ matches: queryResponse.matches });
    } catch (error: any) {
      console.error("Pinecone Match Error:", error);
      res.status(500).json({ error: error.message || "Failed to match jobs." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
