/**
 * Ollama 客户端封装
 * 提供统一的 Ollama API 调用接口
 */

import { logger } from "./logger.js";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const AI_MODEL = process.env.AI_MODEL || "llama3.2:3b";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

/**
 * 调用 Ollama Chat API
 */
export async function callOllamaChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  temperature = 0.4
): Promise<string> {
  const startedAt = Date.now();
  logger.info(
    {
      event: "ollama.chat.request",
      model: AI_MODEL,
      messageCount: messages.length,
      temperature,
    },
    "调用 Ollama Chat API"
  );
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
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    logger.error(
      {
        event: "ollama.chat.error",
        model: AI_MODEL,
        durationMs: Date.now() - startedAt,
        status: response.status,
        error,
      },
      "Ollama Chat API 调用失败"
    );
    throw new Error(`Ollama Chat API 调用失败: ${error}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content?.trim() || "";
  logger.info(
    {
      event: "ollama.chat.success",
      model: AI_MODEL,
      durationMs: Date.now() - startedAt,
      answerLength: answer.length,
    },
    "Ollama Chat API 返回成功"
  );
  return answer;
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
  const startedAt = Date.now();
  logger.info(
    {
      event: "ollama.embedding.request",
      model: EMBEDDING_MODEL,
      endpoint,
      payloadLength: text.length,
    },
    "调用 Ollama Embedding API"
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      [paramName]: text.slice(0, 3000), // 限制长度
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    logger.error(
      {
        event: "ollama.embedding.error",
        model: EMBEDDING_MODEL,
        endpoint,
        durationMs: Date.now() - startedAt,
        status: response.status,
        error,
      },
      "Ollama Embedding API 调用失败"
    );
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
    logger.error(
      {
        event: "ollama.embedding.empty",
        model: EMBEDDING_MODEL,
        endpoint,
      },
      "Embedding 返回为空或格式错误"
    );
    throw new Error(
      `Embedding 返回为空或格式错误: ${JSON.stringify(data).substring(0, 200)}`
    );
  }

  // 检查维度（nomic-embed-text 应该是 768 维）
  if (embedding.length !== 768) {
    logger.warn(
      {
        event: "ollama.embedding.dimension_warning",
        model: EMBEDDING_MODEL,
        expected: 768,
        actual: embedding.length,
      },
      "Embedding 维度与预期不符"
    );
  }

  logger.info(
    {
      event: "ollama.embedding.success",
      model: EMBEDDING_MODEL,
      endpoint,
      durationMs: Date.now() - startedAt,
      dimension: embedding.length,
    },
    "Ollama Embedding API 返回成功"
  );

  return embedding;
}

