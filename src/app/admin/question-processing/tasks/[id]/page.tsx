"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";

type TaskStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "succeeded";

type ServerLog = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  trace_id?: string;
};

type TaskDetail = {
  id: number;
  task_id: string;
  status: TaskStatus;
  operations: string[];
  question_ids: number[] | null;
  translate_options: any;
  polish_options: any;
  full_pipeline_options?: {
    sourceLanguage: string;
    targetLanguages: string[];
    type: string;
  };
  batch_size: number;
  continue_on_error: boolean;
  total_questions: number;
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  errors: any;
  details: {
    items?: any[];
    server_logs?: ServerLog[];
  };
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type TaskItem = {
  id: number;
  question_id: number;
  operation: string;
  target_lang: string | null;
  status: string;
  error_message: string | null;
  error_detail: any;
  ai_request: any;
  ai_response: any;
  processed_data: any;
};

type ExplanationConsistency = {
  status?: "consistent" | "inconsistent" | "unknown";
  expected?: "true" | "false" | "unknown";
  inferred?: "true" | "false" | "unknown";
  locale?: string;
};

export default function TaskDetailPage() {
  const params = useParams() as { id?: string };
  const router = useRouter();
  const taskId = (params?.id ?? "");
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取任务详情
  const fetchTaskDetail = async () => {
    try {
      const response = await apiFetch<TaskDetail>(`/api/admin/question-processing/batch-process?taskId=${taskId}`);
      setTask(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load task detail');
      console.error('Error fetching task detail:', err);
    } finally {
      setLoading(false);
    }
  };

  // 获取任务子项
  const fetchTaskItems = async () => {
    try {
      const response = await apiFetch<{ items: any[] }>(`/api/admin/question-processing/tasks/${taskId}/items`);
      const normalized = (response.data?.items || []).map((item) => {
        const error_detail = item.error_detail ?? item.errorDetail ?? null;
        const target_lang = item.target_lang ?? item.targetLang ?? null;
        return { ...item, error_detail, target_lang };
      }) as TaskItem[];
      setTaskItems(normalized);
    } catch (err: any) {
      console.error('Error fetching task items:', err);
    }
  };

  // 自动刷新机制
  useEffect(() => {
    fetchTaskDetail();
    fetchTaskItems();

    // 如果任务状态是 processing，每3秒刷新一次
    if (task?.status === 'processing') {
      refreshIntervalRef.current = setInterval(() => {
        fetchTaskDetail();
        fetchTaskItems();
      }, 3000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [taskId]);

  // 当任务状态变化时，停止轮询
  useEffect(() => {
    if (task && (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [task?.status]);

  // 过滤日志
  const filteredLogs = task?.details?.server_logs?.filter((log) => {
    if (selectedStep === "all") return true;
    return log.message.includes(`step=${selectedStep}`);
  }) || [];

  const normalizeConsistency = (raw: any): ExplanationConsistency[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.filter(Boolean);
    }
    return [raw];
  };

  const renderStatusBadge = (status?: string) => {
    if (status === "inconsistent") return <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs">不一致</span>;
    if (status === "consistent") return <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs">一致</span>;
    return <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">未知</span>;
  };

  const renderTruth = (val?: string) => {
    if (val === "true") return "正确";
    if (val === "false") return "错误";
    return "未知";
  };

  // 格式化 JSON
  const formatJson = (obj: any): string => {
    if (!obj) return 'N/A';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // 提取日志中的关键信息
  const extractLogInfo = (message: string) => {
    const removedLanguagesMatch = message.match(/removedLanguages=(\[[^\]]*\])/);
    const cleanedJsonMatch = message.match(/cleanedJsonPreview=([^|]+)/);
    const fixedJsonMatch = message.match(/fixedJson=([^|]+)/);
    
    return {
      removedLanguages: removedLanguagesMatch ? JSON.parse(removedLanguagesMatch[1]) : null,
      cleanedJsonPreview: cleanedJsonMatch ? cleanedJsonMatch[1].trim() : null,
      fixedJson: fixedJsonMatch ? fixedJsonMatch[1].trim() : null,
    };
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-red-600">错误: {error || '任务不存在'}</div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-200 rounded"
        >
          返回
        </button>
      </div>
    );
  }

  const serverLogs = task.details?.server_logs || [];
  const taskErrors = task.errors || [];

  return (
    <div className="container mx-auto p-6">
      {/* 头部 */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← 返回任务列表
        </button>
        <h1 className="text-2xl font-bold">任务详情</h1>
        <p className="text-gray-600">任务 ID: {task.task_id}</p>
      </div>

      {/* 任务基础信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">任务基础信息</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">状态:</span>
            <span className={`ml-2 px-2 py-1 rounded ${
              task.status === 'completed' ? 'bg-green-100 text-green-800' :
              task.status === 'failed' ? 'bg-red-100 text-red-800' :
              task.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {task.status}
            </span>
          </div>
          <div>
            <span className="font-medium">创建时间:</span>
            <span className="ml-2">{new Date(task.created_at).toLocaleString('zh-CN')}</span>
          </div>
          <div>
            <span className="font-medium">总题目数:</span>
            <span className="ml-2">{task.total_questions}</span>
          </div>
          <div>
            <span className="font-medium">已处理:</span>
            <span className="ml-2">{task.processed_count} / {task.total_questions}</span>
          </div>
          <div>
            <span className="font-medium">成功:</span>
            <span className="ml-2 text-green-600">{task.succeeded_count}</span>
          </div>
          <div>
            <span className="font-medium">失败:</span>
            <span className="ml-2 text-red-600">{task.failed_count}</span>
          </div>
          {task.full_pipeline_options && (
            <>
              <div>
                <span className="font-medium">源语言:</span>
                <span className="ml-2">{task.full_pipeline_options.sourceLanguage}</span>
              </div>
              <div>
                <span className="font-medium">目标语言:</span>
                <span className="ml-2">{task.full_pipeline_options.targetLanguages.join(', ')}</span>
              </div>
            </>
          )}
          <div>
            <span className="font-medium">操作类型:</span>
            <span className="ml-2">{task.operations.join(', ')}</span>
          </div>
        </div>
      </div>

      {/* AI 调试日志 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">AI 调试日志</h2>
        
        {/* 步骤过滤 */}
        <div className="mb-4">
          <label className="mr-2">按步骤过滤:</label>
          <select
            value={selectedStep}
            onChange={(e) => setSelectedStep(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="all">全部</option>
            <option value="AI_CALL_BEFORE">AI 调用前</option>
            <option value="AI_CALL_AFTER">AI 调用后</option>
            <option value="SANITIZE_AFTER">Sanitize 之后</option>
            <option value="DB_WRITE_BEFORE">数据库写入前</option>
          </select>
        </div>

        {/* 日志列表 */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500">暂无日志</div>
          ) : (
            filteredLogs.map((log, index) => {
              const logInfo = extractLogInfo(log.message);
              const isExpanded = expandedLogs.has(index);
              
              return (
                <div
                  key={index}
                  className={`border rounded p-3 ${
                    log.level === 'error' ? 'border-red-300 bg-red-50' :
                    log.level === 'warn' ? 'border-yellow-300 bg-yellow-50' :
                    'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          log.level === 'error' ? 'bg-red-200 text-red-800' :
                          log.level === 'warn' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {log.level.toUpperCase()}
                        </span>
                        {log.trace_id && (
                          <span className="text-xs text-gray-500">Trace ID: {log.trace_id}</span>
                        )}
                      </div>
                      <div className="font-mono text-sm">{log.message}</div>
                      
                      {/* 高亮显示关键信息 */}
                      {logInfo.removedLanguages && (
                        <div className="mt-2 p-2 bg-yellow-100 rounded">
                          <span className="font-medium">被过滤的语言:</span>
                          <span className="ml-2 text-red-600">
                            {JSON.stringify(logInfo.removedLanguages)}
                          </span>
                        </div>
                      )}
                      
                      {(logInfo.cleanedJsonPreview || logInfo.fixedJson) && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedLogs);
                            if (isExpanded) {
                              newExpanded.delete(index);
                            } else {
                              newExpanded.add(index);
                            }
                            setExpandedLogs(newExpanded);
                          }}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? '收起' : '展开'} JSON 预览
                        </button>
                      )}
                      
                      {isExpanded && (
                        <div className="mt-2 space-y-2">
                          {logInfo.cleanedJsonPreview && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">Cleaned JSON Preview:</span>
                                <button
                                  onClick={() => copyToClipboard(logInfo.cleanedJsonPreview!)}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  复制
                                </button>
                              </div>
                              <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">
                                {logInfo.cleanedJsonPreview}
                              </pre>
                            </div>
                          )}
                          {logInfo.fixedJson && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">Fixed JSON:</span>
                                <button
                                  onClick={() => copyToClipboard(logInfo.fixedJson!)}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  复制
                                </button>
                              </div>
                              <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">
                                {logInfo.fixedJson}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => copyToClipboard(log.message)}
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      复制
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 错误详情 */}
      {taskItems.some(item => item.error_detail) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">错误详情</h2>
          <div className="space-y-4">
            {taskItems
              .filter(item => item.error_detail)
              .map((item, index) => {
                const isExpanded = expandedErrors.has(item.id);
                const errorDetail = item.error_detail;
                
                return (
                  <div
                    key={item.id}
                    className="border border-red-300 rounded p-4 bg-red-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium mb-2">
                          题目 ID: {item.question_id} | 操作: {item.operation}
                        </div>
                        {/* 解析一致性展示 */}
                        {(() => {
                          const consistencyList = normalizeConsistency(errorDetail?.explanationConsistency);
                          if (!consistencyList.length) return null;
                          const hasInconsistent = consistencyList.some(c => c.status === "inconsistent");
                          return (
                            <div className={`mb-3 p-3 rounded ${hasInconsistent ? "bg-red-100 border border-red-200" : "bg-gray-50 border border-gray-200"}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">解析一致性</span>
                                {hasInconsistent && <span className="text-xs text-red-600">检测到不一致</span>}
                                <a
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  href={`/admin/questions/${item.question_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  查看题目
                                </a>
                              </div>
                              <div className="space-y-1">
                                {consistencyList.map((c, idx) => (
                                  <div key={idx} className="flex items-center gap-3 text-sm">
                                    {renderStatusBadge(c.status)}
                                    <span>期望：{renderTruth(c.expected)}</span>
                                    <span>AI 判定：{renderTruth(c.inferred)}</span>
                                    {c.locale && <span>语言：{c.locale}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {errorDetail.errorMessage && (
                          <div className="text-red-600 mb-2">
                            {errorDetail.errorMessage}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedErrors);
                            if (isExpanded) {
                              newExpanded.delete(item.id);
                            } else {
                              newExpanded.add(item.id);
                            }
                            setExpandedErrors(newExpanded);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? '收起' : '展开'} 详细信息
                        </button>
                        
                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {errorDetail.rawAiResponse && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">Raw AI Response:</span>
                                  <button
                                    onClick={() => copyToClipboard(errorDetail.rawAiResponse)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    复制
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto max-h-48">
                                  {typeof errorDetail.rawAiResponse === 'string' 
                                    ? errorDetail.rawAiResponse.substring(0, 1000)
                                    : formatJson(errorDetail.rawAiResponse)}
                                </pre>
                              </div>
                            )}
                            {errorDetail.fixedJson && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">Fixed JSON:</span>
                                  <button
                                    onClick={() => copyToClipboard(errorDetail.fixedJson)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    复制
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">
                                  {formatJson(errorDetail.fixedJson)}
                                </pre>
                              </div>
                            )}
                            {errorDetail.cleanJson && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">Clean JSON:</span>
                                  <button
                                    onClick={() => copyToClipboard(errorDetail.cleanJson)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    复制
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">
                                  {formatJson(errorDetail.cleanJson)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
