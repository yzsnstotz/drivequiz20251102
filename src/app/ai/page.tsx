"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/common/Header";
import { Send, X, MessageCircle } from "lucide-react";
import { callAiDirect } from "@/lib/aiClient.front";
import { getCurrentAiProvider } from "@/lib/aiProviderConfig.front";

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="AI助手" showAIButton={false} />
      
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
        {/* Context选择器 */}
        <div className="mb-4 flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">上下文:</span>
          <div className="flex space-x-2">
            {(["general", "license", "vehicle", "service"] as Context[]).map((ctx) => (
              <button
                key={ctx}
                onClick={() => setContext(ctx)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  context === ctx
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {contextLabels[ctx]}
              </button>
            ))}
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow-md p-4 mb-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">开始对话</p>
                <p className="text-sm">选择上下文后，输入您的问题</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
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
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4 inline" />
            </button>
          </div>
        )}

        {/* 输入框 */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题..."
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Send className="h-5 w-5" />
            <span>发送</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">加载中...</div>}>
      <AIPageContent />
    </Suspense>
  );
}

