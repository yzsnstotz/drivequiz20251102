"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Send } from "lucide-react";
import Image from "next/image";
import { detectLanguage, type Language, useLanguage } from "@/lib/i18n";
import { callAiDirect, type AiProviderKey } from "@/lib/aiClient.front";
import { getAiExpectedTime } from "@/lib/aiStatsClient";
import { getCurrentAiProvider } from "@/lib/aiProviderConfig.front";
import AIActivationProvider, { useAIActivation } from "@/components/AIActivationProvider";
import { useAppSession } from "@/contexts/SessionContext";
import { detectLangFromText } from "@/lib/languageDetector";

/** ---- 协议与类型 ---- */
type Role = "user" | "ai";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number; // epoch ms
  // AI reply metadata (only for AI messages)
  metadata?: {
    aiProvider?: "openai" | "openai_direct" | "local" | "openrouter" | "openrouter_direct" | "gemini_direct" | "cached"; // AI service provider
    model?: string; // Model name
    sources?: Array<{
      title: string;
      url: string;
      snippet?: string;
      score?: number;
      version?: string;
    }>; // RAG sources
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
    aiProvider?: "openai" | "openai_direct" | "local" | "openrouter" | "openrouter_direct" | "gemini_direct" | "cached"; // AI service provider
  };
  errorCode?: string;
  message?: string;
}

interface AIPageProps {
  onBack: () => void;
}

/** ---- 常量与工具 ---- */
const REQUEST_TIMEOUT_MS = 120_000; // 120秒超时（AI处理可能需要较长时间，特别是本地Ollama）
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

