"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Send } from "lucide-react";

/** ---- 协议与类型 ---- */
type Role = "user" | "ai";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number; // epoch ms
  // AI回复的元数据（仅AI消息有）
  metadata?: {
    aiProvider?: "online" | "local"; // AI服务提供商
    sources?: Array<{
      title: string;
      url: string;
      snippet?: string;
      score?: number;
      version?: string;
    }>; // RAG数据源
  };
}

interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
}

interface ApiErrorBody {
  ok: false;
  errorCode: string;
  message: string;
}

type ApiResponse<T = unknown> = ApiSuccess<T> | ApiErrorBody;

// /api/ai/ask 的响应类型
interface AiAskResponse {
  ok: boolean;
  data?: {
    answer: string;
    sources?: Array<{
      title: string;
      url: string;
      snippet?: string;
      score?: number;
      version?: string;
    }>;
    model?: string;
    safetyFlag?: "ok" | "needs_human" | "blocked";
    costEstimate?: { inputTokens: number; outputTokens: number; approxUsd: number };
    aiProvider?: "online" | "local"; // AI服务提供商
  };
  errorCode?: string;
  message?: string;
}

interface AIPageProps {
  onBack: () => void;
}

/** ---- 常量与工具 ---- */
const API_BASE =
  (process.env.NEXT_PUBLIC_AI_API_BASE as string | undefined) ?? "";
const CHAT_PATH = "/api/ai/ask"; // 使用 /api/ai/ask 路由，转发到 AI-Service (Render)
const REQUEST_TIMEOUT_MS = 30_000;
const LOCAL_STORAGE_KEY = "AI_CHAT_HISTORY";
const MAX_HISTORY_MESSAGES = 100;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

