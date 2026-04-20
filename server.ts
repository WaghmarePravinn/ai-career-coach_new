import express from "express";
import path from "path";
import dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "");

const app = express();
const PORT = 3000;

app.use(express.json());

// Pinecone Initialization
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

// OpenRouter Proxy Endpoint with Gemini Fallback
app.post("/api/ai/generate", async (req, res) => {
    const { prompt, systemInstruction, apiKey: userApiKey, model: userModel } = req.body;
    const openRouterApiKey = userApiKey || process.env.OPENROUTER_API_KEY;
    const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    // Try OpenRouter first if API key is available
    if (openRouterApiKey) {
      try {
        const model = userModel || process.env.OPENROUTER_MODEL || "stepfun/step-3.5-flash:free";
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
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
            max_tokens: 4000,
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

        return res.json({ text: data.choices[0].message.content });
      } catch (error: any) {
        console.warn("OpenRouter failed, falling back to Gemini:", error.message);
        // Fall through to Gemini if OpenRouter fails
      }
    }

    // Fallback to Google Gemini
    if (!geminiApiKey) {
      return res.status(500).json({
        error: "No AI service configured. Please add OPENROUTER_API_KEY or GOOGLE_API_KEY in environment variables."
      });
    }

    try {
      const fullPrompt = systemInstruction
        ? `${systemInstruction}\n\nUser: ${prompt}`
        : prompt;

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      res.json({ text: text });
    } catch (error: any) {
      console.error("Gemini Error Details:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI response with Gemini." });
    }
  });

  // Job Matching Endpoint (Pinecone + Gemini Embeddings)
  app.post("/api/ai/match-jobs", async (req, res) => {
    const { resumeText, preferences } = req.body;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeHost = process.env.PINECONE_HOST;
    const indexName = process.env.PINECONE_INDEX_NAME || "careerpath-ai";
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!pineconeApiKey || !pineconeHost) {
      return res.status(500).json({ 
        error: "Pinecone is not fully configured. Please add PINECONE_API_KEY and PINECONE_HOST in the Settings panel." 
      });
    }

    if (!geminiApiKey) {
      return res.status(500).json({ 
        error: "Google AI API key is not configured. Please add GEMINI_API_KEY or GOOGLE_API_KEY in environment variables." 
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

      // Generate embeddings using Google AI API directly
      const embeddingResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: queryText }],
          },
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`Embedding API error: ${embeddingResponse.statusText}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.embedding.values;

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
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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
}

setupVite();

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
