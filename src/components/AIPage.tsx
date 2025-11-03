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

interface AIPageProps {
  onBack: () => void;
}

/** ---- 常量与工具 ---- */
const API_BASE =
  (process.env.NEXT_PUBLIC_AI_API_BASE as string | undefined) ?? "";
const CHAT_PATH = "/api/ai/chat"; // 由主站路由或 BFF 代理到 AI-Service
const REQUEST_TIMEOUT_MS = 30_000;

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
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid(),
      role: "ai",
      content: "你好！我是你的 AI 助手，有什么我可以帮你的吗？",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorTip, setErrorTip] = useState<string>("");

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const endpoint = useMemo(() => `${API_BASE}${CHAT_PATH}`, []);

  // 自动滚动到底部
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 多行输入框自动高度
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

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
      const token = typeof window !== "undefined" ? localStorage.getItem("USER_TOKEN") : null;

      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // 统一协议：{ question } → { ok, data: { answer }, errorCode, message }
        body: JSON.stringify({
          question: q,
          // 可选字段（按需由后端取用）：前端无需执行 safety，后端统一 checkSafety()
          meta: {
            client: "web",
            locale:
              (typeof navigator !== "undefined" && navigator.language) || "zh-CN",
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            // 视情况增加 pageId / userId / sessionId 等
          },
        }),
      });

      let payload: ApiResponse<{ answer: string }>;
      try {
        payload = (await res.json()) as ApiResponse<{ answer: string }>;
      } catch {
        throw new Error(`Bad JSON response (status ${res.status})`);
      }

      if (!payload.ok) {
        const message = payload.message || "服务开小差了，请稍后再试";
        setErrorTip(message);
        pushMessage({
          id: uid(),
          role: "ai",
          content: `【出错】${message}${payload.errorCode ? `（${payload.errorCode}）` : ""}`,
          createdAt: Date.now(),
        });
        return;
      }

      const answer = payload.data?.answer ?? "";
      pushMessage({
        id: uid(),
        role: "ai",
        content: answer || "（空响应）",
        createdAt: Date.now(),
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* 顶栏 */}
      <div className="flex items-center space-x-3 border-b bg-white p-4">
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

      {/* 消息区 */}
      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto p-4"
        aria-live="polite"
      >
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
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
            </div>
          );
        })}
      </div>

      {/* 底部输入区 */}
      <div className="border-t bg-white p-4">
        <div className="flex items-end space-x-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="输入你的问题…（Shift+Enter 换行）"
              className="max-h-40 min-h-[44px] w-full resize-none rounded-lg border p-2 pr-10 outline-none transition-[border-color] focus:border-blue-500"
              rows={1}
              spellCheck={false}
            />
            {/* 字数提示（可选） */}
            <span className="pointer-events-none absolute bottom-2 right-3 select-none text-xs text-gray-400">
              {input.trim().length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={loading || input.trim().length === 0}
            className={`inline-flex items-center gap-1 rounded-lg px-4 py-2 transition-colors ${
              loading || input.trim().length === 0
                ? "cursor-not-allowed bg-gray-200 text-gray-500"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
            aria-busy={loading}
          >
            <Send className="h-4 w-4" />
            {loading ? "发送中…" : "发送"}
          </button>
        </div>

        {/* 底部错误提示 */}
        {errorTip && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {errorTip}
          </p>
        )}
      </div>
    </div>
  );
};

export default AIPage;
