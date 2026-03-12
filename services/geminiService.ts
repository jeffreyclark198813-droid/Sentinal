
import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Advanced caching with TTL
const forensicCache = new Map<string, {text: string, sources: any[], timestamp: number}>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Usage tracking
let apiCallCount = 0;
const QUOTA_LIMIT = 100; // Example threshold

export const getUsageStats = () => ({
  count: apiCallCount,
  limit: QUOTA_LIMIT,
  percentage: (apiCallCount / QUOTA_LIMIT) * 100
});

/**
 * Advanced exponential backoff with jitter
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> {
  try {
    apiCallCount++;
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit && retries > 0) {
      // Add jitter: random delay between 0.5x and 1.5x of the delay
      const jitter = delay * (0.5 + Math.random());
      console.warn(`Rate limit hit. Retrying in ${Math.floor(jitter)}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, jitter));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const analyzeDocument = async (text: string) => {
  return retryWithBackoff(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following document and provide a structured summary. 
      Crucially, for every technical permission mentioned, provide a detailed risk rationale explaining the threat vector it enables within this national security context.
      
      Document:
      ${text}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyInsights: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            threatLevel: { 
              type: Type.STRING, 
              description: "Assess as Low, Medium, High, or Critical" 
            },
            permissions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  risk: { type: Type.STRING },
                  rationale: { type: Type.STRING }
                },
                required: ["name", "description", "risk", "rationale"]
              }
            }
          },
          required: ["summary", "keyInsights", "threatLevel", "permissions"]
        }
      }
    });

    const textOut = response.text || '{}';
    return JSON.parse(textOut);
  });
};

export const chatWithDoc = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], query: string, context: string) => {
  return retryWithBackoff(async () => {
    const ai = getAIClient();
    const isSearchQuery = query.toLowerCase().includes('search') || query.toLowerCase().includes('who is') || query.toLowerCase().includes('status of') || query.toLowerCase().includes('latest');
    
    const response = await ai.models.generateContent({
      model: isSearchQuery ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: `System: You are the Sentient-X Intelligence Officer. Context: ${context.slice(0, 5000)}` },
          ...history.map(h => ({ text: `${h.role === 'user' ? 'Operator' : 'AI'}: ${h.parts[0].text}` })),
          { text: `Operator: ${query}` }
        ]
      },
      config: {
        tools: isSearchQuery ? [{ googleSearch: {} }] : undefined,
      },
    });

    let text = response.text || '';
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      const urls = chunks.map((c: any) => c.web?.uri).filter((u: string) => u);
      if (urls.length > 0) {
        text += "\n\n**Sources Analyzed:**\n" + Array.from(new Set(urls)).map((u: string) => `- [${u}](${u})`).join('\n');
      }
    }
    return text;
  });
};

export const performForensicScan = async (query: string, isDeepScan: boolean = false, previousContext?: string) => {
  const cacheKey = `${query}-${isDeepScan}`;
  const cached = forensicCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return { text: cached.text, sources: cached.sources };
  }

  return retryWithBackoff(async () => {
    const ai = getAIClient();
    
    let prompt = `Perform a forensic OSINT analysis on the following target/query: "${query}". 
      Investigate potential links to .mil, .gov, or infrastructure patterns. 
      Format your response as highly technical intelligence data.`;

    if (isDeepScan) {
      prompt = `Perform an exhaustive, multi-layered deep forensic OSINT analysis on the target/query: "${query}".
      Penetrate additional strata of data to uncover hidden connections, dark web footprints, and advanced persistent threat (APT) indicators.
      Incorporate and augment the following previously acquired data:
      ${previousContext ? previousContext : 'No previous data.'}
      Format your response as highly technical, classified intelligence data.`;
    }

    const response = await ai.models.generateContent({
      model: isDeepScan ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    
    const result = {
      text: response.text || 'No data retrieved.',
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web).filter((w: any) => w) || []
    };
    
    forensicCache.set(cacheKey, { ...result, timestamp: Date.now() });
    return result;
  });
};
