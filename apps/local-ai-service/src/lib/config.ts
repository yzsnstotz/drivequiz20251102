import dotenv from "dotenv";

// 优先加载 .env.local，然后加载 .env
dotenv.config({ path: ".env.local" });
dotenv.config(); // 加载 .env 作为后备

export type LocalAIConfig = {
  port: number;
  host: string;
  serviceTokens: Set<string>;
  ollamaBaseUrl: string;
  aiModel: string;
  embeddingModel: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  nodeEnv: string;
  version: string;
};

export function loadConfig(): LocalAIConfig {
  const {
    PORT,
    HOST,
    SERVICE_TOKENS,
    OLLAMA_BASE_URL,
    AI_MODEL,
    EMBEDDING_MODEL,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    NODE_ENV,
    npm_package_version,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL 和 SUPABASE_SERVICE_KEY 必须配置");
  }

  return {
    port: Number(PORT || 8788),
    host: HOST || "0.0.0.0",
    serviceTokens: new Set(
      (SERVICE_TOKENS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
    ollamaBaseUrl: OLLAMA_BASE_URL || "http://localhost:11434/v1",
    aiModel: AI_MODEL || "llama3.2:3b",
    embeddingModel: EMBEDDING_MODEL || "nomic-embed-text",
    supabaseUrl: SUPABASE_URL,
    supabaseServiceKey: SUPABASE_SERVICE_KEY,
    nodeEnv: NODE_ENV || "development",
    version: npm_package_version || "0.0.0",
  };
}

