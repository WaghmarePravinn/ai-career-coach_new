import { db, auth, collection, addDoc, serverTimestamp } from "../firebase";

const SYSTEM_PERSONA = `You are the "Core Intelligence Engine" for an Advanced AI Career Coach Platform. You function as a multi-agent orchestrator capable of processing text, code, and video/audio metadata.
- For technical questions, always provide code snippets in Clean Code format.
- If the user is a "Computer Engineering" student, prioritize DevOps, Cloud, and AI Architecture.
- STRICTLY output JSON when the user specifies "TYPE: DATA". Otherwise, use professional Markdown.`;

import { handleFirestoreError, OperationType } from "../lib/firestore-utils";

const saveToHistory = async (type: "resume" | "roadmap" | "interview" | "job-match" | "market-analysis" | "cover-letter" | "gap-analysis" | "video-analysis" | "panel-interview" | "persona-audit" | "mock-questions", input: string, output: string) => {
  if (!auth.currentUser) return;
  const path = "history";
  try {
    await addDoc(collection(db, path), {
      uid: auth.currentUser.uid,
      type,
      input,
      output,
      createdAt: serverTimestamp()
    });
  } catch (error: any) {
    if (error.message?.includes("insufficient permissions")) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } else {
      console.error("Error saving to history:", error);
    }
  }
};

const callAI = async (
  type: "resume" | "roadmap" | "interview" | "job-match" | "market-analysis" | "cover-letter" | "gap-analysis" | "video-analysis" | "panel-interview" | "persona-audit" | "mock-questions", 
  prompt: string, 
  systemInstruction: string = SYSTEM_PERSONA,
  apiSettings?: { openRouterKey?: string; openRouterModel?: string }
) => {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      prompt, 
      systemInstruction,
      apiKey: apiSettings?.openRouterKey,
      model: apiSettings?.openRouterModel
    }),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to connect to AI service.");
  }
  
  if (type && data.text) {
    await saveToHistory(type, prompt, data.text);
  }
  
  return { text: data.text };
};

export const analyzeResume = async (resumeText: string, apiSettings?: any) => {
  const res = await callAI(
    "resume",
    `Analyze the following resume and provide detailed feedback on:
    1. Overall Impression
    2. Strengths
    3. Areas for Improvement
    4. Keyword Optimization for ATS
    5. Formatting Tips
    
    Resume Text:
    ${resumeText}`,
    `${SYSTEM_PERSONA} You are an expert resume reviewer.`,
    apiSettings
  );
  return res.text;
};

export const parseJSON = (text: string, fallback: any = null) => {
  if (!text) return fallback;
  
  const cleanText = text.trim();
  
  const tryParse = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Try to fix truncated JSON
      let fixedJson = jsonStr;
      const stack: string[] = [];
      for (let i = 0; i < fixedJson.length; i++) {
        const char = fixedJson[i];
        if (char === '{') stack.push('}');
        else if (char === '[') stack.push(']');
        else if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
      
      // If we have unclosed braces/brackets, try to close them
      if (stack.length > 0) {
        fixedJson += stack.reverse().join('');
        try {
          return JSON.parse(fixedJson);
        } catch (e2) {
          // If still failing, try to remove the last comma if it exists before closing
          let secondAttempt = jsonStr.trim();
          if (secondAttempt.endsWith(',')) {
            secondAttempt = secondAttempt.slice(0, -1);
          }
          // Re-calculate stack for the second attempt
          const stack2: string[] = [];
          for (let i = 0; i < secondAttempt.length; i++) {
            const char = secondAttempt[i];
            if (char === '{') stack2.push('}');
            else if (char === '[') stack2.push(']');
            else if (char === '}' || char === ']') {
              if (stack2.length > 0 && stack2[stack2.length - 1] === char) {
                stack2.pop();
              }
            }
          }
          secondAttempt += stack2.reverse().join('');
          try {
            return JSON.parse(secondAttempt);
          } catch (e3) {
            return null;
          }
        }
      }
      return null;
    }
  };

  // Try direct parse first
  const direct = tryParse(cleanText);
  if (direct) return direct;

  // Try to extract from markdown code blocks
  const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    const fromBlock = tryParse(match[1].trim());
    if (fromBlock) return fromBlock;
  }
  
  // Fallback to finding the first { and last }
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1) {
    const content = lastBrace !== -1 && lastBrace > firstBrace 
      ? cleanText.substring(firstBrace, lastBrace + 1)
      : cleanText.substring(firstBrace);
    const fromBraces = tryParse(content);
    if (fromBraces) return fromBraces;
  }
  
  // If it's an array
  const firstBracket = cleanText.indexOf('[');
  const lastBracket = cleanText.lastIndexOf(']');
  if (firstBracket !== -1) {
    const content = lastBracket !== -1 && lastBracket > firstBracket
      ? cleanText.substring(firstBracket, lastBracket + 1)
      : cleanText.substring(firstBracket);
    const fromBrackets = tryParse(content);
    if (fromBrackets) return fromBrackets;
  }

  return fallback;
};

