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
  allowedOrigins: string[]; // CORS 允许的来源列表
  rateLimitMax: number; // 速率限制：最大请求数
  rateLimitTimeWindow: number; // 速率限制：时间窗口（秒）
};

function requireEnv(key: keyof NodeJS.ProcessEnv): string {
  const raw = process.env[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${key} 必须配置`);
  }
  return raw.trim();
}

export function loadConfig(): LocalAIConfig {
  const {
    PORT,
    HOST,
    SERVICE_TOKENS,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    NODE_ENV,
    npm_package_version,
    ALLOWED_ORIGINS,
    RATE_LIMIT_MAX,
    RATE_LIMIT_TIME_WINDOW,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL 和 SUPABASE_SERVICE_KEY 必须配置");
  }

  // 解析允许的 CORS 来源
  const allowedOrigins = ALLOWED_ORIGINS
    ? ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : []; // 如果未设置，默认空数组（将使用函数判断）

  // 速率限制配置
  const rateLimitMax = Number(RATE_LIMIT_MAX || 60);
  const rateLimitTimeWindow = Number(RATE_LIMIT_TIME_WINDOW || 60);

  return {
    port: Number(PORT || 8788),
    host: HOST || "0.0.0.0",
    serviceTokens: new Set(
      (SERVICE_TOKENS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
    ollamaBaseUrl: requireEnv("OLLAMA_BASE_URL"),
    aiModel: requireEnv("AI_MODEL"),
    embeddingModel: requireEnv("EMBEDDING_MODEL"),
    supabaseUrl: SUPABASE_URL,
    supabaseServiceKey: SUPABASE_SERVICE_KEY,
    nodeEnv: NODE_ENV || "development",
    version: npm_package_version || "0.0.0",
    allowedOrigins,
    rateLimitMax,
    rateLimitTimeWindow,
  };
}

