import { GoogleGenAI, Type } from "@google/genai";

/* =========================
   CONFIGURATION & CONSTANTS
   ========================= */

const API_KEY = process.env.API_KEY || '';

const MODEL_FLASH = 'gemini-3-flash-preview';
const MODEL_PRO = 'gemini-3-pro-preview';

const CACHE_TTL = 1000 * 60 * 60;
const MAX_CACHE_SIZE = 500;

const QUOTA_LIMIT = 100;

const MAX_CONTEXT_LENGTH = 5000;
const MAX_HISTORY_ITEMS = 20;

/* =========================
   FREE MODEL API REGISTRY
   ========================= */

type FreeModelProvider = {
  name: string;
  endpoint: string;
  apiKey?: string;
  model: string;
};

const FREE_MODEL_APIS: FreeModelProvider[] = [
  {
    name: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: "",
    model: "mistralai/mistral-7b-instruct",
  },
  {
    name: "together",
    endpoint: "https://api.together.xyz/v1/chat/completions",
    apiKey: "",
    model: "mistralai/Mistral-7B-Instruct-v0.1",
  },
  {
    name: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: "",
    model: "mixtral-8x7b-32768",
  },
];

/* =========================
   TYPES
   ========================= */

type ForensicCacheEntry = {
  text: string;
  sources: any[];
  timestamp: number;
};

type ChatHistoryItem = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

/* =========================
   CLIENT INITIALIZATION
   ========================= */

let aiClient: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: API_KEY });
  }
  return aiClient;
};

/* =========================
   ADVANCED CACHE SYSTEM
   ========================= */

class TTLCache<K, V extends { timestamp: number }> {
  private store = new Map<K, V>();

  constructor(private ttl: number, private maxSize: number) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.store.delete(key);
      return undefined;
    }

    return entry;
  }

  set(key: K, value: V) {
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, value);
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.store.delete(key);
      }
    }
  }

  size() {
    return this.store.size;
  }
}

const forensicCache = new TTLCache<string, ForensicCacheEntry>(CACHE_TTL, MAX_CACHE_SIZE);

/* =========================
   USAGE MONITORING
   ========================= */

let apiCallCount = 0;

export const getUsageStats = () => ({
  count: apiCallCount,
  limit: QUOTA_LIMIT,
  percentage: (apiCallCount / QUOTA_LIMIT) * 100,
});

/* =========================
   UTILITIES
   ========================= */

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const safeJSONParse = <T = any>(text: string): T => {
  try {
    return JSON.parse(text);
  } catch {
    return {} as T;
  }
};

const truncate = (text: string, length: number) =>
  text.length > length ? text.slice(0, length) : text;

const unique = <T>(arr: T[]) => Array.from(new Set(arr));

/* =========================
   EXPONENTIAL BACKOFF
   ========================= */

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 5,
  delayMs = 3000
): Promise<T> {
  try {
    apiCallCount++;
    return await fn();
  } catch (error: any) {
    const isRateLimit =
      error?.message?.includes('429') ||
      error?.status === 429 ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isRateLimit && retries > 0) {
      const jitter = delayMs * (0.5 + Math.random());
      await delay(jitter);
      return retryWithBackoff(fn, retries - 1, delayMs * 2);
    }

    throw error;
  }
}

/* =========================
   FREE MODEL FALLBACK
   ========================= */

async function callFreeModel(prompt: string): Promise<string> {
  for (const provider of FREE_MODEL_APIS) {
    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: "You are a highly technical intelligence analysis AI." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();

      const text =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "";

      if (text) return text;

    } catch {}
  }

  throw new Error("All free AI model providers failed.");
}

/* =========================
   DOCUMENT ANALYSIS
   ========================= */

export const analyzeDocument = async (text: string) => {
  return retryWithBackoff(async () => {
    const ai = getAIClient();

    const prompt = `Analyze the following document and provide a structured summary.
Crucially, for every technical permission mentioned, provide a detailed risk rationale explaining the threat vector it enables within this national security context.

Document:
${truncate(text, 20000)}
`;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyInsights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              threatLevel: {
                type: Type.STRING,
                description: "Assess as Low, Medium, High, or Critical",
              },
              permissions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    risk: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ["name", "description", "risk", "rationale"],
                },
              },
            },
            required: ["summary", "keyInsights", "threatLevel", "permissions"],
          },
        },
      });

      return safeJSONParse(response.text || "{}");
    } catch {
      const fallback = await callFreeModel(prompt);
      return safeJSONParse(fallback);
    }
  });
};

/* =========================
   CHAT WITH DOCUMENT
   ========================= */

export const chatWithDoc = async (
  history: ChatHistoryItem[],
  query: string,
  context: string
) => {
  return retryWithBackoff(async () => {
    const ai = getAIClient();

    const normalized = query.toLowerCase();

    const isSearchQuery =
      normalized.includes('search') ||
      normalized.includes('who is') ||
      normalized.includes('status of') ||
      normalized.includes('latest');

    const trimmedHistory = history.slice(-MAX_HISTORY_ITEMS);

    const parts = [
      {
        text: `System: You are the Sentient-X Intelligence Officer. Context: ${truncate(
          context,
          MAX_CONTEXT_LENGTH
        )}`,
      },
      ...trimmedHistory.map(h => ({
        text: `${h.role === 'user' ? 'Operator' : 'AI'}: ${h.parts[0]?.text || ''}`,
      })),
      { text: `Operator: ${query}` },
    ];

    try {
      const response = await ai.models.generateContent({
        model: isSearchQuery ? MODEL_PRO : MODEL_FLASH,
        contents: { parts },
        config: {
          tools: isSearchQuery ? [{ googleSearch: {} }] : undefined,
        },
      });

      let text = response.text || '';

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

      if (chunks) {
        const urls = unique(
          chunks.map((c: any) => c.web?.uri).filter((u: string) => Boolean(u))
        );

        if (urls.length) {
          text +=
            "\n\n**Sources Analyzed:**\n" +
            urls.map(u => `- [${u}](${u})`).join('\n');
        }
      }

      return text;

    } catch {
      const prompt = `${context}\n\nUser Question:\n${query}`;
      return callFreeModel(prompt);
    }
  });
};

/* =========================
   FORENSIC OSINT SCANNER
   ========================= */

export const performForensicScan = async (
  query: string,
  isDeepScan: boolean = false,
  previousContext?: string
) => {
  const cacheKey = `${query}-${isDeepScan}`;

  const cached = forensicCache.get(cacheKey);

  if (cached) {
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
${previousContext ? truncate(previousContext, 8000) : 'No previous data.'}

Format your response as highly technical, classified intelligence data.`;
    }

    try {
      const response = await ai.models.generateContent({
        model: isDeepScan ? MODEL_PRO : MODEL_FLASH,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const sources =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.map((c: any) => c.web)
          .filter((w: any) => w) || [];

      const result = {
        text: response.text || 'No data retrieved.',
        sources,
      };

      forensicCache.set(cacheKey, {
        ...result,
        timestamp: Date.now(),
      });

      return result;

    } catch {
      const fallback = await callFreeModel(prompt);

      const result = {
        text: fallback,
        sources: [],
      };

      forensicCache.set(cacheKey, {
        ...result,
        timestamp: Date.now(),
      });

      return result;
    }
  });
};