// 清理模型名称，移除日期信息（如 gpt-4o-mini-2024-07-18 -> gpt-4o-mini）
function cleanModelName(model: string | undefined): string | undefined {
  if (!model) return undefined;
  // 移除日期格式：-YYYY-MM-DD
  return model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

// 根据用户输入的问题自动检测语言
function detectLanguageFromQuestion(question: string): "zh" | "ja" | "en" {
  const text = question.trim();
  if (!text) return "zh";

  // 检测日文（平假名、片假名、汉字混合）
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  if (japaneseRegex.test(text)) {
    const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
    if (japaneseChars.length > text.length * 0.3) {
      return "ja";
    }
  }

  // 检测英文（主要是英文字母）
  const englishRegex = /^[a-zA-Z\s.,!?'"-]+$/;
  if (englishRegex.test(text) && text.length > 0) {
    const englishChars = text.match(/[a-zA-Z]/g) || [];
    if (englishChars.length > text.length * 0.5) {
      return "en";
    }
  }

  // 检测中文（中文字符）
  const chineseRegex = /[\u4E00-\u9FAF]/;
  if (chineseRegex.test(text)) {
    return "zh";
  }

  // 默认返回中文
  return "zh";
}

// 将语言代码转换为locale格式
function languageToLocale(lang: "zh" | "ja" | "en"): string {
  switch (lang) {
    case "zh":
      return "zh-CN";
    case "ja":
      return "ja-JP";
    case "en":
      return "en-US";
    default:
      return "zh-CN";
  }
}

// 将locale格式转换为语言代码
function localeToLang(locale: string | undefined): "zh" | "ja" | "en" {
  if (!locale) return "zh";
  const normalized = locale.toLowerCase().trim();
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("zh")) return "zh";
  return "zh";
}

async function callAiViaBackend(payload: any) {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

/** ---- 组件 ---- */
// Get welcome message based on language
// 注意：这个函数现在不再使用，改为使用翻译键
// 保留用于向后兼容
function getWelcomeMessage(lang: Language): string {
  switch (lang) {
    case "zh":
      return "你好！我是你的 AI 助手，有什么我可以帮你的吗？";
    case "ja":
      return "こんにちは！私はあなたの AI アシスタントです。何かお手伝いできることはありますか？";
    case "en":
    default:
      return "Hello! I'm your AI assistant. How can I help you?";
  }
}

const AIPageContent: React.FC<AIPageProps> = ({ onBack }) => {
  const { session } = useAppSession();
  const { isActivated, showActivationModal } = useAIActivation();
  const { t, language, languageReady } = useLanguage();
  
  // 初始化消息历史：使用固定的默认值，避免hydration错误
  // 在SSR和客户端都使用相同的默认值（中文），避免hydration不匹配
  // 实际的localStorage读取和语言检测将在useEffect中完成
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // 使用固定的默认语言（中文），避免SSR和客户端不一致
    // 在useEffect中会根据实际语言更新
    const welcomeMessage: ChatMessage = {
      id: "welcome-message", // 使用固定ID，避免每次渲染都不同
      role: "ai",
      content: getWelcomeMessage("zh"), // 使用固定的默认语言，避免hydration错误
      createdAt: 0, // 使用固定时间戳，避免hydration错误
    };
    return [welcomeMessage];
  });
  
  // 在客户端挂载后从localStorage加载消息
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        // 确保解析的数据是有效的数组
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("[AIPage] 从缓存加载聊天记录:", {
            messageCount: parsed.length,
            timestamp: new Date().toISOString(),
          });
          setMessages(parsed);
          return;
        } else {
          console.log("[AIPage] 缓存为空或无效，使用默认欢迎消息");
        }
      } else {
        console.log("[AIPage] 未找到缓存，使用默认欢迎消息");
      }
    } catch (error) {
      // 解析失败时记录错误，使用默认值
      console.error("[AIPage] 解析缓存失败:", {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
    
    // 如果没有缓存或缓存无效，根据实际语言创建并保存欢迎消息
    const lang = detectLanguage();
    // 使用翻译键获取欢迎消息（需要从useLanguage获取t函数，但这里在useEffect中，需要从外部获取）
    // 暂时使用getWelcomeMessage，后续可以优化
    const welcomeMessage: ChatMessage = {
      id: uid(),
      role: "ai",
      content: getWelcomeMessage(lang),
      createdAt: Date.now(),
    };
    
    // 如果当前消息的语言与实际语言不一致，更新消息
    // 这确保在客户端hydration后，消息语言与用户设置一致
    setMessages((prevMessages) => {
      const currentWelcome = prevMessages[0];
      // 如果当前是默认欢迎消息且语言不匹配，更新它
      if (currentWelcome?.id === "welcome-message" && currentWelcome.content !== welcomeMessage.content) {
        return [welcomeMessage];
      }
      // 如果已经有其他消息（不是默认欢迎消息），不更新
      if (prevMessages.length > 1 || (prevMessages[0] && prevMessages[0].id !== "welcome-message")) {
        return prevMessages;
      }
      return [welcomeMessage];
    });
    
    // 保存欢迎消息到缓存
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([welcomeMessage]));
    } catch (error) {
      console.warn("[AIPage] 保存欢迎消息到缓存失败:", error);
    }
  }, []); // 只在组件挂载时执行一次

  // 语言切换时，如果当前只有欢迎语（且无用户对话），自动切换到对应语言的欢迎语并同步到缓存
  useEffect(() => {
    if (messages.length === 0) return;
    const hasUserMessages = messages.some((m) => m.role === "user");
    if (hasUserMessages) return;

    const first = messages[0];
    const isOnlyWelcome = messages.length === 1 && first.role === "ai";
    if (!isOnlyWelcome) return;

    const newContent = getWelcomeMessage(language);
    if (first.content === newContent) return;

    const updated: ChatMessage[] = [
      { ...first, content: newContent },
    ];
    setMessages(updated);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  }, [language, messages]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorTip, setErrorTip] = useState<string>("");
  const [expectedTime, setExpectedTime] = useState<number | null>(null);
  const [currentProvider, setCurrentProvider] = useState<AiProviderKey>("render");
  const [currentModel, setCurrentModel] = useState<string | undefined>(undefined);
  const [languageMismatch, setLanguageMismatch] = useState<{
    detected: string;
    expected: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // 获取当前配置的 provider（组件挂载时获取，使用缓存机制）
  useEffect(() => {
    getCurrentAiProvider()
      .then((config) => {
        console.log("[AI Provider Selected][AIPage]", {
          provider: config.provider,
          model: config.model,
          timestamp: new Date().toISOString(),
        });
        
        // 验证 provider 配置是否有效
        if (config.provider !== "local" && config.provider !== "render") {
          console.error("[AIPage] 无效的 provider 配置:", config.provider, "使用默认值 render");
          setCurrentProvider("render");
        } else {
          setCurrentProvider(config.provider);
        }
        setCurrentModel(config.model);
      })
      .catch((err) => {
        console.error("[AIPage] 获取 provider 配置失败（缓存机制应已处理，此错误不应发生）:", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        // 由于缓存机制，这里应该很少会失败，但为了安全起见，使用默认值
        setCurrentProvider("render");
      });
  }, []);

  // 持久化消息历史到 localStorage（限制最大条数）
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      try {
        // 限制最大保存条数，只保存最近的 N 条消息
        const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
        console.log("[AIPage] 保存聊天记录到缓存:", {
          originalCount: messages.length,
          savedCount: trimmed.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // 写入失败时记录错误（例如 localStorage 已满或不可用）
        console.error("[AIPage] 保存聊天记录到缓存失败:", {
          error: error instanceof Error ? error.message : String(error),
          messageCount: messages.length,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [messages]);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    // ✅ 修复：禁止语言未就绪就发送
    if (!languageReady) {
      console.warn('[lang-trace] blocked send: language not ready yet', {
        language,
        languageReady,
      });
      return;
    }

    // 检查激活状态
    if (!isActivated) {
      showActivationModal();
      return;
    }

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
            // Silent error handling
          }
        }
      }

      // 准备对话历史（包含当前用户消息，因为状态更新是异步的）
      const allMessages = [...messages, userMsg];
      
      const historyMessages = allMessages
        .slice(-12)
        .filter((msg) => msg.role === "user" || msg.role === "ai")
        .slice(0, -1)
        .map((msg) => ({
          role: msg.role === "ai" ? "assistant" : "user" as "user" | "assistant",
          content: msg.content,
        }));
      
      // 验证当前 provider 配置（在调用前再次确认）
      if (currentProvider !== "local" && currentProvider !== "render") {
        const errorMsg = `无效的 provider 配置: ${currentProvider}。请刷新页面重试。`;
        console.error("[AIPage] Provider 配置验证失败:", {
          currentProvider,
          timestamp: new Date().toISOString(),
        });
        setErrorTip(errorMsg);
        pushMessage({
          id: uid(),
          role: "ai",
          content: `【配置错误】${errorMsg}`,
          createdAt: Date.now(),
        });
        setLoading(false);
        return;
      }

      // 记录调用前的配置信息
      console.log("[AIPage] 准备调用 AI 服务:", {
        provider: currentProvider,
        model: currentModel,
        questionLength: q.length,
        hasHistory: historyMessages.length > 0,
        timestamp: new Date().toISOString(),
      });

      // 获取预计耗时（使用当前配置的 provider）
      try {
        const expected = await getAiExpectedTime(currentProvider, currentModel);
        setExpectedTime(expected);
      } catch {
        // 忽略错误，继续执行
      }

      // 使用用户设置的语言（而不是自动检测）
      const userLocale = languageToLocale(language);
      
      // ✅ 日志：记录语言传递链路
      console.log('[lang-trace] handleSend', {
        language,
        languageReady,
        userLocale,
        question: q.substring(0, 50),
        timestamp: new Date().toISOString(),
      });
      
      console.log("[AIPage] 使用用户设置的语言:", {
        question: q.substring(0, 50),
        userLanguage: language,
        userLocale,
        timestamp: new Date().toISOString(),
      });

      // 记录当前选择的 provider/model，便于回归排查
      console.log("[AI Provider Selected][AIPage]", {
        provider: currentProvider,
        model: currentModel,
      });

      // 改为调用后端 API (via callAiViaBackend) 以支持日志记录
      const payload = await callAiViaBackend({
        question: q,
        lang: localeToLang(userLocale),
        scene: "chat",
        messages: historyMessages.length > 0 ? historyMessages : undefined,
        maxHistory: 10,
        model: currentModel,
        userId: session?.user?.id || null,
      });

      if (!payload.ok) {
        const message = payload.message || t('ai.error.serviceUnavailable');
        
        // 根据不同的错误类型提供友好的提示
        if (payload.errorCode === "AUTH_REQUIRED" || payload.errorCode === "INVALID_TOKEN") {
          const authMessage = t('ai.error.authFailed');
          setErrorTip(authMessage);
          pushMessage({
            id: uid(),
            role: "ai",
            content: `【${t('ai.error.unknown')}】${authMessage}。${t('ai.error.authFailedDetail')}`,
            createdAt: Date.now(),
          });
        } else if (payload.errorCode === "CONFIG_ERROR") {
          // 统一为服务不可用提示，不再展示“环境变量错误”类UI
          const serviceUnavailable = t('ai.error.serviceUnavailable');
          setErrorTip(serviceUnavailable);
          pushMessage({
            id: uid(),
            role: "ai",
            content: `【${t('ai.error.unknown')}】${serviceUnavailable}`,
            createdAt: Date.now(),
          });
        } else if (payload.errorCode === "AI_SERVICE_ERROR" && message.includes("local")) {
          // 配置不匹配：数据库配置为 local 但调用了远程服务
          const mismatchMessage = t('ai.error.configMismatch');
          setErrorTip(mismatchMessage);
          pushMessage({
            id: uid(),
            role: "ai",
            content: `【${t('ai.error.unknown')}】${mismatchMessage} ${t('ai.error.contactSupport')}`,
            createdAt: Date.now(),
          });
        } else {
          // 其他错误
          setErrorTip(message);
          pushMessage({
            id: uid(),
            role: "ai",
            content: `【${t('ai.error.unknown')}】${message}${payload.errorCode ? `（${payload.errorCode}）` : ""}`,
            createdAt: Date.now(),
          });
        }
        return;
      }

      // 处理响应数据：callAiDirect 返回 { ok, data: { answer, sources?, aiProvider?, model?, ... } }
      const answer = payload.data?.answer ?? "";
      const sources = payload.data?.sources;
      const aiProvider = payload.data?.aiProvider;
      const model = payload.data?.model;
      
      // 根据实际调用的 provider 设置 aiProvider（优先使用响应中的值，否则使用调用时的 provider）
      const actualProvider = aiProvider || currentProvider;
      
      // 构建回复内容（不再在内容中附加来源，而是在metadata中保存）
      const content = answer || t('ai.error.emptyResponse');
      
      // 记录语言参数日志（在收到AI回复后）
      const requestLang = localeToLang(userLocale);
      const replyPreview = content.substring(0, 80);
      console.log("[AIPage] AI回复语言参数日志:", {
        userLanguage: language,
        userLocale: userLocale,
        requestLang: requestLang,
        replyPreview: replyPreview,
        timestamp: new Date().toISOString(),
      });
      
      // 语言验证机制：检测回复语言是否与用户设置一致
      const detectedLang = detectLangFromText(content);
      const isMismatch = 
        (language === "en" && detectedLang !== "en") ||
        (language === "zh" && detectedLang !== "zh") ||
        (language === "ja" && detectedLang !== "ja");
      
      if (isMismatch) {
        console.warn("[AIPage] language mismatch", {
          userLanguage: language,
          detectedLang: detectedLang,
          replyPreview: replyPreview,
          timestamp: new Date().toISOString(),
        });
        setLanguageMismatch({
          detected: detectedLang,
          expected: language,
        });
      } else {
        setLanguageMismatch(null);
      }
      
      pushMessage({
        id: uid(),
        role: "ai",
        content,
        createdAt: Date.now(),
        metadata: {
          aiProvider: actualProvider as any, // 使用实际 provider
          sources: sources || [],
          model: model, // 保存模型名称
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${t('ai.error.networkError')}：${formatErrorMessage(err)}`;
      setErrorTip(msg);
      pushMessage({
        id: uid(),
        role: "ai",
        content: `【${t('ai.error.unknown')}】${msg}`,
        createdAt: Date.now(),
      });
    } finally {
      setLoading(false);
      setExpectedTime(null);
      // 重新聚焦输入框
      inputRef.current?.focus();
    }
  }, [input, loading, pushMessage, messages, isActivated, showActivationModal, language, languageReady, t, currentProvider, currentModel]);


  return (
    <div className="flex flex-col bg-gray-100 dark:bg-black fixed inset-0 z-[100]" style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: '100dvh', // 使用动态视口高度，适配移动端浏览器
        maxHeight: '100dvh',
        overflow: 'hidden'
      }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b dark:border-ios-dark-border bg-white dark:bg-ios-dark-bg-secondary p-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary hover:text-gray-900 dark:hover:text-white"
            aria-label="返回"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('ai.assistant')}</h1>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">by Zalem</span>
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
                content: getWelcomeMessage(language),
                createdAt: Date.now(),
              },
            ]);
          }}
          className="rounded-lg px-3 py-1 text-sm text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary hover:text-gray-900 dark:hover:text-white"
          aria-label={t('ai.clearHistory')}
        >
          {t('ai.clearHistory')}
        </button>
      </div>

      {/* 语言不匹配警告栏 */}
      {languageMismatch && (
        <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 text-sm">
          <span className="text-yellow-800 dark:text-yellow-200">
            AI 回复的语言（检测为: {languageMismatch.detected}）可能与当前设置的语言（{languageMismatch.expected}）不一致，这可能是外部 AI 服务的行为所致。
          </span>
          <button
            type="button"
            onClick={() => {
              console.log("[AIPage] 用户点击语言不匹配反馈按钮", {
                detected: languageMismatch.detected,
                expected: languageMismatch.expected,
                timestamp: new Date().toISOString(),
              });
            }}
            className="ml-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors"
          >
            反馈
          </button>
        </div>
      )}

      {/* 消息区 */}
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto p-4 pb-6 min-h-0 relative"
        aria-live="polite"
      >
        {/* Logo水印背景 */}
        <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-10 dark:opacity-5">
          <div className="relative w-64 h-64 md:w-80 md:h-80 backdrop-blur-sm">
            <Image
              src="/favicon.png"
              alt="ZALEM Logo"
              fill
              sizes="(max-width: 768px) 256px, 320px"
              className="object-contain"
              priority={false}
            />
          </div>
        </div>
        <div className="relative z-10">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1 mb-2`}
            >
              <div
                className={`max-w-[78%] rounded-lg p-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-blue-500 dark:bg-blue-600 text-white"
                    : "bg-white dark:bg-ios-dark-bg-secondary text-gray-900 dark:text-white shadow-md dark:shadow-ios-dark-sm"
                }`}
              >
                {m.content}
              </div>
              {/* AI reply metadata */}
              {!isUser && m.metadata && (
                <div className="max-w-[78%] px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* AI Service Provider and Model */}
                    {m.metadata.aiProvider && (
                      <span className="inline-flex items-center gap-1">
                        {m.metadata.aiProvider === "local" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span>Local AI (Ollama)</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : (m.metadata.aiProvider as any) === "render" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>Render AI Service</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : m.metadata.aiProvider === "openai" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>OpenAI (via Render)</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : m.metadata.aiProvider === "openai_direct" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                            <span>OpenAI (Direct)</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : m.metadata.aiProvider === "openrouter" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span>OpenRouter (via Render)</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : m.metadata.aiProvider === "openrouter_direct" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span>
                            <span>OpenRouter (Direct)</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : m.metadata.aiProvider === "gemini_direct" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            <span>Google Gemini (Direct)</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : m.metadata.aiProvider === "cached" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>Cached Answer</span>
                            {cleanModelName(m.metadata.model) && (
                              <span className="text-gray-400">· {cleanModelName(m.metadata.model)}</span>
                            )}
                          </>
                        ) : null}
                        {/* 耗时信息（显示在 provider 和 model 之后） */}
                        {m.metadata.sources && m.metadata.sources.length > 0 && (
                          <>
                            {m.metadata.sources
                              .filter((source: any) => source.title === "处理耗时")
                              .map((source: any, idx: number) => (
                                <span key={idx} className="text-gray-400">
                                  · {source.snippet}
                                </span>
                              ))}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  {/* RAG Sources（排除耗时信息） */}
                  {m.metadata.sources && m.metadata.sources.filter((source) => source.title !== "处理耗时").length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-gray-400 dark:text-gray-500 text-xs">📚</span>
                      {m.metadata.sources
                        .filter((source) => source.title !== "处理耗时")
                        .map((source, idx) => {
                          const displayText = source.title || source.url || source.snippet || `Source ${idx + 1}`;
                          // 去除超链接，只显示文本内容
                          return (
                            <span key={idx} className="text-gray-500 dark:text-gray-400 text-xs break-words">
                              {displayText}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* 思考动画 */}
        {loading && (
          <div className="flex flex-col items-start space-y-1 mb-2">
            <div className="max-w-[78%] rounded-lg p-3 text-sm leading-relaxed bg-white dark:bg-ios-dark-bg-secondary text-gray-900 dark:text-white shadow-md dark:shadow-ios-dark-sm">
              <span className="inline-flex items-center gap-1">
                <span className="thinking-dots">
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </span>
              </span>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* 底部输入区 - 移动端优化：确保不被浏览器导航栏遮挡 */}
      <div className="border-t dark:border-ios-dark-border bg-white dark:bg-ios-dark-bg-secondary p-3 flex-shrink-0" style={{ 
        paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
        paddingTop: '0.75rem',
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
              placeholder={t('ai.input.placeholder')}
              className="w-full h-11 rounded-lg border px-3 pr-20 outline-none transition-[border-color] focus:border-blue-500 text-base dark:bg-ios-dark-bg-secondary dark:border-ios-dark-border dark:text-ios-dark-text"
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
            disabled={!languageReady || loading || input.trim().length === 0}
            className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 h-11 transition-colors flex-shrink-0 ${
              !languageReady || loading || input.trim().length === 0
                ? "cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                : "bg-blue-500 dark:bg-blue-500 text-white dark:text-white hover:bg-blue-600 dark:hover:bg-blue-600 active:bg-blue-700 dark:active:bg-blue-700"
            }`}
            aria-busy={loading}
          >
            <Send className="h-4 w-4" />
            {loading ? t('ai.send.sending') : t('ai.send.button')}
          </button>
        </div>

        {/* 预计耗时显示 */}
        {loading && expectedTime && (
          <p className="mt-2 text-xs text-gray-500" role="status">
            {t('ai.expectedTime').replace('{seconds}', String(expectedTime))}
          </p>
        )}

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

const AIPage: React.FC<AIPageProps> = (props) => {
  return (
    <AIActivationProvider>
      <AIPageContent {...props} />
    </AIActivationProvider>
  );
};

export default AIPage;
