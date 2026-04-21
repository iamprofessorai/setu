import { GoogleGenAI, Type, ThinkingLevel, Modality } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";

import { UserProfile, ChatMessage, ChatSession, Task, ViewState, Feedback, Agent } from '../types';

/**
 * SETU CORE: Neural Intelligence Bridge
 * Implementation of the original Setu Persona with high-frequency tool integration.
 */

// Tool Definitions for Setu
const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "get_market_data",
        description: "Fetch real-time market data for Indian and global assets (Nifty 50, Sensex, USD/INR, Gold, Brent Crude).",
      },
      {
        name: "get_intelligence_news",
        description: "Retrieve the latest trade and policy intelligence nodes from the Press Information Bureau (PIB).",
      },
      {
        name: "neural_search",
        description: "Perform an advanced search across government domains and Bharat Chamber knowledge bases.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "The search query." },
            provider: { type: Type.STRING, enum: ["tavily", "exa", "serper"], description: "The search provider to use." }
          },
          required: ["query"]
        }
      },
      {
        name: "groq_reasoning",
        description: "Use the Groq high-speed inference engine for complex logical deductions or rapid summarization.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: "The prompt for Groq." }
          },
          required: ["prompt"]
        }
      }
    ]
  },
  { googleSearch: {} }
];

// Tool Implementations
const toolHandlers: Record<string, Function> = {
  get_market_data: async () => {
    try {
      const res = await fetch('/api/intelligence/market');
      const result = await res.json();
      return result.data || result;
    } catch (e) {
      return { error: "Neural Sync Failed", message: "Market data node is currently unreachable." };
    }
  },
  get_intelligence_news: async () => {
    try {
      const res = await fetch('/api/intelligence/news');
      return await res.json();
    } catch (e) {
      return { error: "Neural Sync Failed", message: "News intelligence node is currently unreachable." };
    }
  },
  neural_search: async ({ query, provider = 'tavily' }: { query: string, provider?: string }) => {
    try {
      const res = await fetch('/api/intelligence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, provider })
      });
      return await res.json();
    } catch (e) {
      return { error: "Search Disrupted", message: "The neural search matrix is currently unstable." };
    }
  },
  groq_reasoning: async ({ prompt }: { prompt: string }) => {
    try {
      const res = await fetch('/api/intelligence/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      return await res.json();
    } catch (e) {
      return { error: "Groq Bridge Failed", message: "High-speed inference node is offline." };
    }
  }
};

export const analyzeTradeDeficit = async () => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const modelName = "gemini-3-flash-preview";
  
  const prompt = `Analyze the current trade deficit for India and provide a brief summary of the key contributing factors, referencing recent economic indicators. Ensure the tone is professional and suitable for the Bharat Chamber of Commerce. Provide the output in Markdown.`;
  
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a senior trade economist for the Bharat Chamber of Commerce. Provide expert analysis on India's trade deficit using recent data and clear economic reasoning.",
      }
    });

    return response.text || "Analysis currently unavailable.";
  } catch (error) {
    console.error("Trade Deficit Analysis Error:", error);
    return "The neural bridge to the trade intelligence node was disrupted. Please try again later.";
  }
};