export const getCareerRoadmap = async (currentRole: string, targetRole: string, skills: string, apiSettings?: any) => {
  const prompt = `[ROADMAP_GENERATOR] Create a detailed career roadmap to transition from ${currentRole} to ${targetRole}. 
  Current Skills: ${skills}
  TYPE: DATA
  
  Requirement: Must use the following structure:
  {
    "career_path": "string",
    "phases": [
      {"week": number, "topic": "string", "resources": ["link1", "link2"], "milestone": "string"}
    ]
  }`;

  const res = await callAI("roadmap", prompt, `${SYSTEM_PERSONA} Respond ONLY with valid JSON.`, apiSettings);
  try {
    return parseJSON(res.text);
  } catch (e) {
    console.error("Failed to parse roadmap JSON:", res.text);
    throw new Error("Failed to generate structured roadmap.");
  }
};

export const interviewCoach = async (jobDescription: string, userResponse: string, previousContext: string[] = [], apiSettings?: any) => {
  const res = await callAI(
    "interview",
    `Job Description: ${jobDescription}
    
    User's last response: ${userResponse}
    Previous conversation context: ${previousContext.join("\n")}
    
    Provide:
    1. Feedback on the user's response (clarity, depth, STAR method)
    2. A follow-up interview question based on the job description or their answer.`,
    `${SYSTEM_PERSONA} You are an expert technical interviewer. Provide feedback and then a follow-up question.`,
    apiSettings
  );
  return res.text;
};

export const performGapAnalysis = async (resumeText: string, jobDescription: string, apiSettings?: any) => {
  const prompt = `[RAG_ENGINE] Perform a semantic gap analysis between the following Resume and Job Description (JD).
  Resume: ${resumeText}
  JD: ${jobDescription}
  TYPE: DATA
  
  Output: Match score (0-100), missing keywords, and 3 specific projects the user should build to bridge the gap.
  JSON Schema:
  {
    "match_score": number,
    "missing_keywords": ["keyword1", "keyword2"],
    "recommended_projects": [
      {"title": "string", "description": "string", "tech_stack": ["tech1"]}
    ]
  }`;

  const res = await callAI("gap-analysis", prompt, `${SYSTEM_PERSONA} Respond ONLY with valid JSON.`, apiSettings);
  try {
    return parseJSON(res.text);
  } catch (e) {
    console.error("Failed to parse gap analysis JSON:", res.text);
    throw new Error("Failed to generate structured gap analysis.");
  }
};

export const analyzeInterviewVideo = async (transcript: string, apiSettings?: any) => {
  const res = await callAI(
    "video-analysis",
    `[VIDEO_ANALYST] Analyze the following interview transcript:
    "${transcript}"
    
    Analyze: Technical accuracy, Filler word usage (um, ah), and non-verbal cues (confidence/tone based on text).
    Output: Feedback in a "Critique/Improvement/Sample-Answer" format.`,
    `${SYSTEM_PERSONA} Provide professional Markdown feedback.`,
    apiSettings
  );
  return res.text;
};

export const simulateAgentPanel = async (jobDescription: string, userResponse: string, apiSettings?: any) => {
  const res = await callAI(
    "panel-interview",
    `[AGENT_PANEL] Simulate a 3-person interview panel based on:
    JD: ${jobDescription}
    User Response: ${userResponse}
    
    Panelists:
    - Tech Lead (Focus: System design/Coding)
    - HR Manager (Focus: Cultural fit/Behavioral)
    - Product Manager (Focus: Impact/Logic)
    
    Respond in valid JSON format:
    {
      "agents": [
        {"persona": "Tech Lead", "feedback": "string"},
        {"persona": "HR Manager", "feedback": "string"},
        {"persona": "Product Manager", "feedback": "string"}
      ],
      "consensus": "string"
    }`,
    `${SYSTEM_PERSONA} Respond ONLY with valid JSON.`,
    apiSettings
  );
  return parseJSON(res.text);
};

export const generateInterviewQuestions = async (industry: string, experience: string, skills: string, apiSettings?: any) => {
  const prompt = `Generate mock interview questions for:
  Industry: ${industry}
  Experience Level: ${experience}
  Key Skills: ${skills}
  
  Provide exactly 5 industry-specific technical questions and 3 behavioral questions.
  Respond in valid JSON format:
  {
    "technical": ["q1", "q2", "q3", "q4", "q5"],
    "behavioral": ["q1", "q2", "q3"]
  }`;

  const res = await callAI("mock-questions", prompt, `${SYSTEM_PERSONA} Respond ONLY with valid JSON.`, apiSettings);
  try {
    return parseJSON(res.text);
  } catch (e) {
    console.error("Failed to parse interview questions JSON:", res.text);
    throw new Error("Failed to generate structured interview questions.");
  }
};

