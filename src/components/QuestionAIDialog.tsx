"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, Loader2 } from "lucide-react";
import Image from "next/image";
import { apiFetch } from "@/lib/apiClient.front";
import { loadAiAnswersForLocale, loadUnifiedQuestionsPackage } from "@/lib/questionsLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { getQuestionOptions } from "@/lib/questionUtils";

// 前端内存缓存（按题目hash存储）
// 格式：Map<questionHash, answer>
const memoryCache = new Map<string, string>();

const getStoredUserId = (): string | null => {
  if (typeof window === "undefined") return null;
  const cached = localStorage.getItem("USER_ID");
  if (cached && cached.trim()) {
    return cached.trim();
  }
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "USER_ID" && value) {
        const decoded = decodeURIComponent(value);
        if (decoded.trim()) {
          localStorage.setItem("USER_ID", decoded.trim());
          return decoded.trim();
        }
      }
    }
  } catch (error) {
    // Silent error handling
  }
  return null;
};

interface Question {
  id: number;
  type: "single" | "multiple" | "truefalse";
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined }; // 支持单语言字符串或多语言对象
  image?: string;
  options?: string[] | Array<{ zh: string; en?: string; ja?: string; [key: string]: string | undefined }>; // 支持单语言字符串数组或多语言对象数组
  correctAnswer: string | string[];
  explanation?: string;
  hash?: string; // 题目的hash值（与数据库的content_hash是同一个值）
}

interface QuestionAIDialogProps {
  question: Question;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  metadata?: {
    aiProvider?: "openai" | "openai_direct" | "local" | "openrouter" | "openrouter_direct" | "gemini_direct" | "cached" | "system";
    model?: string;
    sourceType?: "ai-generated" | "cached" | "knowledge-base" | "system-tip";
    cacheSource?: "localStorage" | "database"; // 明确标记缓存来源
  };
}