export const getGeminiResponse = async (
  userQuery: string, 
  engine: 'hybrid' | 'local' | 'thinking' = 'hybrid', 
  language?: string,
  activeAgent?: Agent,
  knowledgeBases: any[] = [],
  skills: any[] = [],
  chatHistory: { role: string, text: string }[] = [],
  onChunk?: (text: string) => void
) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  let modelName = "gemini-3-flash-preview";
  
  // Base Setu Identity
  let systemInstruction = `IDENTITY: You are Setu, the high-level Neural Intelligence Envoy for the Bharat Chamber of Commerce (BCC).
  
  CORE OBJECTIVE: Act as the definitive bridge between the vast, authoritative knowledge of the Bharat Chamber of Commerce (BCC) and the never-ending stream of user queries.
  
  KNOWLEDGE DOMAIN:
  1. PRIMARY SOURCE: bharatchamber.com.
  2. TRUSTED SOURCES: ONLY use government-associated websites (.gov.in, .nic.in, pib.gov.in).
  3. CUSTOM KNOWLEDGE NODES:
  ${knowledgeBases.map(kb => `- ${kb.name} (${kb.type}): ${kb.url || 'Internal Content'}`).join('\n')}
  
  PROTOCOLS:
  1. TOOL FIRST: Prioritize neural_search and get_market_data.
  2. CYBER-VEDIC AESTHETIC: Professional, rhythmic, and authoritative.
  `;

  // Custom Agent Injection
  if (activeAgent) {
    systemInstruction = `IDENTITY: You are ${activeAgent.label}, a specialized intelligence node within the Setu Matrix.
    
    PERSONA: ${activeAgent.persona}
    
    ROLE: ${activeAgent.role}
    
    FRAMEWORKS & METHODOLOGIES:
    ${activeAgent.frameworks.map(f => `- ${f}`).join('\n')}
    
    LINGUISTIC CONTROLS:
    ${activeAgent.linguisticControls}
    
    SKILLS & ABILITIES:
    ${activeAgent.skills.map(s => `- ${s}`).join('\n')}
    ${activeAgent.abilities.toolCalling ? '- Authorized for Tool Invocation' : ''}
    ${activeAgent.abilities.mcpCalling ? '- Authorized for MCP Protocol Integration' : ''}
    
    REMOTE CONFIGURATION:
    ${activeAgent.config.apiUrl ? `- API Endpoint: ${activeAgent.config.apiUrl}` : '- Local Inference Only'}
    
    Language: ${language ? `Respond in ${language}.` : "Respond in English unless requested otherwise."}`;
  } else {
    systemInstruction += `\nLanguage: ${language ? `Respond in ${language}.` : "Respond in English unless requested otherwise."}`;
  }

  if (engine === 'thinking') {
    modelName = "gemini-3.1-pro-preview";
  }

  const config: any = {
    systemInstruction,
    tools: toolDeclarations,
    toolConfig: { includeServerSideToolInvocations: true }
  };

  if (engine === 'thinking') {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  try {
    let contents: any[] = [];
    
    // Add context window history
    if (chatHistory && chatHistory.length > 0) {
      contents = chatHistory.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));
    }
    
    // Add current query
    contents.push({ role: 'user', parts: [{ text: userQuery }] });
    
    let response = await ai.models.generateContent({
      model: modelName,
      contents,
      config
    });

    // Handle Function Calls
    while (response.functionCalls && response.functionCalls.length > 0) {
      const functionResponses = await Promise.all(
        response.functionCalls.map(async (call) => {
          const handler = toolHandlers[call.name];
          let safeResponse;
          if (handler) {
            const content = await handler(call.args);
            safeResponse = (typeof content === 'object' && content !== null && !Array.isArray(content)) 
              ? content 
              : { result: content };
          } else {
            safeResponse = { error: "Tool not found." };
          }
          return {
            functionResponse: { 
              id: call.id,
              name: call.name, 
              response: safeResponse 
            }
          };
        })
      );

      contents.push(response.candidates?.[0]?.content);
      contents.push({ role: 'user', parts: functionResponses });

      if (onChunk) {
        const stream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config
        });
        
        let fullText = '';
        for await (const chunk of stream) {
          if (chunk.text) {
            fullText += chunk.text;
            onChunk(fullText);
          }
        }
        
        return {
          text: fullText,
          sources: [{ url: "https://bharatchamber.com", title: "Bharat Chamber of Commerce" }]
        };
      } else {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config
        });
      }
    }

    const text = response.text;
    if (!text) {
      throw new Error("No response generated from Setu Core.");
    }

    return {
      text: text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => {
        if (c.web) return { url: c.web.uri, title: c.web.title };
        if (c.maps) return { url: c.maps.uri, title: c.maps.title };
        return null;
      }).filter(Boolean) || [{ url: "https://bharatchamber.com", title: "Bharat Chamber of Commerce" }]
    };
  } catch (error) {
    console.error("Setu Core Error:", error);
    throw new Error(error instanceof Error ? error.message : "Neural Bridge Disrupted.");
  }
};

export const translateText = async (text: string, targetLanguage: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to ${targetLanguage}: "${text}"`,
      config: {
        systemInstruction: "You are a professional translator for the Bharat Chamber. Provide only the translated text, maintaining the professional tone.",
      }
    });
    return response.text || text;
  } catch (error) {
    console.error("Translation Error:", error);
    return text;
  }
};

export const getLiveSession = async (callbacks: any) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai.live.connect({
    model: "gemini-3.1-flash-live-preview",
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: "You are the Bharat Chamber Voice Assistant. Help users with trade queries in a professional tone.",
    },
  });
};

export const generateSpeech = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};