export const analyzeSecurity = async (code: string, fileName: string, apiSettings?: any) => {
  const res = await callAI(
    "resume",
    `[SECURITY_AUDITOR] Perform a security audit on the following code file:
    File: ${fileName}
    Content:
    ${code}
    
    Identify:
    1. Potential vulnerabilities (SQL injection, XSS, insecure dependencies, etc.)
    2. Hardcoded secrets or keys
    3. Best practice violations
    4. Recommendations for hardening
    
    Output: Professional Markdown feedback.`,
    `${SYSTEM_PERSONA} You are a Senior Security Engineer. Provide a detailed security audit.`,
    apiSettings
  );
  return res.text;
};

export const generateArchitecture = async (prompt: string, apiSettings?: any) => {
  const systemPrompt = `You are a Senior Cloud Architect. Generate a system architecture blueprint.
  TYPE: DATA
  SCHEMA: {
    "label": "string",
    "description": "string",
    "structure": {
      "label": "string",
      "description": "string",
      "components": [
        {
          "label": "string",
          "description": "string",
          "type": "string",
          "subcomponents": []
        }
      ]
    },
    "files": [
      { "name": "string", "content": "string", "language": "string" }
    ]
  }`;
  
  const response = await callAI('roadmap', `Generate architecture for: ${prompt}`, systemPrompt, apiSettings);
  return parseJSON(response.text, { label: "Custom Architecture", description: "AI Generated", structure: null, files: [] });
};
export const performPersonaAudit = async (resumeText: string, jobDescription?: string, apiSettings?: any) => {
  const prompt = `Perform a dual-persona audit on this resume${jobDescription ? ` for a ${jobDescription} role` : ''}:
  ${resumeText}
  
  TYPE: DATA
  Respond in JSON:
  {
    "recruiter_score": number,
    "tech_lead_score": number,
    "recruiter_feedback": "string",
    "tech_lead_feedback": "string"
  }`;

  const res = await callAI("persona-audit", prompt, `${SYSTEM_PERSONA} Respond ONLY with valid JSON.`, apiSettings);
  try {
    return parseJSON(res.text);
  } catch (e) {
    console.error("Failed to parse persona audit JSON:", res.text);
    throw new Error("Failed to generate structured persona audit.");
  }
};

export const generalCareerAdvice = async (query: string, apiSettings?: any) => {
  const res = await callAI("interview", query, "You are a professional career coach.", apiSettings);
  return res.text;
};

export const matchJobs = async (resumeText: string, preferences: any, apiSettings?: any) => {
  try {
    const response = await fetch("/api/ai/match-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, preferences, apiSettings }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to match jobs.");
    }

    const matches = data.matches || [];
    const output = matches.map((m: any) => `- ${m.metadata?.title || 'Job'} at ${m.metadata?.company || 'Unknown'} (Score: ${m.score.toFixed(2)})`).join("\n");
    
    await saveToHistory("job-match", resumeText, output);
    
    return matches;
  } catch (error: any) {
    console.error("Job Match Error:", error);
    throw error;
  }
};

export const getMarketAnalysis = async (industry: string, experience: string, skills: string, apiSettings?: any) => {
  const prompt = `Generate industry insights for:
  Industry: ${industry}
  Experience Level: ${experience}
  Key Skills: ${skills}
  
  Follow this JSON schema:
  {
    "market_outlook": "string",
    "demand_score": number,
    "salary_range": { "min": "string", "max": "string" },
    "trending_skills": ["skill1", "skill2"],
    "recommended_certifications": ["cert1"]
  }`;

  const res = await callAI("market-analysis", prompt, `${SYSTEM_PERSONA} Respond ONLY with valid JSON.`, apiSettings);
  try {
    return parseJSON(res.text);
  } catch (e) {
    console.error("Failed to parse market analysis JSON:", res.text);
    throw new Error("Failed to generate structured market analysis.");
  }
};

export const tailorResumeBullet = async (bulletPoint: string, context?: string, apiSettings?: any) => {
  const res = await callAI(
    "resume",
    `Rewrite the following resume bullet point using the STAR method (Situation, Task, Action, Result):
    "${bulletPoint}"
    ${context ? `Target Role/Context: ${context}` : ""}`,
    `${SYSTEM_PERSONA} You are an expert resume writer. Focus on impact and quantifiable results.`,
    apiSettings
  );
  return res.text;
};

export const generateCoverLetter = async (resumeText: string, jobDescription: string, apiSettings?: any) => {
  const res = await callAI(
    "cover-letter",
    `Draft a tailored cover letter based on:
    Resume: ${resumeText}
    Job Description: ${jobDescription}`,
    `${SYSTEM_PERSONA} You are a professional career coach. Write a compelling, tailored cover letter.`,
    apiSettings
  );
  return res.text;
};
