"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, MessageCircle } from "lucide-react";
import { callAiDirect } from "@/lib/aiClient.front";
import { getCurrentAiProvider } from "@/lib/aiProviderConfig.front";
import AIActivationProvider, { useAIActivation } from "@/components/AIActivationProvider";

type Context = "license" | "vehicle" | "service" | "general";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  createdAt: number;
  context?: Context;
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

function AIPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contextParam = searchParams.get("context") as Context | null;
  const [context, setContext] = useState<Context>(contextParam || "general");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentProvider, setCurrentProvider] = useState<"local" | "render">("render");
  const [currentModel, setCurrentModel] = useState<string | undefined>(undefined);
  const { isActivated } = useAIActivation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 获取当前配置的 provider
  useEffect(() => {
    getCurrentAiProvider()
      .then((config) => {
        setCurrentProvider(config.provider);
        setCurrentModel(config.model);
      })
      .catch((err) => {
        console.warn("[AIPage] 获取 provider 配置失败，使用默认值:", err);
        setCurrentProvider("render");
      });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // 检查激活状态
    if (!isActivated) {
      router.push('/activation');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
      context,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      // 将 context 映射到 scene（如果需要）
      // 当前 ai-service 可能不支持 context 参数，先使用 "chat" 作为默认场景
      const scene = "chat"; // 可以根据 context 映射到不同的 scene

      const payload = await callAiDirect({
        provider: currentProvider,
        question: userMessage.content,
        locale: "zh",
        scene: scene,
        model: currentModel,
      });

      if (!payload.ok) {
        throw new Error(payload.message || "AI 服务调用失败");
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: payload.data?.answer || "（空响应）",
        createdAt: Date.now(),
        context,
        sources: payload.data?.sources,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送消息失败");
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: `抱歉，发生了错误：${err instanceof Error ? err.message : "未知错误"}`,
        createdAt: Date.now(),
        context,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const contextLabels: Record<Context, string> = {
    license: "驾照",
    vehicle: "车辆",
    service: "服务",
    general: "通用",
  };

  return (
    <div className="flex flex-col bg-gray-100 fixed inset-0 z-[100]" style={{
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      height: '100dvh',
      maxHeight: '100dvh',
      overflow: 'hidden'
    }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b bg-white p-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="返回"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">AI 助手</h1>
          <span className="text-xs text-gray-500 ml-2">by Zalem</span>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden px-4 py-4">
        {/* 消息列表 */}
        <div
          className="flex-1 space-y-4 overflow-y-auto p-4 pb-6 min-h-0"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">开始对话</p>
                <p className="text-sm">输入您的问题</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
                  >
                    <div
                      className={`max-w-[78%] rounded-lg p-3 text-sm leading-relaxed ${
                        isUser
                          ? "bg-blue-500 text-white"
                          : "bg-white text-gray-900 shadow-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <p className="text-xs font-medium mb-1">参考来源:</p>
                          <ul className="space-y-1">
                            {message.sources.map((source, idx) => (
                              <li key={idx} className="text-xs">
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {source.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-lg p-3 shadow-md">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </div>
        )}

        {/* 输入框 */}
        <div className="border-t bg-white p-3 flex-shrink-0" style={{ 
          paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1.5rem))',
          paddingTop: '0.75rem',
        }}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入问题..."
                disabled={loading}
                className="w-full h-11 rounded-lg border px-3 pr-20 outline-none transition-[border-color] focus:border-blue-500 text-base"
                style={{ fontSize: '16px' }}
              />
              {input.trim().length > 0 && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-xs text-gray-400">
                  {input.trim().length}
                </span>
              )}
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 h-11 transition-colors flex-shrink-0 ${
                loading || !input.trim()
                  ? "cursor-not-allowed bg-gray-200 text-gray-500"
                  : "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
              }`}
              aria-busy={loading}
            >
              <Send className="h-4 w-4" />
              {loading ? "发送中…" : "发送"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIPage() {
  return (
    <AIActivationProvider>
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">加载中...</div>}>
        <AIPageContent />
      </Suspense>
    </AIActivationProvider>
  );
}

