"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, Loader2 } from "lucide-react";
import Image from "next/image";
import { apiFetch } from "@/lib/apiClient.front";

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
    console.warn("[QuestionAIDialog] Failed to read USER_ID from cookies:", error);
  }
  return null;
};

interface Question {
  id: number;
  type: "single" | "multiple" | "truefalse";
  content: string;
  image?: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
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
    aiProvider?: "openai" | "openai_direct" | "local" | "openrouter" | "openrouter_direct" | "cached";
    model?: string;
    sourceType?: "ai-generated" | "cached" | "knowledge-base";
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

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  // 初始化AI解释
  useEffect(() => {
    if (isOpen && !hasInitialized.current && question) {
      hasInitialized.current = true;
      setIsInitialLoading(true);
      fetchAIExplanation();
    }
  }, [isOpen, question]);

  // 重置状态当对话框关闭
  useEffect(() => {
    if (!isOpen) {
      hasInitialized.current = false;
      setMessages([]);
      setInputValue("");
    }
  }, [isOpen]);

  const formatQuestionForAI = () => {
    let questionText = `题目：${question.content}\n\n`;
    
    if (question.options && question.options.length > 0) {
      questionText += "选项：\n";
      question.options.forEach((option, index) => {
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
      
      const result = await apiFetch<{
        answer: string;
        sources?: Array<{
          title: string;
          url: string;
          snippet?: string;
        }>;
        aiProvider?: "openai" | "local" | "openrouter" | "openrouter_direct";
        model?: string;
        cached?: boolean;
      }>("/api/ai/ask", {
        method: "POST",
        body: {
          question: questionText,
          locale: "zh-CN",
        },
      });

      if (result.ok && result.data?.answer) {
        // TypeScript 类型守卫：确保 answer 存在
        const answer = result.data.answer;
        const newMessage: Message = {
          role: "assistant",
          content: answer,
          metadata: {
            aiProvider: result.data.cached ? "cached" : (result.data.aiProvider || "openai"),
            model: result.data.model,
            sourceType: result.data.cached ? "cached" : "ai-generated",
          },
        };
        setMessages((prev) => [...prev, newMessage]);
      } else {
        const errorMessage: Message = {
          role: "assistant",
          content: "Sorry, AI service is temporarily unavailable. Please try again later.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Failed to get AI explanation:", error);
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
          <div className="text-gray-900 mb-2">{question.content}</div>
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
              {question.options.map((option, index) => {
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
                            ) : message.metadata.aiProvider === "cached" ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>Cached Answer</span>
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

