/**
 * Ollama 客户端封装
 * 提供统一的 Ollama API 调用接口
 */

function requireEnv(key: string): string {
  const raw = process.env[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${key} is not set. Please configure ${key} in the environment.`);
  }
  return raw.trim();
}

const OLLAMA_BASE_URL = requireEnv("OLLAMA_BASE_URL");
const AI_MODEL = requireEnv("AI_MODEL");
const EMBEDDING_MODEL = requireEnv("EMBEDDING_MODEL");
// 超时配置：Ollama 生成可能需要较长时间，特别是处理长对话历史时
const OLLAMA_CHAT_TIMEOUT_MS = Number(process.env.OLLAMA_CHAT_TIMEOUT_MS || 90_000); // 90秒
const OLLAMA_EMBEDDING_TIMEOUT_MS = Number(process.env.OLLAMA_EMBEDDING_TIMEOUT_MS || 30_000); // 30秒

/**
 * 调用 Ollama Chat API
 */
export async function callOllamaChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  temperature = 0.4
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, OLLAMA_CHAT_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Ollama Chat API 调用失败: ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama Chat API 超时 (${OLLAMA_CHAT_TIMEOUT_MS / 1000}秒)`);
    }
    throw error;
  }
}

/**
 * 调用 Ollama Embedding API
 */
export async function callOllamaEmbedding(text: string): Promise<number[]> {
  // Ollama Embedding API 使用 input 参数（OpenAI 兼容格式）
  // 如果使用 /v1/embeddings 端点，使用 input 参数
  // 如果使用 /api/embeddings 端点，使用 prompt 参数
  const isV1Endpoint = OLLAMA_BASE_URL.includes("/v1");
  const endpoint = isV1Endpoint ? `${OLLAMA_BASE_URL}/embeddings` : `${OLLAMA_BASE_URL.replace(/\/v1$/, "")}/api/embeddings`;
  const paramName = isV1Endpoint ? "input" : "prompt";
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, OLLAMA_EMBEDDING_TIMEOUT_MS);
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        [paramName]: text.slice(0, 3000), // 限制长度
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Ollama Embedding API 调用失败: ${error}`);
    }

    const data = (await response.json()) as {
      embedding?: number[];
      data?: Array<{ embedding?: number[] }>;
    };
    
    // 处理不同的响应格式
    let embedding: number[] | undefined;
    if (data.embedding) {
      embedding = data.embedding;
    } else if (data.data && Array.isArray(data.data) && data.data[0]?.embedding) {
      embedding = data.data[0].embedding;
    }

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(
        `Embedding 返回为空或格式错误: ${JSON.stringify(data).substring(0, 200)}`
      );
    }

    // 检查维度（nomic-embed-text 应该是 768 维）
    if (embedding.length !== 768) {
      console.warn(`Embedding 维度警告: 期望 768 维，实际 ${embedding.length} 维`);
    }

    return embedding;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama Embedding API 超时 (${OLLAMA_EMBEDDING_TIMEOUT_MS / 1000}秒)`);
    }
    throw error;
  }
}