/** ---- 组件 ---- */
const AIPage: React.FC<AIPageProps> = ({ onBack }) => {
  // 初始化消息历史：从 localStorage 读取，如果不存在则使用默认欢迎消息
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ChatMessage[];
          // 确保解析的数据是有效的数组
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // 解析失败时忽略，使用默认值
      }
    }
    return [
      {
        id: uid(),
        role: "ai",
        content: "你好！我是你的 AI 助手，有什么我可以帮你的吗？",
        createdAt: Date.now(),
      },
    ];
  });
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorTip, setErrorTip] = useState<string>("");

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const endpoint = useMemo(() => `${API_BASE}${CHAT_PATH}`, []);

  // 自动滚动到底部
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 输入框自动聚焦（移动端优化）
  useEffect(() => {
    // 延迟聚焦，确保页面渲染完成
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 持久化消息历史到 localStorage（限制最大条数）
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // 限制最大保存条数，只保存最近的 N 条消息
        const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // 写入失败时忽略（例如 localStorage 已满或不可用）
      }
    }
  }, [messages]);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    setErrorTip("");
    setLoading(true);

    // 1) 先落地用户消息
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: q,
      createdAt: Date.now(),
    };
    pushMessage(userMsg);
    setInput("");

    // 2) 准备请求
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // 尝试从多个来源获取token（兼容移动端和桌面端）
      let token: string | null = null;
      if (typeof window !== "undefined") {
        // 优先从localStorage获取
        token = localStorage.getItem("USER_TOKEN");
        
        // 如果localStorage没有，尝试从cookie获取（兼容某些移动浏览器）
        if (!token) {
          try {
            const cookies = document.cookie.split(";");
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split("=");
              if (name === "USER_TOKEN" || name === "sb-access-token") {
                token = decodeURIComponent(value);
                // 如果从cookie获取到token，也保存到localStorage（方便下次使用）
                if (token) {
                  localStorage.setItem("USER_TOKEN", token);
                }
                break;
              }
            }
          } catch (e) {
            console.error("[Frontend Debug] Cookie read error:", e);
          }
        }
        
        // 调试日志：检查 token 是否存在
        console.log("[Frontend Debug] JWT Token Status:", {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenPrefix: token?.substring(0, 30) || "N/A",
          isActivationToken: token?.startsWith("act-") || false,
          localStorageKeys: typeof window !== "undefined" ? Object.keys(localStorage) : [],
          cookieAvailable: typeof document !== "undefined",
          cookies: typeof document !== "undefined" ? document.cookie.split(";").map(c => c.trim().split("=")[0]) : [],
        });
      }

      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // 统一协议：{ question, locale?, messages? } → { ok, data: { answer, sources?, ... }, errorCode, message }
        // 准备对话历史（只传递最近的 10 条消息，排除当前问题）
        const historyMessages = messages
          .slice(-10) // 只保留最近 10 条
          .filter((msg) => msg.role === "user" || msg.role === "ai") // 只保留用户和AI消息
          .map((msg) => ({
            role: msg.role === "ai" ? "assistant" : "user" as "user" | "assistant",
            content: msg.content,
          }));
        
        const requestBody: Record<string, unknown> = {
          question: q,
          locale: (typeof navigator !== "undefined" && navigator.language) || "zh-CN",
        };
        
        // 传递对话历史（如果有）
        if (historyMessages.length > 0) {
          requestBody.messages = historyMessages;
          requestBody.maxHistory = 10; // 限制最大历史消息数
        }
        
        const res = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(requestBody),
      });

      let payload: AiAskResponse;
      try {
        payload = (await res.json()) as AiAskResponse;
      } catch {
        throw new Error(`Bad JSON response (status ${res.status})`);
      }

      if (!payload.ok) {
        const message = payload.message || "服务开小差了，请稍后再试";
        
        // 如果是认证错误，提供更友好的提示
        if (payload.errorCode === "AUTH_REQUIRED" || payload.errorCode === "INVALID_TOKEN") {
          const authMessage = "认证失败，请重新激活或刷新页面";
          setErrorTip(authMessage);
          pushMessage({
            id: uid(),
            role: "ai",
            content: `【认证错误】${authMessage}。如果您刚刚激活，请刷新页面重试。`,
            createdAt: Date.now(),
          });
        } else {
          setErrorTip(message);
          pushMessage({
            id: uid(),
            role: "ai",
            content: `【出错】${message}${payload.errorCode ? `（${payload.errorCode}）` : ""}`,
            createdAt: Date.now(),
          });
        }
        return;
      }

      // 处理响应数据：/api/ai/ask 返回 { ok, data: { answer, sources?, aiProvider?, ... } }
      const answer = payload.data?.answer ?? "";
      const sources = payload.data?.sources;
      const aiProvider = payload.data?.aiProvider;
      
      // 构建回复内容（不再在内容中附加来源，而是在metadata中保存）
      const content = answer || "（空响应）";
      
      pushMessage({
        id: uid(),
        role: "ai",
        content,
        createdAt: Date.now(),
        metadata: {
          aiProvider: aiProvider || "online", // 默认为online
          sources: sources || [],
        },
      });
    } catch (err) {
      const msg =
        controller.signal.aborted
          ? "请求超时，请重试。"
          : `网络异常：${formatErrorMessage(err)}`;
      setErrorTip(msg);
      pushMessage({
        id: uid(),
        role: "ai",
        content: `【出错】${msg}`,
        createdAt: Date.now(),
      });
    } finally {
      clearTimeout(timer);
      setLoading(false);
      // 重新聚焦输入框
      inputRef.current?.focus();
    }
  }, [endpoint, input, loading, pushMessage]);


  return (
    <div className="flex flex-col bg-gray-100 fixed inset-0 z-[100]" style={{
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      height: '100dvh', // 使用动态视口高度，适配移动端浏览器
      maxHeight: '100dvh',
      overflow: 'hidden'
    }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b bg-white p-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="返回"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">AI 助手</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
            setMessages([
              {
                id: uid(),
                role: "ai",
                content: "你好！我是你的 AI 助手，有什么我可以帮你的吗？",
                createdAt: Date.now(),
              },
            ]);
          }}
          className="rounded-lg px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-label="清空历史"
        >
          清空历史
        </button>
      </div>

      {/* 消息区 */}
      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto p-4 pb-6 min-h-0"
        aria-live="polite"
      >
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
            >
              <div
                className={`max-w-[78%] rounded-lg p-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-900 shadow-md"
                }`}
              >
                {m.content}
              </div>
              {/* AI回复的元数据信息 */}
              {!isUser && m.metadata && (
                <div className="max-w-[78%] px-2 py-1 text-xs text-gray-500 space-y-1">
                  {/* AI服务提供商 */}
                  {m.metadata.aiProvider && (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-1">
                        {m.metadata.aiProvider === "local" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span>本地AI (Ollama)</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>在线AI (OpenAI)</span>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {/* RAG数据源 */}
                  {m.metadata.sources && m.metadata.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-gray-400">📚 参考来源：</span>
                      {m.metadata.sources.map((source, idx) => {
                        const displayText = source.title || source.url || `来源 ${idx + 1}`;
                        const hasUrl = source.url && source.url.trim() !== "";
                        
                        if (hasUrl) {
                          return (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 underline truncate max-w-[200px]"
                              title={displayText}
                            >
                              {displayText}
                            </a>
                          );
                        } else {
                          return (
                            <span
                              key={idx}
                              className="text-gray-500 truncate max-w-[200px]"
                              title={displayText}
                            >
                              {displayText}
                            </span>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部输入区 - 移动端优化：确保不被浏览器导航栏遮挡 */}
      <div className="border-t bg-white p-3 flex-shrink-0" style={{ 
        paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1.5rem + 80px))',
        paddingTop: '0.75rem',
        marginBottom: 'max(0px, calc(env(safe-area-inset-bottom) - 10px))',
        position: 'relative',
        zIndex: 10
      }}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="输入问题..."
              className="w-full h-11 rounded-lg border px-3 pr-20 outline-none transition-[border-color] focus:border-blue-500 text-base"
              spellCheck={false}
              type="text"
              style={{ fontSize: '16px' }} // iOS Safari 需要至少16px才能避免自动缩放
            />
            {/* 字数提示（可选） */}
            {input.trim().length > 0 && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-xs text-gray-400">
                {input.trim().length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={loading || input.trim().length === 0}
            className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 h-11 transition-colors flex-shrink-0 ${
              loading || input.trim().length === 0
                ? "cursor-not-allowed bg-gray-200 text-gray-500"
                : "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
            }`}
            aria-busy={loading}
          >
            <Send className="h-4 w-4" />
            {loading ? "发送中…" : "发送"}
          </button>
        </div>

        {/* 底部错误提示 */}
        {errorTip && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {errorTip}
          </p>
        )}
      </div>
    </div>
  );
};

export default AIPage;