export default function QuestionAIDialog({
  question,
  isOpen,
  onClose,
}: QuestionAIDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const [localAiAnswers, setLocalAiAnswers] = useState<Record<string, string> | null>(null);
  const { language } = useLanguage();

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  // 加载本地/缓存JSON包中的aiAnswers（每次打开或语言变化时检查版本号并加载）
  useEffect(() => {
    const loadLocalAiAnswers = async () => {
      try {
        // 先确保本地包版本最新
        await loadUnifiedQuestionsPackage();
        const ai = await loadAiAnswersForLocale(language);
        setLocalAiAnswers(ai);
        
        // 同步到内存缓存（理论上每次更新缓存都会和localStorage同步）
        Object.entries(ai).forEach(([hash, answer]) => {
          memoryCache.set(hash, answer);
        });
      } catch (error) {
        setLocalAiAnswers({}); // 设置为空对象，表示已尝试加载但失败
      }
    };
    
    // 每次打开对话框时重新加载（检查版本号）
    if (isOpen) {
      loadLocalAiAnswers();
    }
  }, [isOpen, language]);

  // 加载缓存的对话历史（每次打开对话框时）
  useEffect(() => {
    if (isOpen && question.hash) {
      try {
        const cacheKey = `question_ai_dialog_${question.hash}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsedMessages = JSON.parse(cached) as Message[];
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
            // 检查是否有有效的AI回答（assistant消息且不是错误消息）
            const hasValidAiAnswer = parsedMessages.some((msg) => {
              if (msg.role !== "assistant") return false;
              // 检查是否是错误消息（常见的错误消息关键词）
              const errorKeywords = [
                "Sorry",
                "error",
                "unavailable",
                "failed",
                "超时",
                "失败",
                "错误",
                "无法",
                "暂时",
              ];
              const contentLower = msg.content.toLowerCase();
              // 如果消息很短（可能是错误消息）或包含错误关键词，认为是无效的
              if (msg.content.length < 50 || errorKeywords.some((keyword) => contentLower.includes(keyword.toLowerCase()))) {
                return false;
              }
              // 如果有metadata且sourceType是cached或ai-generated，认为是有效的
              if (msg.metadata?.sourceType === "cached" || msg.metadata?.sourceType === "ai-generated") {
                return true;
              }
              // 如果消息足够长且不包含错误关键词，也认为是有效的
              return msg.content.length >= 50;
            });
            
            if (hasValidAiAnswer) {
              // 有有效的AI回答，使用缓存
              setMessages(parsedMessages);
              hasInitialized.current = true; // 标记为已初始化，避免重复加载AI解释
              return;
            } else {
              // 没有有效的AI回答（可能是之前的调用失败或超时），清除缓存并重新请求
              console.log("[QuestionAIDialog] 检测到缓存的对话历史中没有有效的AI回答，清除缓存并重新请求");
              localStorage.removeItem(cacheKey);
              hasInitialized.current = false;
              return;
            }
          }
        }
        // 如果没有缓存，重置hasInitialized，允许加载AI解释
        hasInitialized.current = false;
      } catch (error) {
        // 如果解析失败，忽略缓存，继续正常流程
        console.error("[QuestionAIDialog] 解析缓存的对话历史失败:", error);
        hasInitialized.current = false;
      }
    }
  }, [isOpen, question.hash]);

  // 保存对话历史到localStorage（每次消息更新时）
  useEffect(() => {
    if (isOpen && question.hash && messages.length > 0) {
      try {
        const cacheKey = `question_ai_dialog_${question.hash}`;
        localStorage.setItem(cacheKey, JSON.stringify(messages));
      } catch (error) {
        // 如果保存失败，忽略错误
      }
    }
  }, [messages, isOpen, question.hash]);

  // 初始化AI解释（仅在首次打开且没有缓存时）
  useEffect(() => {
    if (isOpen && !hasInitialized.current && question && messages.length === 0) {
      hasInitialized.current = true;
      setIsInitialLoading(true);
      fetchAIExplanation();
    }
  }, [isOpen, question, messages.length]);

  // 重置状态当对话框关闭
  useEffect(() => {
    if (!isOpen) {
      // 重置hasInitialized和清空messages（下次打开时会从缓存加载）
      hasInitialized.current = false;
      setMessages([]);
      setInputValue("");
    }
  }, [isOpen]);

  const formatQuestionForAI = () => {
    // 处理多语言content字段
    const contentText = typeof question.content === 'string' 
      ? question.content 
      : (question.content?.zh || '');
    let questionText = `题目：${contentText}\n\n`;
    
    // 处理多语言options字段
    const options = getQuestionOptions(question.options, language);
    if (options && options.length > 0) {
      questionText += "选项：\n";
      options.forEach((option, index) => {
        const label = String.fromCharCode(65 + index);
        questionText += `${label}. ${option}\n`;
      });
      questionText += "\n";
    }

    // 格式化正确答案
    let correctAnswerText = "";
    if (Array.isArray(question.correctAnswer)) {
      correctAnswerText = question.correctAnswer.join("、");
    } else {
      // 对于判断题，将true/false转换为中文
      if (question.type === "truefalse") {
        correctAnswerText = question.correctAnswer === "true" ? "正确" : "错误";
      } else {
        correctAnswerText = question.correctAnswer;
      }
    }
    questionText += `正确答案：${correctAnswerText}\n\n`;

    if (question.explanation) {
      questionText += `解析：${question.explanation}\n\n`;
    }

    questionText += "请进一步解析这道题目。";

    return questionText;
  };

  const fetchAIExplanation = async (userQuestion?: string) => {
    try {
      setIsLoading(true);
      
      const questionText = userQuestion || formatQuestionForAI();
      
      // 判断是首次提问还是用户追问
      const isFollowUpQuestion = !!userQuestion; // 如果userQuestion存在，说明是用户追问
      
      // 获取题目的hash值（仅在首次提问时使用）
      const questionHash = isFollowUpQuestion ? null : question.hash;
      
      // 如果是首次提问，检查缓存；如果是追问，直接调用AI服务
      if (!isFollowUpQuestion) {
        // 首次提问：需要hash值
        if (!questionHash) {
          const errorMessage: Message = {
            role: "assistant",
            content: "题目缺少hash值，无法获取AI解析。",
          };
          setMessages((prev) => [...prev, errorMessage]);
          setIsLoading(false);
          setIsInitialLoading(false);
          return;
        }
        
        // 1. 优先检查内存缓存（理论上每次更新缓存都会和localStorage同步，所以缓存没有localStorage也应该没有）
        const memoryCachedAnswer = memoryCache.get(questionHash);
        if (memoryCachedAnswer) {
          const newMessage: Message = {
            role: "assistant",
            content: memoryCachedAnswer,
            metadata: {
              aiProvider: "cached",
              sourceType: "cached",
              cacheSource: "localStorage", // 内存缓存标记为localStorage（与后端保持一致）
            },
          };
          setMessages((prev) => [...prev, newMessage]);
          
          // 如果题目有图片，添加提示消息
          if (question.image) {
            const tipMessage: Message = {
              role: "assistant",
              content: "💡 提示：由于AI无法直接查看图片，如果您在追问时描述图片中的内容（如标志、路况、车辆位置等），我可以为您提供更准确的解析。",
              metadata: {
                aiProvider: "system",
                sourceType: "system-tip",
              },
            };
            setMessages((prev) => [...prev, tipMessage]);
          }
          
          setIsLoading(false);
          setIsInitialLoading(false);
          return;
        }
        
        // 2. 如果内存缓存中没有，检查本地JSON包（localStorage）
        // 如果localAiAnswers不为null（已加载完成），检查是否有对应的答案
        if (localAiAnswers !== null && localAiAnswers[questionHash]) {
          const cachedAnswer = localAiAnswers[questionHash];
          // 存入内存缓存（与localStorage同步）
          memoryCache.set(questionHash, cachedAnswer);
          const newMessage: Message = {
            role: "assistant",
            content: cachedAnswer,
            metadata: {
              aiProvider: "cached",
              sourceType: "cached",
              cacheSource: "localStorage", // 明确标记为从 localStorage 读取
            },
          };
          setMessages((prev) => [...prev, newMessage]);
          
          // 如果题目有图片，添加提示消息
          if (question.image) {
            const tipMessage: Message = {
              role: "assistant",
              content: "💡 提示：由于AI无法直接查看图片，如果您在追问时描述图片中的内容（如标志、路况、车辆位置等），我可以为您提供更准确的解析。",
              metadata: {
                aiProvider: "system",
                sourceType: "system-tip",
              },
            };
            setMessages((prev) => [...prev, tipMessage]);
          }
          
          setIsLoading(false);
          setIsInitialLoading(false);
          return;
        }
        
        // 如果localAiAnswers为null，说明还在加载中，直接请求后端
        // （本地缓存会在下次打开对话框时生效）
      } else {
        // 用户追问：不检查缓存，直接调用AI服务
      }
      
      // 3. 请求后端（首次提问：如果缓存中没有；追问：直接请求）
      const result = await apiFetch<{
        answer: string;
        sources?: Array<{
          title: string;
          url: string;
          snippet?: string;
        }>;
        aiProvider?: "openai" | "local" | "openrouter" | "openrouter_direct" | "gemini_direct";
        model?: string;
        cached?: boolean;
        cacheSource?: "localStorage" | "database"; // 明确标记缓存来源
      }>("/api/ai/ask", {
        method: "POST",
        body: {
          question: questionText,
          locale: language,
          // 仅在首次提问时传递questionHash，追问时不传递（让后端知道这是追问，需要调用AI服务）
          ...(questionHash ? { questionHash } : {}),
          // 显式指定场景为 question_explanation（后端会根据 questionHash 自动推断，但显式指定更清晰）
          scene: "question_explanation",
        },
      });

      if (result.ok && result.data?.answer) {
        // TypeScript 类型守卫：确保 answer 存在
        const answer = result.data.answer;
        
        // 如果是从缓存获取的，存入内存缓存（与localStorage同步）
        if (result.data.cached && questionHash) {
          memoryCache.set(questionHash, answer);
        }
        
        const newMessage: Message = {
          role: "assistant",
          content: answer,
          metadata: {
            aiProvider: result.data.cached ? "cached" : (result.data.aiProvider || "openai"),
            model: result.data.model,
            sourceType: result.data.cached ? "cached" : "ai-generated",
            cacheSource: result.data.cacheSource || (result.data.cached ? "database" : undefined), // 明确标记缓存来源
          },
        };
        setMessages((prev) => [...prev, newMessage]);
        
        // 如果是首次提问且题目有图片，添加提示消息
        if (!isFollowUpQuestion && question.image) {
          const tipMessage: Message = {
            role: "assistant",
            content: "💡 提示：由于AI无法直接查看图片，如果您在追问时描述图片中的内容（如标志、路况、车辆位置等），我可以为您提供更准确的解析。",
            metadata: {
              aiProvider: "system",
              sourceType: "system-tip",
            },
          };
          setMessages((prev) => [...prev, tipMessage]);
        }
      } else {
        const errorMessage: Message = {
          role: "assistant",
          content: "Sorry, AI service is temporarily unavailable. Please try again later.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, an error occurred while getting AI explanation. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // 发送用户问题到AI
    await fetchAIExplanation(inputValue.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">AI智能助手</h2>
            <span className="text-xs text-gray-500 ml-2">by Zalem</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 题目显示区域 */}
        <div className="p-4 border-b bg-gray-50 max-h-48 overflow-y-auto">
          <div className="text-sm font-medium text-gray-700 mb-2">当前题目：</div>
          <div className="text-gray-900 mb-2">
            {typeof question.content === 'string' 
              ? question.content 
              : (question.content?.zh || '')}
          </div>
          {question.image && (
            <div className="mt-2 relative w-full h-32">
              <Image
                src={question.image.trim()}
                alt="题目图片"
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-contain rounded-lg"
              />
            </div>
          )}
          {question.options && question.options.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              {getQuestionOptions(question.options, language).map((option, index) => {
                const label = String.fromCharCode(65 + index);
                return (
                  <div key={index} className="mb-1">
                    {label}. {option}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 对话区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isInitialLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">AI正在思考中...</span>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                  {/* AI reply metadata */}
                  {message.role === "assistant" && message.metadata && (
                    <div className="max-w-[80%] px-2 py-1 text-xs text-gray-500 space-y-1 mt-1">
                      {/* AI Service Provider and Model */}
                      {(message.metadata.aiProvider || message.metadata.model) && (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1">
                            {message.metadata.aiProvider === "local" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span>Local AI (Ollama)</span>
                                {message.metadata.model && (
                                  <span className="text-gray-400 ml-1">· {message.metadata.model}</span>
                                )}
                              </>
                            ) : message.metadata.aiProvider === "openai" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span>OpenAI (via Render)</span>
                                {message.metadata.model && (
                                  <span className="text-gray-400 ml-1">· {message.metadata.model}</span>
                                )}
                              </>
                            ) : message.metadata.aiProvider === "openai_direct" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                                <span>OpenAI (Direct)</span>
                                {message.metadata.model && (
                                  <span className="text-gray-400 ml-1">· {message.metadata.model}</span>
                                )}
                              </>
                            ) : message.metadata.aiProvider === "openrouter" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                <span>OpenRouter (via Render)</span>
                                {message.metadata.model && (
                                  <span className="text-gray-400 ml-1">· {message.metadata.model}</span>
                                )}
                              </>
                            ) : message.metadata.aiProvider === "openrouter_direct" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span>
                                <span>OpenRouter (Direct)</span>
                                {message.metadata.model && (
                                  <span className="text-gray-400 ml-1">· {message.metadata.model}</span>
                                )}
                              </>
                            ) : message.metadata.aiProvider === "gemini_direct" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                <span>Google Gemini (Direct)</span>
                                {message.metadata.model && (
                                  <span className="text-gray-400 ml-1">· {message.metadata.model}</span>
                                )}
                              </>
                            ) : message.metadata.aiProvider === "cached" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>Cached Answer</span>
                                {message.metadata.cacheSource && (
                                  <span className="text-gray-400 ml-1">
                                    ({message.metadata.cacheSource === "localStorage" ? "LocalStorage" : "Database"})
                                  </span>
                                )}
                                {message.metadata.model && (
                                  <span className="text-gray-400 ml-1">· {message.metadata.model}</span>
                                )}
                              </>
                            ) : null}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t">
          <div className="flex items-end space-x-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入你的问题..."
              className="flex-1 min-h-[60px] max-h-[120px] p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading || isInitialLoading}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading || isInitialLoading}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              aria-label="发送"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

